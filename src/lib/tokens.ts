/**
 * Every color in the UI is a CSS custom property on `:root` in `src/index.css`, so the
 * design team restyles the page without touching TypeScript. DOM styles and SVG
 * presentation attributes take `var(--token)` directly; MapLibre parses paint colors
 * with its own CSS color parser, which does not understand `var()`, so map paint has to
 * read the resolved value out of the cascade instead.
 *
 * The value is read when the caller runs — for the map, when a layer is created. A token
 * edited afterwards (CSS hot update, devtools) repaints the strip chart and legend at
 * once but leaves the map on the values it captured until the map is re-created.
 */
export function resolveColor(token: `--${string}`): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (value === '') throw new Error(`CSS color token ${token} is not defined on :root`);
  return value;
}
