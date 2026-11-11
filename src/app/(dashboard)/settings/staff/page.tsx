"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Lock, KeyRound, Shield, UserCheck, UserX, Trash2, Copy, Check } from "lucide-react";

interface StaffUser {
  id: string; name: string | null; email: string | null; phone: string | null;
  role: string; active: boolean; lastLoginAt: string | null; isSelf: boolean;
}
interface RoleInfo { role: string; label: string; blurb: string; permissions: { key: string; label: string }[]; }
interface Identity { key: string; label: string; blurb: string; }

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
  { value: "inventory_clerk", label: "Inventory clerk" },
];
const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label || r;

export default function StaffPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"staff" | "roles">("staff");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [adding, setAdding] = useState(false);
  const [cred, setCred] = useState<{ email: string; password: string; title: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/staff/users").then((r) => {
      if (r.status === 401 || r.status === 403) { setAllowed(false); return null; }
      setAllowed(true); return r.json();
    }).then((d) => { if (d) setUsers(d.users || []); });
    fetch("/api/staff/roles").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setRoles(d.roles || []); setIdentities(d.identities || []); } });
  }, []);
  useEffect(() => { load(); }, [load]);

  const setRole = async (u: StaffUser, role: string) => {
    const res = await fetch(`/api/staff/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Couldn't change role."); }
    load();
  };
  const toggleActive = async (u: StaffUser) => {
    const res = await fetch(`/api/staff/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !u.active }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Couldn't update."); }
    load();
  };
  const resetPw = async (u: StaffUser) => {
    if (!confirm(`Reset ${u.name || u.email}'s password? Their old one stops working.`)) return;
    const res = await fetch(`/api/staff/users/${u.id}/password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setCred({ email: d.email, password: d.tempPassword, title: "New password set" });
    else alert(d.error || "Couldn't reset.");
  };
  const remove = async (u: StaffUser) => {
    if (!confirm(`Remove ${u.name || u.email}? Their account is deactivated (history is kept).`)) return;
    const res = await fetch(`/api/staff/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Couldn't remove."); }
    load();
  };

  if (allowed === false) {
    return (
      <div className="px-11 pt-9 pb-6 max-[767px]:px-5 max-[767px]:pt-6">
        <div className="max-w-md mx-auto text-center py-16">
          <Lock className="h-10 w-10 text-[var(--muted)] mx-auto" />
          <h1 className="font-serif text-[24px] text-ink mt-4">Staff & roles are owner-only</h1>
          <p className="text-[15px] text-[var(--muted)] mt-2">Only the store owner can manage staff accounts and roles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-11 pt-9 pb-6 space-y-6 max-[767px]:px-5 max-[767px]:pt-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-[30px] text-ink flex items-center gap-2.5"><Users className="h-7 w-7 text-accent" /> Staff & roles</h1>
          <p className="text-[15px] text-[var(--muted)] mt-1">Manage who can sign in, their role, and their passwords.</p>
        </div>
        {tab === "staff" && <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-full bg-accent text-[var(--accent-ink)] font-bold px-5 py-2.5"><Plus className="h-5 w-5" /> Add staff</button>}
      </div>

      <div className="inline-flex gap-1 bg-chip rounded-full p-1">
        {([["staff", "Staff accounts"], ["roles", "Roles & access"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-[14px] font-semibold ${tab === t ? "bg-surface text-ink shadow-sm" : "text-[var(--muted)]"}`}>{l}</button>
        ))}
      </div>

      {tab === "staff" ? (
        <div className="space-y-2 max-w-3xl">
          {users.map((u) => (
            <div key={u.id} className={`rounded-2xl border-[1.5px] border-line bg-surface p-4 ${!u.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[16px] text-ink">{u.name || "(no name)"}</span>
                    {u.isSelf && <span className="text-[11px] font-bold uppercase bg-chip text-[var(--muted)] rounded-full px-2 py-0.5">You</span>}
                    {!u.active && <span className="text-[11px] font-bold uppercase bg-chip text-[var(--muted)] rounded-full px-2 py-0.5">Inactive</span>}
                  </div>
                  <div className="text-[13.5px] text-[var(--muted)] mt-0.5">{u.email}{u.phone ? ` · ${u.phone}` : ""}</div>
                  <div className="text-[12px] text-[var(--muted)] mt-0.5">{u.lastLoginAt ? `Last signed in ${new Date(u.lastLoginAt).toLocaleDateString()}` : "Never signed in"}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={u.role} onChange={(e) => setRole(u, e.target.value)} className="rounded-full border-[1.5px] border-line bg-surface px-3 py-1.5 text-[13.5px] font-semibold text-ink">
                    {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button onClick={() => resetPw(u)} title="Reset password" className="rounded-full p-2 hover:bg-chip"><KeyRound className="h-4 w-4 text-[var(--muted)]" /></button>
                  <button onClick={() => toggleActive(u)} title={u.active ? "Deactivate" : "Reactivate"} className="rounded-full p-2 hover:bg-chip">{u.active ? <UserX className="h-4 w-4 text-[var(--muted)]" /> : <UserCheck className="h-4 w-4 text-green-600" />}</button>
                  {!u.isSelf && <button onClick={() => remove(u)} title="Remove" className="rounded-full p-2 hover:bg-chip"><Trash2 className="h-4 w-4 text-[var(--danger-ink)]" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <div>
            <h2 className="font-serif text-[20px] text-ink mb-2 flex items-center gap-2"><Shield className="h-5 w-5 text-accent" /> What each role can do</h2>
            <div className="space-y-2">
              {roles.map((r) => (
                <div key={r.role} className="rounded-2xl border-[1.5px] border-line bg-surface p-4">
                  <div className="font-semibold text-[15.5px] text-ink">{r.label}</div>
                  <div className="text-[13.5px] text-[var(--muted)] mt-0.5">{r.blurb}</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.permissions.length === 0 ? <span className="text-[12.5px] text-[var(--muted)]">Portal/basic access</span> :
                      r.permissions.map((p) => <span key={p.key} className="text-[12px] font-semibold rounded-full bg-chip text-ink px-2.5 py-1">{p.label}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-serif text-[20px] text-ink mb-2">Account types</h2>
            <div className="grid sm:grid-cols-3 gap-2">
              {identities.map((i) => (
                <div key={i.key} className="rounded-2xl border-[1.5px] border-line bg-surface p-4">
                  <div className="font-semibold text-[15px] text-ink">{i.label}</div>
                  <div className="text-[13px] text-[var(--muted)] mt-0.5 leading-snug">{i.blurb}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {adding && <AddStaff onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); setCred(c); load(); }} />}
      {cred && <CredModal cred={cred} onClose={() => setCred(null)} />}
    </div>
  );
}

function AddStaff({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { email: string; password: string; title: string }) => void }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", role: "employee" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    setBusy(true); setError("");
    const res = await fetch("/api/staff/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "Couldn't create."); return; }
    onCreated({ email: d.user.email, password: d.tempPassword, title: "Staff account created" });
  };
  return (
    <Modal title="Add staff" onClose={onClose}>
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Full name" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
      <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email (used to sign in)" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
      <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone (optional)" className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink" />
      <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink">
        {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-[14px] text-[var(--danger-ink)]">{error}</p>}
      <button onClick={create} disabled={busy} className="w-full rounded-full bg-accent text-[var(--accent-ink)] py-2.5 text-[15px] font-bold disabled:opacity-60">{busy ? "Creating…" : "Create account"}</button>
    </Modal>
  );
}

function CredModal({ cred, onClose }: { cred: { email: string; password: string; title: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { try { navigator.clipboard.writeText(`Email: ${cred.email}\nPassword: ${cred.password}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  return (
    <Modal title={cred.title} onClose={onClose}>
      <p className="text-[14px] text-[var(--muted)]">Share these sign-in details securely. The password is shown only once.</p>
      <div className="rounded-2xl bg-chip p-4 space-y-1.5">
        <div className="flex justify-between gap-3 text-[14px]"><span className="text-[var(--muted)]">Email</span><span className="font-semibold text-ink">{cred.email}</span></div>
        <div className="flex justify-between gap-3 text-[14px]"><span className="text-[var(--muted)]">Password</span><span className="font-mono font-semibold text-ink">{cred.password}</span></div>
      </div>
      <button onClick={copy} className="w-full inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-line py-2.5 text-[15px] font-semibold text-ink hover:bg-chip">{copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy details</>}</button>
      <button onClick={onClose} className="w-full rounded-full bg-accent text-[var(--accent-ink)] py-2.5 text-[15px] font-bold">Done</button>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative bg-surface w-full sm:w-[min(460px,calc(100vw-32px))] max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border-[1.5px] border-line p-5 sm:p-6 space-y-3">
        <h2 className="font-serif text-[22px] text-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
}
