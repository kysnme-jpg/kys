"use client";

import { AUDIENCE_SCOPES, INTERNAL_ROLE_OPTIONS, type AudienceScope } from "@/lib/posts";

export interface AudienceValue {
  scope: AudienceScope;
  role?: string | null;
  tag?: string | null;
}

/**
 * Reusable audience picker (§2). Chosen once here so the content feed and the
 * Phase 5 email composer target the exact same way. Pure controlled component.
 */
export function AudienceSelect({
  value,
  onChange,
  disabled,
}: {
  value: AudienceValue;
  onChange: (v: AudienceValue) => void;
  disabled?: boolean;
}) {
  const scope = value.scope;
  const scopeMeta = AUDIENCE_SCOPES.find((s) => s.value === scope);

  return (
    <div className="space-y-2.5">
      <label className="block text-[13px] font-semibold text-[var(--muted)]">Audience</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AUDIENCE_SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ scope: s.value, role: null, tag: null })}
            className={[
              "text-left rounded-2xl border-[1.5px] px-3.5 py-2.5 transition-colors",
              scope === s.value
                ? "border-accent bg-accent/5"
                : "border-line hover:bg-chip",
              disabled ? "opacity-60" : "",
            ].join(" ")}
          >
            <div className="text-[15px] font-semibold text-ink">{s.label}</div>
            <div className="text-[12px] text-[var(--muted)] leading-snug mt-0.5">{s.help}</div>
          </button>
        ))}
      </div>

      {scope === "INTERNAL_ROLE" && (
        <select
          disabled={disabled}
          value={value.role || ""}
          onChange={(e) => onChange({ scope, role: e.target.value, tag: null })}
          className="w-full rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink"
        >
          <option value="">Choose a staff role…</option>
          {INTERNAL_ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      )}

      {scope === "TAG" && (
        <div className="rounded-2xl border-[1.5px] border-dashed border-line px-3.5 py-2.5 text-[13px] text-[var(--muted)]">
          Tag-based targeting arrives in a later phase. For now, enter a tag name to reserve it — no one matches a tag until tags are enabled.
          <input
            disabled={disabled}
            value={value.tag || ""}
            onChange={(e) => onChange({ scope, role: null, tag: e.target.value })}
            placeholder="e.g. vip, fall-2026"
            className="mt-2 w-full rounded-xl border-[1.5px] border-line bg-surface px-3 py-2 text-[15px] text-ink"
          />
        </div>
      )}

      {scopeMeta && scope !== "INTERNAL_ROLE" && scope !== "TAG" && (
        <p className="text-[12px] text-[var(--muted)] px-1">{scopeMeta.help}</p>
      )}
    </div>
  );
}
