import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: { status: "ok", service: "SIGAF", version: "2.5.1" },
  });
}
