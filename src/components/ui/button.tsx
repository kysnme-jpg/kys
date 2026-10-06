import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full font-semibold transition-[background-color,transform,color] active:scale-[.98] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-45 disabled:active:scale-100 select-none",
  {
    variants: {
      variant: {
        // accent primary
        default: "bg-accent text-[var(--accent-ink)] hover:brightness-95",
        primary: "bg-accent text-[var(--accent-ink)] hover:brightness-95 font-bold",
        // light-surface secondary
        outline: "bg-surface border-[1.5px] border-line text-ink hover:bg-chip",
        secondary: "bg-chip text-ink hover:brightness-95",
        ghost: "text-ink hover:bg-chip",
        link: "text-accent underline-offset-4 hover:underline",
        // dark on light
        dark: "bg-ink text-[var(--panel-ink)] hover:brightness-110",
        onDark: "bg-transparent border-[1.5px] border-[var(--panel-line)] text-[var(--panel-ink)] hover:bg-[var(--panel-key)]",
        // states
        success: "bg-[var(--ok-bg)] text-[var(--ok-ink)] hover:brightness-95",
        destructive: "bg-[var(--danger-bg)] text-[var(--danger-ink)] hover:brightness-95",
        danger: "bg-[var(--danger-bg)] text-[var(--danger-ink)] hover:brightness-95",
      },
      size: {
        default: "h-11 px-5 text-[15px]",
        sm: "h-9 px-4 text-sm",
        lg: "h-[60px] px-8 text-[17px]",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
