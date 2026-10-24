export const money = (v: number | string | null | undefined) =>
  v == null ? "—" : `${Math.round(Number(v)).toLocaleString("ru-RU")} ₽`;

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

/** Ежемесячный аннуитетный платёж — та же формула, что в backend/app/services/decision.py */
export function annuity(amount: number, ratePercent: number, months: number): number {
  const r = ratePercent / 100 / 12;
  if (!months) return 0;
  if (r === 0) return amount / months;
  return (amount * r) / (1 - Math.pow(1 + r, -months));
}

export interface ScheduleRow { n: number; payment: number; interest: number; principal: number; rest: number }

export function schedule(amount: number, ratePercent: number, months: number): ScheduleRow[] {
  const r = ratePercent / 100 / 12;
  const payment = annuity(amount, ratePercent, months);
  const rows: ScheduleRow[] = [];
  let rest = amount;
  for (let n = 1; n <= months; n++) {
    const interest = rest * r;
    const principal = n === months ? rest : payment - interest;
    rest = Math.max(0, rest - principal);
    rows.push({ n, payment: principal + interest, interest, principal, rest });
  }
  return rows;
}

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};
