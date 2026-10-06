import { cn } from "@/lib/utils";

const TONES = ["#b4532a", "#5e6b4f", "#8a5a8c", "#3f6b7a", "#a07a2c"];

function hashIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % TONES.length;
}

export function initialsOf(first?: string | null, last?: string | null): string {
  const f = (first || "").trim();
  const l = (last || "").trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  const one = (f || l).trim();
  return (one.slice(0, 2) || "?").toUpperCase();
}

interface AvatarProps {
  id?: string;
  first?: string | null;
  last?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ id, first, last, size = 56, className }: AvatarProps) {
  const tone = TONES[hashIndex(id || `${first}${last}` || "x")];
  const fontSize = Math.round(size * 0.38);
  return (
    <div
      className={cn("rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none", className)}
      style={{ width: size, height: size, background: tone, fontSize }}
      aria-hidden
    >
      {initialsOf(first, last)}
    </div>
  );
}
