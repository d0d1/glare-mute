import { StatusChip, levelToStatus } from "../../components/StatusChip";
import type { RuntimeEvent } from "../../lib/contracts";

export function LogItem({ event }: { event: RuntimeEvent }) {
  return (
    <article className="log-item">
      <div className="log-meta">
        <StatusChip label={event.level} status={levelToStatus(event.level)} />
        <span>{event.source}</span>
        <span>{event.timestamp}</span>
      </div>
      <p className="body-copy">{event.message}</p>
    </article>
  );
}
