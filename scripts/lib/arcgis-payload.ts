/** ArcGIS republishes coordinates with last-digit float noise (~1e-13°); 9 decimals is ~0.1 mm. */
export function canonicalArcgisPayload(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    typeof item === 'number' && !Number.isInteger(item) ? Number(item.toFixed(9)) : item);
}

export function sameArcgisPayload(left: unknown, right: unknown): boolean {
  return canonicalArcgisPayload(left) === canonicalArcgisPayload(right);
}
