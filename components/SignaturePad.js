"use client";

import { useEffect, useRef, useState } from "react";

// Captures a signature as either a drawn PNG (base64 data URL) or a typed name.
// Calls onChange({ type: "drawn"|"typed", data }) or onChange(null) when empty.
export default function SignaturePad({ defaultName = "", onChange }) {
  const [mode, setMode] = useState("draw"); // "draw" | "type"
  const [typed, setTyped] = useState("");
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  // Prepare the canvas backing store for crisp lines on HiDPI screens.
  useEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0B1F3A";
  }, [mode]);

  function pos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  }
  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasInk.current = true;
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk.current && onChange) {
      onChange({ type: "drawn", data: canvasRef.current.toDataURL("image/png") });
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasInk.current = false;
    onChange && onChange(null);
  }

  function onType(v) {
    setTyped(v);
    onChange && onChange(v.trim() ? { type: "typed", data: v.trim() } : null);
  }

  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border border-line bg-white p-0.5 text-sm">
        <button
          type="button"
          onClick={() => {
            setMode("draw");
            onChange && onChange(null);
          }}
          className={
            "rounded-md px-3 py-1.5 " +
            (mode === "draw" ? "bg-navy text-white" : "text-muted hover:text-ink")
          }
        >
          Draw
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("type");
            onChange && onChange(typed.trim() ? { type: "typed", data: typed.trim() } : null);
          }}
          className={
            "rounded-md px-3 py-1.5 " +
            (mode === "type" ? "bg-navy text-white" : "text-muted hover:text-ink")
          }
        >
          Type
        </button>
      </div>

      {mode === "draw" ? (
        <div>
          <canvas
            ref={canvasRef}
            className="h-40 w-full touch-none rounded-lg border border-line bg-white"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>Sign with your finger or mouse.</span>
            <button type="button" onClick={clear} className="font-medium text-navy-700 underline">
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div>
          <input
            className="field"
            placeholder={defaultName || "Type your full name"}
            value={typed}
            onChange={(e) => onType(e.target.value)}
            autoComplete="name"
          />
          {typed.trim() && (
            <div className="mt-2 rounded-lg border border-line bg-white px-4 py-3">
              <span className="font-serif text-2xl italic text-navy">{typed.trim()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
