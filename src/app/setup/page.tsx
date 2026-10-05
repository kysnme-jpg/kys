"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Store, CheckCircle, Loader2 } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => { setNeedsSetup(!!d.needsSetup); setChecking(false); })
      .catch(() => { setError("Couldn't reach the server."); setChecking(false); });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!storeName.trim() || !email.trim() || !password) {
      setError("Please fill in every field.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeName: storeName.trim(), email: email.trim(), password }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) { setError(data.error || "Setup failed. Please try again."); return; }
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
          {checking ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : done ? (
            <div className="text-center py-6">
              <div className="h-14 w-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-7 w-7 text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">You're all set!</h2>
              <p className="text-gray-400 text-sm mt-2">Taking you to the login page…</p>
            </div>
          ) : !needsSetup ? (
            <div className="text-center py-6">
              <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-white">Already set up</h2>
              <p className="text-gray-400 text-sm mt-2">
                This store already has an owner account.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="mt-5 w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                Go to login
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white">Welcome — let's set up your shop</h1>
                <p className="text-gray-400 text-sm mt-1">Create your owner account. This runs once.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Store name</label>
                <input className={inputClass} value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. Maple Street Consignment" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Your email</label>
                <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourshop.com" autoComplete="email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm password</label>
                <input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" autoComplete="new-password" />
              </div>

              {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create my account"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Your consignment platform
        </p>
      </div>
    </div>
  );
}
