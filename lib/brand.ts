/**
 * The brand's retro-print hues. Used decoratively (repo chips, the /brand ramp
 * page) — never to carry status meaning, which is the job of the status colours.
 */
export interface BrandHue {
  name: string;
  hue: number;
  chroma: number;
}

export const BRAND_HUES: BrandHue[] = [
  { name: "vermilion", hue: 32, chroma: 0.19 },
  { name: "flame", hue: 55, chroma: 0.16 },
  { name: "gold", hue: 88, chroma: 0.14 },
  { name: "fern", hue: 150, chroma: 0.14 },
  { name: "teal", hue: 190, chroma: 0.1 },
  { name: "cobalt", hue: 258, chroma: 0.15 },
  { name: "iris", hue: 300, chroma: 0.15 },
  { name: "rose", hue: 350, chroma: 0.13 },
];

/** A representative colour for a hue, cycled by index. */
export function brandColor(index: number, lightness = 0.62): string {
  const h = BRAND_HUES[index % BRAND_HUES.length];
  return `oklch(${lightness} ${h.chroma} ${h.hue})`;
}
