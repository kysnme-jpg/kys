import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const variantClasses: Record<string, string> = {
  default: "bg-chip text-[var(--chip-ink)]",
  success: "bg-[var(--ok-bg)] text-[var(--ok-ink)]",
  warning: "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
  danger: "bg-[var(--danger-bg)] text-[var(--danger-ink)]",
  info: "bg-chip text-accent",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", variantClasses[variant], className)}>
      {children}
    </span>
  );
}
