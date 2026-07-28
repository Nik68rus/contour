type PanelSide = "left" | "right";

type PanelCollapseButtonProps = {
  side: PanelSide;
  label: string;
  onClick: () => void;
};

type CollapsedPanelRailProps = {
  className: string;
  side: PanelSide;
  label: string;
  icon: string;
  onExpand: () => void;
};

export function PanelCollapseButton({
  side,
  label,
  onClick,
}: PanelCollapseButtonProps) {
  return (
    <button
      className="icon-action panel-collapse-action"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}

export function CollapsedPanelRail({
  className,
  side,
  label,
  icon,
  onExpand,
}: CollapsedPanelRailProps) {
  return (
    <aside className={`${className} panel collapsed-panel`}>
      <button
        className="collapsed-panel-button"
        onClick={onExpand}
        aria-label={`Развернуть панель «${label}»`}
        title={`Развернуть панель «${label}»`}
      >
        <span className="collapsed-panel-arrow">
          {side === "left" ? "›" : "‹"}
        </span>
        <span className="collapsed-panel-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="collapsed-panel-label">{label}</span>
      </button>
    </aside>
  );
}
