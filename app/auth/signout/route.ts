import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Clear the session and land on the login page.
//
// This exists so a signed-in user whose profile is missing or deactivated can
// get out. Without it they loop: the layout sees no usable profile and sends
// them to /login, the proxy sees a valid token and sends them back. Ending the
// session breaks the cycle. Safe to hit with no session — sign-out is a no-op.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
