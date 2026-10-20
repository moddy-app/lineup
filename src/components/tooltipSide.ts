/**
 * Keeps a kit tooltip (data-tooltip) inside the card it is in. The kit centers
 * a tooltip under its target; a target near the left or right edge of a card
 * would have it cut by the card's `overflow: clip`. On pointer enter and focus
 * this marks the target `data-tip-side="start" | "end" | "center"`, and
 * lineup.css aligns the tooltip to that side.
 */

import type {SyntheticEvent} from 'react';

export function alignTooltip(event: SyntheticEvent<HTMLElement>): void {
  const target = event.currentTarget;
  const container = target.closest<HTMLElement>('.card, md-dialog, .page');
  const bounds = container?.getBoundingClientRect();
  const left = Math.max(0, bounds?.left ?? 0);
  const right = Math.min(window.innerWidth, bounds?.right ?? window.innerWidth);
  const box = target.getBoundingClientRect();
  const position = (box.left + box.width / 2 - left) / Math.max(1, right - left);
  target.dataset.tipSide = position > 0.6 ? 'end' : position < 0.4 ? 'start' : 'center';
}

/** The props to spread on a tooltip target. */
export const tooltipSideProps = {onPointerEnter: alignTooltip, onFocus: alignTooltip} as const;
