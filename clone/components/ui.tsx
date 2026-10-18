import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:opacity-90",
  secondary: "bg-bg text-text border border-border-input hover:bg-surface",
  ghost: "bg-transparent text-text hover:bg-surface",
  danger: "bg-danger text-on-danger hover:opacity-90",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return `inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]}`;
}

export function Button({ variant, size, className = "", loading, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={`${buttonClass(variant, size)} ${className}`}>
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant, size, children, className = "" }: { href: string; variant?: Variant; size?: Size; children: ReactNode; className?: string }) {
  return <Link href={href} className={`${buttonClass(variant, size)} ${className}`}>{children}</Link>;
}

const FIELD = "w-full rounded-md border border-border-input bg-bg px-3 text-base text-text placeholder:text-muted disabled:opacity-50 aria-[invalid=true]:border-danger";

export function Field({ label, error, hint, id, children }: { label: string; error?: string; hint?: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function TextInput({ id, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { id: string; error?: string }) {
  return <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} className={`${FIELD} h-10`} {...rest} />;
}
export function TextArea({ id, error, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; error?: string }) {
  return <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} className={`${FIELD} py-2`} rows={3} {...rest} />;
}
export function Select({ id, error, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { id: string; error?: string }) {
  return <select id={id} aria-invalid={error ? true : undefined} className={`${FIELD} h-10`} {...rest}>{children}</select>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-bg shadow-card ${className}`}>{children}</div>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-input bg-surface px-6 py-12 text-center">
      <h2 className="text-lg">{title}</h2>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "danger", children }: { tone?: "danger" | "success"; children: ReactNode }) {
  const cls = tone === "danger" ? "border-danger text-danger" : "border-success text-success";
  return <p role={tone === "danger" ? "alert" : "status"} className={`rounded-md border bg-bg px-3 py-2 text-sm ${cls}`}>{children}</p>;
}
