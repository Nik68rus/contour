import type { ReactNode } from "react";

type PanelHeadingProps = {
  eyebrow: string;
  title: string;
  className?: string;
  children?: ReactNode;
};

export function PanelHeading({
  eyebrow,
  title,
  className = "",
  children,
}: PanelHeadingProps) {
  return (
    <div className={`panel-heading ${className}`}>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
