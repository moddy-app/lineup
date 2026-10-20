/**
 * The corner pieces every card starts with (design-kit/src/css/card.css
 * explains them). Same markup as the kit's EDGE_CAPS_HTML. Card renders it as
 * its first child; use it directly only for a card made by hand.
 */
export function EdgeCaps() {
  return (
    <span className="edge-caps" aria-hidden="true">
      <i className="cap-top">
        <b className="tl" />
        <b className="tr" />
      </i>
      <span className="own">
        <b className="tl" />
        <b className="tr" />
        <b className="bl" />
        <b className="br" />
      </span>
      <i className="cap-bottom">
        <b className="bl" />
        <b className="br" />
      </i>
    </span>
  );
}
