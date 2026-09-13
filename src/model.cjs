const COUNTS = [1, 2, 4, 6];
const APPEARANCES = ['system', 'dark', 'light'];
const HOME = 'https://discord.com/channels/@me';
const ID = '[1-9][0-9]{16,19}';
const CHANNEL = new RegExp(`^https://discord\\.com/channels/(?:@me(?:/${ID})?|${ID}/${ID})(?:/${ID})?$`);
function channelURL(v) { return typeof v === 'string' && v.length <= 240 && CHANNEL.test(v) ? v : null; }
function safeURL(v) {
  if (typeof v !== 'string' || v.length > 8192 || /[\s\\\x00-\x1f\x7f]/.test(v)) return null;
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u : null; } catch { return null; }
}
function navigationAllowed(v) { const u = safeURL(v); return !!u && /^https:\/\/discord\.com(?:\/|$)/.test(v) && u.origin === 'https://discord.com'; }
function externalURL(v) { return safeURL(v) ? v : null; }
function defaultState() { return { version: 1, count: 1, appearance: 'system', themeDiscord: true, zoom: 1, panes: Array.from({ length: 6 }, (_, i) => ({ url: i === 0 ? HOME : null, label: '' })) }; }
function validZoom(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0.65 && v <= 1.25; }
function normalizeState(raw) {
  const s = defaultState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return s;
  if (COUNTS.includes(raw.count)) s.count = raw.count;
  if (APPEARANCES.includes(raw.appearance)) s.appearance = raw.appearance;
  if (typeof raw.themeDiscord === 'boolean') s.themeDiscord = raw.themeDiscord;
  if (validZoom(raw.zoom)) s.zoom = raw.zoom;
  if (Array.isArray(raw.panes)) s.panes = s.panes.map((_, i) => ({ url: channelURL(raw.panes[i]?.url), label: typeof raw.panes[i]?.label === 'string' ? raw.panes[i].label.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 80) : '' }));
  return s;
}
function paneIndex(v) { if (!Number.isInteger(v) || v < 0 || v >= 6) throw new Error('Choose a valid pane.'); return v; }
function reduceState(state, action) {
  const next = normalizeState(state);
  if (!action || typeof action !== 'object') throw new Error('Invalid action.');
  switch (action.type) {
    case 'layout': if (!COUNTS.includes(action.count)) throw new Error('Choose 1, 2, 4 or 6 panes.'); next.count = action.count; break;
    case 'assign': {
      const i = paneIndex(action.index), url = channelURL(action.url);
      if (!url) throw new Error('Use a full https://discord.com/channels/… link, without query parameters.');
      const label = action.label ?? '';
      if (typeof label !== 'string' || label.length > 80 || /[\x00-\x1f\x7f]/.test(label)) throw new Error('Use a label of at most 80 characters.');
      next.panes[i] = { url, label }; break;
    }
    case 'clear': next.panes[paneIndex(action.index)] = { url: null, label: '' }; break;
    case 'appearance': if (!APPEARANCES.includes(action.value)) throw new Error('Invalid appearance.'); next.appearance = action.value; break;
    case 'theme-discord': if (typeof action.value !== 'boolean') throw new Error('Invalid chat theme.'); next.themeDiscord = action.value; break;
    case 'zoom': if (!validZoom(action.value)) throw new Error('Page scale must be between 65% and 125%.'); next.zoom = action.value; break;
    default: throw new Error('Unknown workspace action.');
  }
  return next;
}
function layoutRects(width, height, count, focus = null) {
  if (!COUNTS.includes(count)) throw new Error('Invalid layout.');
  const indices = focus === null ? Array.from({ length: count }, (_, i) => i) : [paneIndex(focus)];
  const n = indices.length, cols = n === 6 ? 3 : n === 1 ? 1 : 2, rows = n > 2 ? 2 : 1;
  const pad = 10, gap = 8, top = 64, bottom = 28, header = 40;
  const w = Math.max(width, 320) - pad * 2 - gap * (cols - 1), h = Math.max(height, 240) - top - bottom - gap * (rows - 1);
  return indices.map((index, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + Math.floor(w * col / cols) + gap * col, y = top + Math.floor(h * row / rows) + gap * row;
    const fw = Math.floor(w * (col + 1) / cols) - Math.floor(w * col / cols), fh = Math.floor(h * (row + 1) / rows) - Math.floor(h * row / rows);
    return { index, frame: { x, y, width: fw, height: fh }, content: { x: x + 1, y: y + header, width: fw - 2, height: fh - header - 1 } };
  });
}
module.exports = { COUNTS, HOME, channelURL, navigationAllowed, externalURL, defaultState, normalizeState, reduceState, layoutRects, paneIndex };
