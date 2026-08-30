/**
 * The brand's retro-print hues. Decorative only: repo chips read as identity,
 * and status meaning is carried by the status colours instead.
 */
interface BrandHue {
  name: string;
  hue: number;
  chroma: number;
}

const BRAND_HUES: BrandHue[] = [
  { name: "vermilion", hue: 32, chroma: 0.19 },
  { name: "flame", hue: 55, chroma: 0.16 },
  { name: "gold", hue: 88, chroma: 0.14 },
  { name: "fern", hue: 150, chroma: 0.14 },
  { name: "teal", hue: 190, chroma: 0.1 },
  { name: "cobalt", hue: 258, chroma: 0.15 },
  { name: "iris", hue: 300, chroma: 0.15 },
  { name: "rose", hue: 350, chroma: 0.13 },
];

/**
 * Repo chips read as identity rather than status, but vermilion/gold/fern/rose double as
 * the status pill colours (rejected/superseded/accepted-ish/deprecated), so a repo
 * chip in those hues could be misread as carrying status meaning. Restricted to the
 * three hues the status palette doesn't use: iris, cobalt, teal.
 */
const REPO_CHIP_HUES = BRAND_HUES.filter((h) =>
  ["iris", "cobalt", "teal"].includes(h.name),
);

export function repoChipColor(index: number, lightness = 0.62): string {
  const h = REPO_CHIP_HUES[index % REPO_CHIP_HUES.length];
  return `oklch(${lightness} ${h.chroma} ${h.hue})`;
}
