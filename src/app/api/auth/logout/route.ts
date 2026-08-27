import { NextResponse } from "next/server";
import { AUTH_COOKIE, CSRF_COOKIE } from "@/shared/kernel/types";
import { getSession, revokeSession } from "@/shared/kernel/auth";
import { writeAudit } from "@/shared/kernel/http";

export async function POST() {
  const user = await getSession();

  try {
    if (user) {
      await revokeSession(user.sessionId);
      await writeAudit({ user, action: "LOGOUT", module: "auth" });
    }
  } catch {
    // ignore
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  res.cookies.set(CSRF_COOKIE, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}
