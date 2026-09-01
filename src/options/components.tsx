import type { ReactNode } from "react";

export function Toggle(props: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      disabled={props.disabled}
      className={`toggle ${props.checked ? "on" : ""} ${props.disabled ? "disabled" : ""}`}
      onClick={() => props.onChange?.(!props.checked)}
    >
      <span className="knob" />
    </button>
  );
}

export function Card({
  children,
  className = "",
  elevated = false,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <div className={`card ${elevated ? "card-elevated" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="empty-hint">{children}</p>;
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </Card>
  );
}
