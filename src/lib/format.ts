// SSR-stable number formatting (avoids locale hydration mismatches)
export function formatNumber(n: number): string {
  const s = Math.trunc(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
