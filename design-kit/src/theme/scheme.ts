/**
 * Material 3 color math: a seed color becomes the full set of
 * --md-sys-color-* tokens (SchemeContent, the scheme moddy.app uses).
 * Runs at build time for the seeds (scripts/build.mjs) and in the browser
 * for a custom color.
 */

import {
  argbFromHex,
  Hct,
  hexFromArgb,
  MaterialDynamicColors,
  SchemeContent,
} from '@material/material-color-utilities';

/** Token name (after --md-sys-color-) → its dynamic color. */
const ROLES = {
  background: MaterialDynamicColors.background,
  'on-background': MaterialDynamicColors.onBackground,
  surface: MaterialDynamicColors.surface,
  'surface-dim': MaterialDynamicColors.surfaceDim,
  'surface-bright': MaterialDynamicColors.surfaceBright,
  'surface-container-lowest': MaterialDynamicColors.surfaceContainerLowest,
  'surface-container-low': MaterialDynamicColors.surfaceContainerLow,
  'surface-container': MaterialDynamicColors.surfaceContainer,
  'surface-container-high': MaterialDynamicColors.surfaceContainerHigh,
  'surface-container-highest': MaterialDynamicColors.surfaceContainerHighest,
  'on-surface': MaterialDynamicColors.onSurface,
  'surface-variant': MaterialDynamicColors.surfaceVariant,
  'on-surface-variant': MaterialDynamicColors.onSurfaceVariant,
  'inverse-surface': MaterialDynamicColors.inverseSurface,
  'inverse-on-surface': MaterialDynamicColors.inverseOnSurface,
  outline: MaterialDynamicColors.outline,
  'outline-variant': MaterialDynamicColors.outlineVariant,
  shadow: MaterialDynamicColors.shadow,
  scrim: MaterialDynamicColors.scrim,
  'surface-tint': MaterialDynamicColors.surfaceTint,
  primary: MaterialDynamicColors.primary,
  'on-primary': MaterialDynamicColors.onPrimary,
  'primary-container': MaterialDynamicColors.primaryContainer,
  'on-primary-container': MaterialDynamicColors.onPrimaryContainer,
  'inverse-primary': MaterialDynamicColors.inversePrimary,
  secondary: MaterialDynamicColors.secondary,
  'on-secondary': MaterialDynamicColors.onSecondary,
  'secondary-container': MaterialDynamicColors.secondaryContainer,
  'on-secondary-container': MaterialDynamicColors.onSecondaryContainer,
  tertiary: MaterialDynamicColors.tertiary,
  'on-tertiary': MaterialDynamicColors.onTertiary,
  'tertiary-container': MaterialDynamicColors.tertiaryContainer,
  'on-tertiary-container': MaterialDynamicColors.onTertiaryContainer,
  error: MaterialDynamicColors.error,
  'on-error': MaterialDynamicColors.onError,
  'error-container': MaterialDynamicColors.errorContainer,
  'on-error-container': MaterialDynamicColors.onErrorContainer,
};

/** The tokens of a seed color, as a declaration list
 *  (`--md-sys-color-primary:#…;…`). */
export function themeTokens(seed: string, isDark: boolean): string {
  const scheme = new SchemeContent(Hct.fromInt(argbFromHex(seed)), isDark, 0);
  let tokens = '';
  for (const [name, color] of Object.entries(ROLES)) {
    tokens += `--md-sys-color-${name}:${hexFromArgb(color.getArgb(scheme))};`;
  }
  return tokens;
}

/** The theme of a seed color as a stylesheet for the document and the
 *  shadow roots that adopt it. */
export function themeCss(seed: string, isDark: boolean): string {
  return `:root,:host{${themeTokens(seed, isDark)}}`;
}

export function hctFromHex(hex: string) {
  return Hct.fromInt(argbFromHex(hex));
}

/** A color from hue [0, 360], chroma [0, 150] and tone [0, 100], clamped to
 *  sRGB. */
export function hexFromHct(hue: number, chroma: number, tone: number) {
  return hexFromArgb(Hct.from(hue, chroma, tone).toInt());
}
