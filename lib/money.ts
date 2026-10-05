/**
 * Peso formatting. The legacy dashboard rendered `$` while every other screen
 * used ₱; there is one formatter here so that cannot drift again.
 */
const pesos = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

/** Accepts the string Postgres returns for numeric(10,2), or a number. */
export function formatPeso(amount: number | string | null | undefined): string {
  return pesos.format(Number(amount ?? 0));
}
