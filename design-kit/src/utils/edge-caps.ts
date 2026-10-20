/**
 * The corner pieces every card starts with (card.css explains them).
 *
 * In HTML or a template, write EDGE_CAPS_HTML as the card's first child.
 * In a component framework, render the same markup in your Card component.
 * For server-rendered or plain pages, addEdgeCaps() adds it to every .card
 * that lacks it.
 */

import {html} from 'lit';

export const EDGE_CAPS_HTML =
  '<span class="edge-caps" aria-hidden="true"><i class="cap-top"><b class="tl"></b><b class="tr"></b></i><span class="own"><b class="tl"></b><b class="tr"></b><b class="bl"></b><b class="br"></b></span><i class="cap-bottom"><b class="bl"></b><b class="br"></b></i></span>';

/** The same markup as a Lit template. */
export const edgeCaps = html`<span class="edge-caps" aria-hidden="true"><i class="cap-top"><b class="tl"></b><b class="tr"></b></i><span class="own"><b class="tl"></b><b class="tr"></b><b class="bl"></b><b class="br"></b></span><i class="cap-bottom"><b class="bl"></b><b class="br"></b></i></span>`;

/** Adds the corner pieces to every card under `root` that lacks them. */
export function addEdgeCaps(root: ParentNode = document) {
  for (const card of root.querySelectorAll('.card')) {
    if (!card.querySelector(':scope > .edge-caps')) {
      card.insertAdjacentHTML('afterbegin', EDGE_CAPS_HTML);
    }
  }
}
