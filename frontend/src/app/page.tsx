"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "./lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await login(username, password);
      window.localStorage.setItem("token", access_token);
      router.push("/dashboard");
    } catch {
      setError("Invalid credentials. Try admin / admin123");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-lg font-bold">
              S
            </div>
            <span className="text-2xl font-bold tracking-tight">Site Ops Intel</span>
          </div>
          <p className="text-muted text-sm">Factory Gate Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-semibold mb-6">Sign in</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm
                           focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-bg border border-border rounded-lg px-4 py-2.5 text-sm
                           focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && (
              <p className="text-danger text-xs bg-danger/10 border border-danger/20
                            rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-light disabled:opacity-60
                         text-white rounded-lg py-2.5 text-sm font-medium
                         transition-colors mt-2"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-xs mt-6">
          Default credentials: <span className="text-white font-mono">admin / admin123</span>
        </p>
      </div>
    </div>
  );
}
