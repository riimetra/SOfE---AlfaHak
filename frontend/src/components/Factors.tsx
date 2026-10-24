export default function Factors({ factors }: { factors: [string, number][] }) {
  if (!factors.length) return <p className="muted">Значимых факторов не выявлено.</p>;
  return (
    <ul className="factors">
      {factors.map(([name, delta]) => (
        <li key={name} className={delta >= 0 ? "plus" : "minus"}>
          <span>{delta >= 0 ? "▲" : "▼"} {name}</span>
          <b>{delta > 0 ? `+${delta}` : delta}</b>
        </li>
      ))}
    </ul>
  );
}
