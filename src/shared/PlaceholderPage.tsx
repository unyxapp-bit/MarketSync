import type { LucideIcon } from "lucide-react";

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-icon">
        <Icon size={26} />
      </div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <span className="placeholder-badge">Em construção</span>
    </section>
  );
}
