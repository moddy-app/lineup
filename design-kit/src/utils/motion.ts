/**
 * Small scripted demos for illustrations: steps appear one after the
 * other, in a loop, only while the illustration is on screen. Without
 * motion, the illustration shows its final state and nothing runs.
 *
 *   <div class="panel" data-demo="invite">
 *     <div data-at="1">…</div>          shown from step 1 (.shown)
 *     <div data-done-at="2">…</div>     .done from step 2
 *     <md-filled-button data-press-at="3">…</md-filled-button>   .pressed at step 3
 *   </div>
 *
 *   playDemo(el, [[1, 900], [2, 1200], [3, 300], [4, 2400]]);
 */

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `step` over and over while `el` is on screen and the tab visible. */
export function loopWhileVisible(el: Element, step: () => Promise<void>) {
  let visible = false;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    while (visible && !document.hidden) {
      await step();
    }
    running = false;
  };
  new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    run();
  }).observe(el);
  document.addEventListener('visibilitychange', run);
}

/** Returns a function that shows the state of `root` at a given step. */
export function stepper(root: HTMLElement) {
  const all = (attribute: string) => [...root.querySelectorAll<HTMLElement>(`[${attribute}]`)];
  const timed = all('data-at');
  const done = all('data-done-at');
  const pressed = all('data-press-at');
  return (step: number) => {
    for (const el of timed) el.classList.toggle('shown', Number(el.dataset.at) <= step);
    for (const el of done) el.classList.toggle('done', Number(el.dataset.doneAt) <= step);
    for (const el of pressed) el.classList.toggle('pressed', Number(el.dataset.pressAt) === step);
  };
}

/** Plays `timeline` ([step, pause in ms]) in a loop while on screen. */
export function playDemo(
  root: HTMLElement,
  timeline: Array<[number, number]>,
  hooks: {beforeLoop?: () => void; onStep?: (step: number) => void} = {},
) {
  const show = stepper(root);
  if (reduceMotion) {
    const last = timeline[timeline.length - 1]?.[0] ?? 0;
    show(last);
    hooks.onStep?.(last);
    return;
  }
  root.classList.add('playing');
  show(0);
  hooks.onStep?.(0);
  loopWhileVisible(root, async () => {
    hooks.beforeLoop?.();
    for (const [step, pause] of timeline) {
      show(step);
      hooks.onStep?.(step);
      await wait(pause);
    }
    root.classList.add('resetting');
    await wait(550);
    show(0);
    hooks.onStep?.(0);
    root.classList.remove('resetting');
    await wait(450);
  });
}
