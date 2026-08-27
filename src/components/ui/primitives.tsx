import { type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(33,31,38,0.04),0_8px_24px_-12px_rgba(33,31,38,0.18)]",
        className
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; size?: "sm" | "md" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "px-3.5 py-1.5 text-sm" : "px-5 py-2.5 text-sm";
  const variants: Record<string, string> = {
    primary: "bg-brand-700 text-white hover:opacity-90 active:scale-[0.98]",
    ghost: "border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-sunken)]",
    danger: "bg-disc-d text-white hover:opacity-90",
  };
  return <button className={cn(base, sizes, variants[variant], className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-muted)] focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={cn("mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]", className)}>{children}</label>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const badgeColors: Record<string, string> = {
  neutral: "bg-[var(--surface-sunken)] text-[var(--ink-muted)]",
  good: "bg-disc-sSoft text-disc-s",
  warn: "bg-disc-iSoft text-disc-i",
  bad: "bg-disc-dSoft text-disc-d",
  brand: "bg-brand-100 text-brand-700",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof badgeColors; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", badgeColors[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="font-display text-lg font-semibold text-[var(--ink)]">{title}</p>
      {description && <p className="max-w-sm text-sm text-[var(--ink-muted)]">{description}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 backdrop-blur-sm">
      <div className={cn("w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-[var(--ink)]">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]" aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatCard({ label, value, sub, tone = "neutral" }: { label: string; value: ReactNode; sub?: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const toneColor = { neutral: "text-[var(--ink)]", good: "text-disc-s", warn: "text-disc-i", bad: "text-disc-d" }[tone];
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
      <p className={cn("mt-2 font-display text-3xl font-semibold", toneColor)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--ink-muted)]">{sub}</p>}
    </Card>
  );
}
