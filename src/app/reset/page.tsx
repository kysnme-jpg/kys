"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, CheckCircle, Loader2 } from "lucide-react";

export default function ResetPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token || !email || !password) { setError("Please fill in every field."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }

    setSubmitting(true);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim(), email: email.trim(), newPassword: password }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error || "Reset failed."); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  };

  const inputClass =
    "w-full h-11 rounded-lg border border-gray-600 bg-gray-800 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Store className="h-8 w-8 text-indigo-400" />
          <span className="text-2xl font-bold text-white">ConsignPro</span>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8">
          {done ? (
            <div className="text-center py-6">
              <div className="h-14 w-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-7 w-7 text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Password updated!</h2>
              <p className="text-gray-400 text-sm mt-2">Taking you to the login page…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white">Reset your password</h1>
                <p className="text-gray-400 text-sm mt-1">Set a new password for your account.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Reset token</label>
                <input className={inputClass} value={token} onChange={(e) => setToken(e.target.value)} placeholder="The RESET_TOKEN value you set" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Your email</label>
                <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourshop.com" autoComplete="email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">New password</label>
                <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm new password</label>
                <input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" autoComplete="new-password" />
              </div>
              {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{error}</p>}
              <button type="submit" disabled={submitting} className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium transition-colors flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</> : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
