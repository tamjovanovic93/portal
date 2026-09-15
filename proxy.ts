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

  // /auth/* are mechanism routes (OAuth / recovery callback, sign-out), not
  // pages. They must run even when a session already exists — bouncing them
  // home would strand a user whose profile is missing or deactivated, and
  // would swallow a password-recovery link for someone already signed in.
  if (pathname.startsWith("/auth")) {
    return supabaseResponse;
  }

  // Login bounces a signed-in user to their home.
  if (pathname.startsWith("/login")) {
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
    // /api is excluded on purpose. Every route under it authenticates itself
    // (getSessionUser for uploads and downloads, x-ai-job-secret for
    // /api/ai/run, Bearer CRON_SECRET for /api/ai/sweep). Routing them through
    // this proxy redirected server-to-server callers to /login, which silently
    // stopped every AI job and the sweep cron from ever running.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
