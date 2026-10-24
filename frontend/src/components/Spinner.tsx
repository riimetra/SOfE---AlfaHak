export default function Spinner({ text = "Загрузка…" }: { text?: string }) {
  return <p className="muted" role="status">{text}</p>;
}
