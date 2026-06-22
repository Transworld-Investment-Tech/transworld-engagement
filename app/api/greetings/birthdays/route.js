import { NextResponse } from "next/server";
import { getBirthdayContext } from "@/lib/greetingsServer";

export const dynamic = "force-dynamic";

// Any signed-in user may view the queue; releasing/skipping is gated in /send.
export async function GET() {
  try {
    const ctx = await getBirthdayContext();
    return NextResponse.json(ctx);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Could not load birthdays" }, { status: 500 });
  }
}
