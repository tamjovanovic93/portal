"use client";

import { useState } from "react";
import { login, requestPasswordReset } from "@/app/actions/auth";

export default function LoginPage() {
  const [view, setView] = useState<"login" | "reset">("login");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    const result = await requestPasswordReset(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess("Check your email for a link to set your password.");
    }
    setLoading(false);
  }

  function switchView(v: "login" | "reset") {
    setView(v);
    setError(null);
    setSuccess(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Zero-Point
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {view === "login" ? "Sign in to your portal" : "Reset your password"}
          </p>
        </div>

        {view === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-neutral-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-neutral-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-center text-xs text-neutral-600 pt-1">
              <button
                type="button"
                onClick={() => switchView("reset")}
                className="hover:text-neutral-700 transition-colors underline underline-offset-2"
              >
                Forgot password?
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label
                htmlFor="reset-email"
                className="block text-sm font-medium text-neutral-700 mb-1"
              >
                Email address
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-center text-xs text-neutral-600 pt-1">
              <button
                type="button"
                onClick={() => switchView("login")}
                className="hover:text-neutral-700 transition-colors underline underline-offset-2"
              >
                Back to sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
