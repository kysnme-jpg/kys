import { cn } from "@/lib/utils";

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-tag text-[var(--chip-ink)] text-[12px] font-semibold px-2.5 py-1", className)}>
      {children}
    </span>
  );
}
