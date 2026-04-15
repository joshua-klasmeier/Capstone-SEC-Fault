import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAMES = [
  "sec_fault_user_email",
  "sec_fault_user_name",
] as const;

const PUBLIC_PATHS = new Set(["/", "/login", "/about", "/terms"]);

function isAuthenticated(request: NextRequest): boolean {
  return AUTH_COOKIE_NAMES.some((cookieName) =>
    Boolean(request.cookies.get(cookieName)?.value),
  );
}

export function proxy(request: NextRequest) {
  const { nextUrl } = request;
  const authenticated = isAuthenticated(request);
  const pathname = nextUrl.pathname;

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname !== "/login") {
      return NextResponse.next();
    }

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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};