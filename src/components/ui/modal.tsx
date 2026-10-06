"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/45 z-40 animate-in fade-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "bg-surface rounded-[28px] w-full max-h-[90vh] overflow-y-auto",
            "border-[1.5px] border-line focus:outline-none",
            "shadow-[0_8px_24px_rgba(60,40,20,.12)]",
            className
          )}
        >
          <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-line-soft sticky top-0 bg-surface z-10">
            <Dialog.Title className="font-serif text-[28px] leading-tight text-ink">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-full p-2 hover:bg-chip transition-colors -mr-1" aria-label="Close">
                <X className="h-5 w-5 text-[var(--muted)]" />
              </button>
            </Dialog.Close>
          </div>
          <div className="px-7 py-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
