/* =========================================================================
   ICONS — one consistent 24px stroke icon set (inline SVG, currentColor) used across HUD, console and menus.
   ========================================================================= */
const P = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.6l5.8-.8z"/>',
  spark: '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  gamepad: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M7 10v4M5 12h4"/><circle cx="15.5" cy="11" r=".6"/><circle cx="17.5" cy="13" r=".6"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M7 5v14M17 5v14"/>',
  prev: '<path d="M18 5v14L8 12zM6 5v14"/>', next: '<path d="M6 5v14l10-7zM18 5v14"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6-2.5-2.5L11 8l3 2.5 3 1M12 15l3 6M9.5 12.5L7 14"/>',
  camera: '<path d="M3 8h4l2-2.5h6L17 8h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  ghost: '<path d="M5 20V11a7 7 0 0114 0v9l-2.3-1.6L14.3 20 12 18.4 9.7 20l-2.4-1.6z"/><circle cx="9.5" cy="11" r=".8"/><circle cx="14.5" cy="11" r=".8"/>',
  soul: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="3.5" ry="9"/>',
  candy: '<circle cx="12" cy="12" r="4"/><path d="M8.5 10L4 7v10l4.5-3M15.5 10L20 7v10l-4.5-3"/>',
  ticket: '<path d="M3 8a2 2 0 002-2h14a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H5a2 2 0 00-2-2v-2a2 2 0 000-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  firework: '<path d="M12 21v-8M12 13l-5-5M12 13l5-5M12 13V5M12 13l-7 0M12 13h7"/><circle cx="12" cy="13" r="1"/>',
  lantern: '<path d="M9 4h6M10 4v2M14 4v2M7 8h10l-1 10H8z"/><path d="M12 11v4"/>',
  crown: '<path d="M3 18h18M4 16l-1-9 5 4 4-6 4 6 5-4-1 9z"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  skull: '<path d="M5 11a7 7 0 0114 0c0 2.6-1.2 4-2.5 4.8V19h-9v-3.2C6.2 15 5 13.6 5 11z"/><circle cx="9.3" cy="11.5" r="1.5"/><circle cx="14.7" cy="11.5" r="1.5"/><path d="M11 19v-2M13 19v-2"/>',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 000-6H10a3 3 0 010-6h6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
  access: '<circle cx="12" cy="4.5" r="1.8"/><path d="M5 8l7 1.5L19 8M12 9.5V14l-3 7M12 14l3 7"/>',
  reset: '<path d="M4 12a8 8 0 102.3-5.7M4 4v4h4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  arrow: '<path d="M12 3l7 18-7-4-7 4z"/>',
  hand: '<path d="M8 13V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L3.8 13a1.5 1.5 0 012.6-1.5L8 14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4M12 14v4M8 21h8M9 18h6"/>',
};
function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.info}</svg>`;
}
export { icon };
