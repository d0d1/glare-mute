export function PaneHeader({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="pane-copy">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}
