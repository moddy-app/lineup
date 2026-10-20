/**
 * @license
 * Copyright 2026 Moddy App
 * SPDX-License-Identifier: Apache-2.0
 */

/* The main color of a picture: the only colors not taken from the theme
 * (a server tile, the Moddy Max avatar ring, a profile banner), with the
 * theme colors as fallback. The <img> must be loaded with
 * crossorigin="anonymous" from a host that allows it (Discord's CDN does),
 * or the canvas is tainted and these return null. */

/** A representative color: the average of the icon, weighted towards its
 *  most saturated pixels so a colorful logo on white does not turn grey. */
export function mainColor(img: HTMLImageElement): [number, number, number] | null {
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) return null;
  try {
    context.drawImage(img, 0, 0, size, size);
    const {data} = context.getImageData(0, 0, size, size);
    let r = 0, g = 0, b = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      const weight = 0.15 + (max === 0 ? 0 : (max - min) / max);
      r += data[i] * weight;
      g += data[i + 1] * weight;
      b += data[i + 2] * weight;
      total += weight;
    }
    if (!total) return null;
    return [r / total, g / total, b / total];
  } catch {
    return null; // tainted canvas: the caller keeps its fallback
  }
}

/** The hue (0-360) that covers the most of a picture, each pixel counting
 *  for (the square root of) its colorfulness: the background of an avatar wins over a small
 *  saturated detail, grey pixels count for nothing. Null when the picture
 *  has no clear color or cannot be read. */
export function dominantHue(img: HTMLImageElement): number | null {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) return null;
  let data: Uint8ClampedArray;
  try {
    context.drawImage(img, 0, 0, size, size);
    data = context.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }
  // 18 bins of 20°, each summing chroma and the hue vector (for its mean).
  const weight = new Array(18).fill(0);
  const x = new Array(18).fill(0);
  const y = new Array(18).fill(0);
  let pixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    pixels++;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const chroma = max - Math.min(r, g, b);
    if (chroma < 0.08) continue;
    const hue =
      max === r ? (((g - b) / chroma + 6) % 6) * 60
      : max === g ? ((b - r) / chroma + 2) * 60
      : ((r - g) / chroma + 4) * 60;
    // Square root: a large pastel background still outweighs a small,
    // more saturated detail (skin, a shirt).
    const w = Math.sqrt(chroma);
    const bin = Math.floor(hue / 20) % 18;
    weight[bin] += w;
    x[bin] += w * Math.cos((hue * Math.PI) / 180);
    y[bin] += w * Math.sin((hue * Math.PI) / 180);
  }
  let best = 0;
  for (let i = 1; i < 18; i++) if (weight[i] > weight[best]) best = i;
  // Too little color overall: a grey or black-and-white picture.
  if (!pixels || weight[best] / pixels < 0.1) return null;
  return Math.round(((Math.atan2(y[best], x[best]) * 180) / Math.PI + 360) % 360);
}
