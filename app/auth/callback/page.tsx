"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const next = params.get("next") ?? "/";

    async function handle() {
      if (code) {
        // PKCE flow — exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace(next);
          return;
        }
      }

      // Implicit flow — tokens arrive in the URL hash; getSession() picks them up
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.replace(next);
        return;
      }

      router.replace("/login?error=link_expired");
    }

    handle();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <p className="text-sm text-neutral-500">Signing you in…</p>
    </div>
  );
}
