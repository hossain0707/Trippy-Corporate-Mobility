import {t} from './locale.js';

// Icons are rendered as SVG elements, not font glyphs or password-field emoji.
function passwordIcon(revealed) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [key, value] of Object.entries({
    viewBox: '0 0 24 24', width: '19', height: '19', fill: 'none',
    stroke: 'currentColor', 'stroke-width': '1.8',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  })) svg.setAttribute(key, value);
  const outline = document.createElementNS(ns, 'path');
  outline.setAttribute('d', 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z');
  const pupil = document.createElementNS(ns, 'circle');
  pupil.setAttribute('cx', '12');
  pupil.setAttribute('cy', '12');
  pupil.setAttribute('r', '3');
  svg.append(outline, pupil);
  if (revealed) {
    const slash = document.createElementNS(ns, 'path');
    slash.setAttribute('d', 'M3 3 21 21');
    svg.append(slash);
  }
  return svg;
}

export function passwordToggle(input) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'password-toggle';
  const updateToggle = revealed => {
    const text = t(revealed ? 'Hide password' : 'Show password');
    toggle.setAttribute('aria-label', text);
    toggle.setAttribute('title', text);
    toggle.setAttribute('aria-pressed', String(revealed));
    toggle.replaceChildren(passwordIcon(revealed));
  };
  toggle.setAttribute('aria-controls', input.id);
  updateToggle(false);
  toggle.onclick = () => {
    const revealed = input.type === 'password';
    input.type = revealed ? 'text' : 'password';
    updateToggle(revealed);
  };
  return toggle;
}
