import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    if (user) {
      const role = (user.user_metadata?.role as string | undefined)?.toLowerCase();
      const dest = role === "client" ? "/portal" : "/dashboard";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return supabaseResponse;
  }

  // Protected routes — require auth
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = (user.user_metadata?.role as string | undefined)?.toLowerCase();

  // Client trying to access team routes
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/projects")) {
    if (role === "client") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }

  // Team trying to access client route
  if (pathname.startsWith("/portal")) {
    if (role !== "client") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
