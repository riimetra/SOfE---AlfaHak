import { ACTOR_LABELS, AppEvent, STATUS_LABELS } from "../api/client";
import { dateTime } from "../utils";

export default function Timeline({ events }: { events: AppEvent[] }) {
  if (!events.length) return <p className="muted">Событий пока нет.</p>;
  return (
    <ol className="timeline">
      {[...events].reverse().map((e, i) => (
        <li key={i}>
          <div>
            <b>{STATUS_LABELS[e.to_status]}</b>{" "}
            <span className="muted">· {ACTOR_LABELS[e.actor] ?? e.actor}</span>
          </div>
          {e.comment && <div className="timeline-comment">{e.comment}</div>}
          <time>{dateTime(e.created_at)}</time>
        </li>
      ))}
    </ol>
  );
}
