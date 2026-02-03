import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = new URL("/playground", request.url);
  return NextResponse.redirect(url, 302);
}

export const config = {
  matcher: ["/"],
};
