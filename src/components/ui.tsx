import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const styles = {
    primary:
      "bg-bonnet text-white hover:bg-bonnet-hover active:bg-bonnet-active",
    secondary:
      "border border-lupine/50 bg-porcelain text-bonnet hover:bg-petal",
    danger:
      "border border-lupine/50 bg-porcelain text-bonnet hover:bg-petal",
    ghost: "border border-hairline bg-transparent text-bonnet hover:bg-petal",
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-5 py-2.5 text-sm font-medium transition-[color,background-color] duration-150 ease-out disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bonnet",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-porcelain px-3.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-bonnet focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-bonnet",
        className,
      )}
      {...props}
    />
  );
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-[var(--radius-control)] border border-hairline bg-porcelain px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-bonnet focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-bonnet",
        className,
      )}
      {...props}
    />
  );
});

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-porcelain px-3.5 text-sm text-ink outline-none transition focus:border-bonnet focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-bonnet",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-ink", className)}
      {...props}
    />
  );
}

/** Porcelain card: hairline border, flat (no shadow per brand). */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-hairline bg-porcelain p-5",
        className,
      )}
      {...props}
    />
  );
}

/** Soft status / filter pill. */
export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "blue" | "green" | "amber" | "red" | "violet";
}) {
  const tones = {
    neutral: "bg-petal text-ink ring-hairline",
    blue: "bg-petal text-bonnet ring-lupine/30",
    green: "bg-sage/30 text-sage-ink ring-sage/40",
    amber: "bg-honey/40 text-ink ring-honey",
    red: "bg-petal text-ink ring-hairline",
    violet: "bg-petal text-bonnet ring-lupine/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-0.5 text-[11px] font-medium tracking-wide ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Large page title + muted subtitle. */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Compact KPI metric card. */
export function KpiCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-medium tracking-tight text-ink">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </Card>
  );
}
