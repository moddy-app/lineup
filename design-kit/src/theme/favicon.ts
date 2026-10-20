/**
 * The favicon takes the theme's primary color. A light theme's primary is
 * very dark (tone ~40): it is lifted to a mid tone so the icon stays vivid
 * on any browser chrome.
 */

const MARK = (color: string) =>
  `<svg width="190" height="190" viewBox="0 0 190 190" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M142.39 0H94.9335L47.4565 47.4564H0V94.9129H94.9335L142.39 47.4564V0Z" fill="${color}"/><path d="M94.9335 94.9129L47.4568 142.39V189.846H94.9339L142.39 142.39H189.847V94.9128L94.9335 94.9129Z" fill="${color}"/></svg>`;

export function tintFavicon(themeCss: string) {
  const primary = themeCss.match(/--md-sys-color-primary:([^;]+);/)?.[1]?.trim();
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!primary || !link) return;
  const url = URL.createObjectURL(new Blob([MARK(liftToMidtone(primary))], {type: 'image/svg+xml'}));
  const old = link.href;
  link.href = url;
  if (old.startsWith('blob:')) URL.revokeObjectURL(old);
}

/** Clamps the lightness of a #rrggbb color to [0.50, 0.62], hue kept. */
function liftToMidtone(hex: string): string {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return hex;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (l >= 0.5 && l <= 0.62) return hex;

  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (l > 0.5 ? 2 - max - min : max + min);
    h =
      max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g ? ((b - r) / d + 2) / 6
      : ((r - g) / d + 4) / 6;
  }

  const tl = l < 0.5 ? 0.5 : 0.62;
  const q = tl < 0.5 ? tl * (1 + s) : tl + s - tl * s;
  const p = 2 * tl - q;
  const channel = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 0.5) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(channel(h + 1 / 3))}${toHex(channel(h))}${toHex(channel(h - 1 / 3))}`;
}
