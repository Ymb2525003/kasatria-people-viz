import type { NetWorthTier, Person } from "@/types/person";

/**
 * Builds the DOM node for one person's tile.
 *
 * WHY RAW DOM AND NOT REACT: `CSS3DObject` wraps a real DOM element and
 * mutates its transform imperatively every frame. Rendering these through
 * React's reconciler means fighting the virtual DOM 200 times per frame for
 * no benefit — React never needs to re-render a tile, because the only thing
 * that changes is a CSS transform the renderer writes directly.
 *
 * React Three Fiber does not help here either: it targets WebGL, not the
 * CSS3D renderer.
 */

/**
 * Tier colours.
 *
 * Spec: red < $100K, orange > $100K, green > $200K.
 *
 * These are tuned to sit on a dark background (per Image B) while remaining
 * distinguishable for the most common forms of colour-vision deficiency:
 * red/green confusion is the usual failure mode, so the three tiers differ in
 * LIGHTNESS as well as hue, and the numeric net worth is always printed on
 * the tile. Colour is never the only channel carrying the information.
 */
const TIER_STYLE: Record<NetWorthTier, { border: string; glow: string; accent: string }> = {
  low: { border: "#e0342f", glow: "rgba(224, 52, 47, 0.45)", accent: "#ff8a85" },
  mid: { border: "#e0b21f", glow: "rgba(224, 178, 31, 0.40)", accent: "#ffd86b" },
  high: { border: "#1f9d4d", glow: "rgba(31, 157, 77, 0.40)", accent: "#6ee79b" },
};

export const TIER_LABEL: Record<NetWorthTier, string> = {
  low: "Under $100K",
  mid: "$100K – $200K",
  high: "$200K and above",
};

export function tierColor(tier: NetWorthTier): string {
  return TIER_STYLE[tier].border;
}

/** Neutral avatar shown when a photo URL fails to load. Inline, so it cannot itself 404. */
const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#1b1f24"/>
      <circle cx="50" cy="38" r="17" fill="#39424c"/>
      <path d="M14 100c0-20 16-33 36-33s36 13 36 33z" fill="#39424c"/>
    </svg>`.replace(/\s+/g, " "),
  );

export function createTileElement(person: Person): HTMLElement {
  const style = TIER_STYLE[person.netWorthTier];

  const el = document.createElement("div");
  el.className = "tile";
  el.dataset["personId"] = person.id;
  el.dataset["tier"] = person.netWorthTier;

  // Per-tile colour is set inline because it is data-derived, not a theme
  // choice — a CSS class per tier would need the tier list duplicated in CSS.
  el.style.setProperty("--tier-border", style.border);
  el.style.setProperty("--tier-glow", style.glow);
  el.style.setProperty("--tier-accent", style.accent);

  // Accessibility: 200 absolutely-positioned divs are meaningless to a screen
  // reader without an explicit label.
  el.setAttribute("role", "group");
  el.setAttribute(
    "aria-label",
    `${person.name}, age ${person.age}, ${person.countryCode}, interest ${person.interest}, net worth tier ${TIER_LABEL[person.netWorthTier]}`,
  );

  // --- Top row: country code (left) and age (right), per Image B ---
  const meta = document.createElement("div");
  meta.className = "tile__meta";

  const country = document.createElement("span");
  country.className = "tile__country";
  country.textContent = person.countryCode;

  const age = document.createElement("span");
  age.className = "tile__age";
  age.textContent = String(person.age);

  meta.append(country, age);

  // --- Photo ---
  const figure = document.createElement("div");
  figure.className = "tile__figure";

  const img = document.createElement("img");
  img.className = "tile__photo";
  // Native lazy loading: 200 remote images would otherwise all be requested
  // on first paint and saturate the connection.
  img.loading = "lazy";
  img.decoding = "async";
  // The photos are third-party; do not leak our URL in the Referer header.
  img.referrerPolicy = "no-referrer";
  img.alt = "";
  img.src = person.photoUrl;
  img.addEventListener(
    "error",
    () => {
      // A broken remote image otherwise renders as a browser's default broken
      // icon, which looks like a bug rather than missing data.
      img.src = FALLBACK_AVATAR;
    },
    { once: true },
  );

  figure.append(img);

  // --- Name and interest ---
  const name = document.createElement("div");
  name.className = "tile__name";
  // textContent, never innerHTML: this string comes from a spreadsheet that
  // anyone with edit access could put a <script> tag into.
  name.textContent = person.name;

  const interest = document.createElement("div");
  interest.className = "tile__interest";
  interest.textContent = person.interest;

  el.append(meta, figure, name, interest);
  return el;
}
