import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // 🔒 Protect dashboard route
  if (pathname.startsWith("/dashboard") && !session) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // 🧭 Redirect logged-in users away from login/signup pages
  if (
    session &&
    (pathname.startsWith("/auth/login") ||
      pathname.startsWith("/auth/signup") ||
      pathname.startsWith("/"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
