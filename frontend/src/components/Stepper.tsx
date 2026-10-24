import { Status } from "../api/client";

const STEPS = ["Заявка", "Проверка банком", "Решение", "Подписание", "Выдача"];

function stepIndex(s: Status): number {
  switch (s) {
    case "DRAFT":
    case "INFO_REQUESTED":
      return 0;
    case "SUBMITTED":
    case "VALIDATION":
    case "ENRICHMENT":
    case "SCORING":
    case "UNDERWRITING":
      return 1;
    case "APPROVED":
    case "COUNTER_OFFER":
    case "REJECTED":
      return 2;
    case "SIGNING":
      return 3;
    case "ISSUED":
      return 4;
    default:
      return -1;
  }
}

export default function Stepper({ status }: { status: Status }) {
  const current = stepIndex(status);
  const failed = status === "REJECTED" || status === "CANCELLED";
  return (
    <ol className="stepper" aria-label="Этапы заявки">
      {STEPS.map((title, i) => {
        const state =
          status === "ISSUED" || i < current ? "done"
          : i === current ? (failed ? "failed" : "current")
          : "todo";
        return (
          <li key={title} className={`step step-${state}`} aria-current={state === "current"}>
            <span className="step-dot">{state === "done" ? "✓" : i + 1}</span>
            <span className="step-title">{title}</span>
          </li>
        );
      })}
    </ol>
  );
}
