"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FIELD_TYPES, FIELD_MIN, looksLikeNameField } from "@/lib/pdfFields";

// Renders a PDF (via pdf.js, loaded only in the browser) as a stack of pages and
// overlays interactive fields on top. Geometry is kept in PDF points with a
// bottom-left origin; this component converts to/from on-screen pixels using
// each page's render scale, so what staff place is exactly what the server later
// stamps with pdf-lib.
//
//   mode="edit"  — staff placement: click a page to drop the active tool, then
//                  drag to move and use the corner handle to resize; click a
//                  field to select it.
//   mode="sign"  — client fill-in: text/initial become inputs, date shows the
//                  (read-only) signing date, signature shows a "Sign here"
//                  target that calls onSignRequest.
//
// pdf.js ships a Web Worker; we serve it from /public so there is no external
// dependency and no CORS surface. The PDF bytes themselves arrive same-origin
// (a local File in the editor, or our token-gated proxy on the signing page).

let _pdfjs = null;
async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  _pdfjs = pdfjs;
  return pdfjs;
}

export default function PdfFieldLayer({
  src, // { url } (fetched same-origin) or { data: Uint8Array }
  fields = [],
  mode = "view",
  tool = null, // edit: active palette item { type, label } to drop on click
  selectedId = null,
  onAdd, // edit: (field) => void
  onUpdate, // edit: (id, patch) => void
  onSelect, // edit: (id|null) => void
  values = {}, // sign: { [fieldId]: string }
  onValue, // sign: (id, value) => void
  signatureFor, // sign: (field) => ({ type, data }) | null
  onSignRequest, // sign: (field) => void
  onPagesReady, // (pageSizes:[{w,h}]) => void
  className = "",
}) {
  const wrapRef = useRef(null);
  const canvasRefs = useRef(new Map());
  const docRef = useRef(null);
  const [pageInfos, setPageInfos] = useState([]); // [{num,widthPt,heightPt}]
  const [rendered, setRendered] = useState({}); // num -> {scale,widthPx,heightPx}
  const [width, setWidth] = useState(0);
  const [loadErr, setLoadErr] = useState("");
  const editable = mode === "edit";

  // Measure container width (and follow resizes).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const set = () => setWidth(el.clientWidth || 0);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load the document once per src.
  useEffect(() => {
    let cancelled = false;
    setLoadErr("");
    setPageInfos([]);
    setRendered({});
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        let params;
        if (src && src.data) {
          // Clone so pdf.js can't detach the caller's buffer.
          params = { data: src.data.slice(0) };
        } else if (src && src.url) {
          const res = await fetch(src.url);
          if (!res.ok) throw new Error("Could not load the document file.");
          params = { data: new Uint8Array(await res.arrayBuffer()) };
        } else {
          return;
        }
        const pdf = await pdfjs.getDocument(params).promise;
        if (cancelled) return;
        docRef.current = pdf;
        const infos = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const vp = page.getViewport({ scale: 1 });
          infos.push({ num: n, widthPt: vp.width, heightPt: vp.height });
        }
        if (cancelled) return;
        setPageInfos(infos);
        if (onPagesReady) onPagesReady(infos.map((i) => ({ w: i.widthPt, h: i.heightPt })));
      } catch (e) {
        if (!cancelled) setLoadErr(e.message || "Could not render the document.");
      }
    })();
    return () => {
      cancelled = true;
      if (docRef.current) {
        try {
          docRef.current.destroy();
        } catch {}
        docRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src && src.url, src && src.data]);

  // Render (or re-render) each page's canvas whenever pages or width change.
  useEffect(() => {
    if (!docRef.current || !pageInfos.length || !width) return;
    let cancelled = false;
    const tasks = [];
    (async () => {
      for (const info of pageInfos) {
        const canvas = canvasRefs.current.get(info.num);
        if (!canvas) continue;
        const scale = width / info.widthPt;
        const page = await docRef.current.getPage(info.num);
        const vp = page.getViewport({ scale });
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(vp.width * ratio);
        canvas.height = Math.floor(vp.height * ratio);
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;
        const ctx = canvas.getContext("2d");
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        const task = page.render({ canvasContext: ctx, viewport: vp });
        tasks.push(task);
        try {
          await task.promise;
        } catch {
          /* superseded render */
        }
        if (cancelled) return;
        setRendered((r) => ({
          ...r,
          [info.num]: { scale, widthPx: vp.width, heightPx: vp.height },
        }));
      }
    })();
    return () => {
      cancelled = true;
      tasks.forEach((t) => {
        try {
          t.cancel();
        } catch {}
      });
    };
  }, [pageInfos, width]);

  // ---- geometry helpers ----------------------------------------------------
  function infoFor(page) {
    return pageInfos.find((p) => p.num === page);
  }
  function ptToPx(field) {
    const ri = rendered[field.page];
    const pi = infoFor(field.page);
    if (!ri || !pi) return null;
    const s = ri.scale;
    return {
      left: field.pos_x * s,
      top: (pi.heightPt - (field.pos_y + field.height)) * s,
      width: field.width * s,
      height: field.height * s,
    };
  }

  // ---- edit interactions ---------------------------------------------------
  const drag = useRef(null);

  const onPointerMove = useCallback(
    (e) => {
      const d = drag.current;
      if (!d) return;
      const ri = rendered[d.page];
      const pi = infoFor(d.page);
      if (!ri || !pi) return;
      const dxPt = (e.clientX - d.startX) / ri.scale;
      const dyPt = (e.clientY - d.startY) / ri.scale;
      if (d.kind === "move") {
        let nx = d.orig.pos_x + dxPt;
        // screen-down (dy>0) lowers the box → pos_y decreases
        let ny = d.orig.pos_y - dyPt;
        nx = Math.min(Math.max(0, nx), pi.widthPt - d.orig.width);
        ny = Math.min(Math.max(0, ny), pi.heightPt - d.orig.height);
        onUpdate && onUpdate(d.id, { pos_x: nx, pos_y: ny });
      } else {
        // resize from the bottom-right handle: width grows right, height grows
        // down (which lowers the bottom edge → pos_y decreases by the delta)
        let nw = Math.max(FIELD_MIN.w, d.orig.width + dxPt);
        let nh = Math.max(FIELD_MIN.h, d.orig.height + dyPt);
        nw = Math.min(nw, pi.widthPt - d.orig.pos_x);
        nh = Math.min(nh, d.orig.pos_y + d.orig.height); // keep bottom >= 0
        const ny = d.orig.pos_y + d.orig.height - nh;
        onUpdate && onUpdate(d.id, { width: nw, height: nh, pos_y: ny });
      }
    },
    [rendered, pageInfos, onUpdate]
  );

  useEffect(() => {
    if (!editable) return;
    function up() {
      drag.current = null;
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", up);
    };
  }, [editable, onPointerMove]);

  function startDrag(e, field, kind) {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect && onSelect(field.id);
    drag.current = {
      id: field.id,
      page: field.page,
      kind,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...field },
    };
  }

  function dropOnPage(e, page) {
    if (!editable || !tool) return;
    const ri = rendered[page];
    const pi = infoFor(page);
    if (!ri || !pi) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pxX = e.clientX - rect.left;
    const pxY = e.clientY - rect.top;
    const def = FIELD_TYPES[tool.type] || FIELD_TYPES.text;
    const wPt = def.w;
    const hPt = def.h;
    // place centered on the click, clamped to the page
    let pos_x = pxX / ri.scale - wPt / 2;
    let topPt = pxY / ri.scale - hPt / 2;
    pos_x = Math.min(Math.max(0, pos_x), pi.widthPt - wPt);
    topPt = Math.min(Math.max(0, topPt), pi.heightPt - hPt);
    const pos_y = pi.heightPt - topPt - hPt;
    onAdd &&
      onAdd({
        role: "client",
        field_type: tool.type,
        label: tool.label || def.name,
        required: true,
        page,
        pos_x,
        pos_y,
        width: wPt,
        height: hPt,
      });
  }

  // ---- render --------------------------------------------------------------
  if (loadErr) {
    return (
      <div className={"rounded-lg border border-line bg-white p-4 text-sm text-muted " + className}>
        {loadErr} You can still continue; contact Transworld if the preview will not load.
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={"select-none space-y-4 " + className}>
      {!pageInfos.length && (
        <div className="rounded-lg border border-line bg-white p-6 text-center text-sm text-muted">
          Rendering document…
        </div>
      )}

      {pageInfos.map((pi) => {
        const ri = rendered[pi.num];
        const pageFields = fields.filter((f) => f.page === pi.num);
        return (
          <div key={pi.num} className="mx-auto" style={{ width: ri ? ri.widthPx : "100%" }}>
            <div
              className="relative rounded-lg border border-line bg-white shadow-card"
              style={ri ? { width: ri.widthPx, height: ri.heightPx } : undefined}
            >
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current.set(pi.num, el);
                  else canvasRefs.current.delete(pi.num);
                }}
                className="block rounded-lg"
              />

              {/* overlay */}
              <div
                className="absolute inset-0"
                style={{ cursor: editable && tool ? "crosshair" : "default" }}
                onPointerDown={(e) => {
                  if (editable && tool) dropOnPage(e, pi.num);
                  else if (editable && onSelect) onSelect(null);
                }}
              >
                {ri &&
                  pageFields.map((f) => {
                    const box = ptToPx(f);
                    if (!box) return null;
                    const selected = editable && selectedId === f.id;
                    return (
                      <FieldBox
                        key={f.id || `${f.page}-${f.pos_x}-${f.pos_y}`}
                        field={f}
                        box={box}
                        mode={mode}
                        selected={selected}
                        onMoveStart={(e) => startDrag(e, f, "move")}
                        onResizeStart={(e) => startDrag(e, f, "resize")}
                        value={values[f.id] || ""}
                        onValue={onValue}
                        signature={signatureFor ? signatureFor(f) : null}
                        onSignRequest={onSignRequest}
                      />
                    );
                  })}
              </div>
            </div>
            <div className="mt-1 text-center text-[11px] text-muted">
              Page {pi.num} of {pageInfos.length}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FieldBox({
  field,
  box,
  mode,
  selected,
  onMoveStart,
  onResizeStart,
  value,
  onValue,
  signature,
  onSignRequest,
}) {
  const editable = mode === "edit";
  const sign = mode === "sign";
  const style = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
  };
  const typeName = (FIELD_TYPES[field.field_type] || {}).name || field.field_type;

  // ---- edit mode -----------------------------------------------------------
  if (editable) {
    return (
      <div
        className={
          "absolute flex items-center justify-center rounded-[3px] border text-[10px] font-medium " +
          (selected
            ? "border-navy bg-navy/10 text-navy"
            : "border-gold-600/70 bg-gold-50/70 text-gold-600")
        }
        style={{ ...style, cursor: "move" }}
        onPointerDown={onMoveStart}
        title={field.label}
      >
        <span className="pointer-events-none truncate px-1">
          {field.label}
          {field.required ? " *" : ""}
        </span>
        <span
          onPointerDown={onResizeStart}
          className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm border border-navy bg-white"
        />
      </div>
    );
  }

  // ---- sign mode -----------------------------------------------------------
  if (sign) {
    if (field.field_type === "signature") {
      return (
        <div className="absolute" style={style}>
          {signature ? (
            <button
              type="button"
              onClick={() => onSignRequest && onSignRequest(field)}
              className="flex h-full w-full items-center justify-center rounded-[3px] border border-navy-200 bg-white"
              title="Tap to change your signature"
            >
              {signature.type === "drawn" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signature.data}
                  alt="Signature"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="truncate px-1 font-serif text-lg italic text-navy">
                  {signature.data}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSignRequest && onSignRequest(field)}
              className="flex h-full w-full items-center justify-center rounded-[3px] border-2 border-dashed border-gold-600 bg-gold-50/80 text-[11px] font-semibold text-gold-600"
            >
              Sign here
            </button>
          )}
        </div>
      );
    }
    if (field.field_type === "date") {
      return (
        <div
          className="absolute flex items-center rounded-[3px] border border-navy-200 bg-navy-50/60 px-1 text-[12px] text-ink"
          style={style}
          title="Date — filled automatically when you accept"
        >
          <span className="truncate">{value || "Date"}</span>
        </div>
      );
    }
    // text / initial → input
    return (
      <input
        className="absolute rounded-[3px] border border-navy-200 bg-white px-1 text-[13px] text-ink outline-none focus:border-navy-600 focus:ring-1 focus:ring-navy-600/30"
        style={style}
        placeholder={field.required ? `${field.label} *` : field.label}
        value={value}
        onChange={(e) => onValue && onValue(field.id, e.target.value)}
      />
    );
  }

  // ---- view mode -----------------------------------------------------------
  return (
    <div
      className="absolute rounded-[3px] border border-line"
      style={style}
      title={`${typeName}: ${field.label}`}
    />
  );
}
