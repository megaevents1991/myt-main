import { NextResponse } from "next/server";
import { PARTNER_SESSION_COOKIE } from "@/lib/partner-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Expire rather than delete so the browser definitely drops it.
  response.cookies.set(PARTNER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
