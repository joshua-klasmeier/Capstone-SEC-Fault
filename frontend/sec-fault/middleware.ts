import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAMES = [
  "sec_fault_user_email",
  "sec_fault_user_name",
] as const;

function isAuthenticated(request: NextRequest): boolean {
  return AUTH_COOKIE_NAMES.some((cookieName) =>
    Boolean(request.cookies.get(cookieName)?.value),
  );
}

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const authenticated = isAuthenticated(request);
  const pathname = nextUrl.pathname;

  if (pathname === "/login") {
    if (!authenticated) {
      return NextResponse.next();
    }

    const destination = nextUrl.searchParams.get("next") || "/";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (authenticated) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const nextPath = `${pathname}${nextUrl.search}`;
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/analyze/:path*", "/history/:path*", "/filings/:path*", "/preferences/:path*", "/login"],
};