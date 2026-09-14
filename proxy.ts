import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routing only. The proxy decides where a request goes based on the JWT's
// app_metadata.role (server-set, verified locally via getClaims — no network
// round-trip). Real authorization happens in lib/auth against profiles.role.
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

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  const role = (claims?.app_metadata?.role as string | undefined)?.toUpperCase();
  const isClient = role === "CLIENT";

  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    if (claims) {
      return NextResponse.redirect(new URL(isClient ? "/portal" : "/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // Protected routes — require auth
  if (!claims) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Client trying to access team routes
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/projects")) {
    if (isClient) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }

  // Team trying to access client route
  if (pathname.startsWith("/portal")) {
    if (!isClient) {
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
