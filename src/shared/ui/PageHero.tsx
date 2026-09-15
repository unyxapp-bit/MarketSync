import type { ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`flex gap-5 bg-surface border border-line rounded-lg shadow-xs px-[26px] py-5 ${
        actions ? "items-end justify-between" : "items-start"
      }`}
    >
      <div>
        <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-brand mb-2">{eyebrow}</p>
        <h1 className="text-[23px] font-bold tracking-[-0.03em] m-0 text-ink">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted mt-1.5 tracking-[-0.01em]">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-[9px]">{actions}</div>}
    </section>
  );
}
