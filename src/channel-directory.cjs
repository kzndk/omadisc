const { channelURL } = require('./model.cjs');

function guildFromURL(value) {
  const valid = channelURL(value);
  if (!valid) return null;
  const [, guild] = new URL(valid).pathname.split('/channels/');
  return guild?.split('/')[0] === '@me' ? null : guild?.split('/')[0] || null;
}

function cleanLabel(value) {
  return typeof value === 'string' && !/[\x00-\x1f\x7f]/.test(value) ? value.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
}

function normalizeChannelDirectory(currentURL, raw) {
  const guild = guildFromURL(currentURL);
  if (!guild || !raw || typeof raw !== 'object' || raw.guild !== guild || !Array.isArray(raw.channels)) return { server: '', channels: [] };
  const channels = [], seen = new Set();
  for (const entry of raw.channels.slice(0, 500)) {
    const url = channelURL(entry?.url);
    if (!url || guildFromURL(url) !== guild || seen.has(url)) continue;
    seen.add(url);
    const id = new URL(url).pathname.split('/').at(-1);
    channels.push({ url, label: cleanLabel(entry.label) || `Channel ${id}` });
  }
  return { server: cleanLabel(raw.server), channels };
}

// This fixed, read-only DOM query runs in Discord's page after navigation. It
// reads the links Discord already rendered; it does not access tokens, stores,
// private APIs, or modify the remote document.
function discoverChannelDirectory() {
  const parts = location.pathname.split('/').filter(Boolean);
  const guild = parts[0] === 'channels' && /^[1-9][0-9]{16,19}$/.test(parts[1] || '') ? parts[1] : null;
  if (!guild) return { guild: null, server: '', channels: [] };
  const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 160) : '';
  const guildNode = document.querySelector(`[data-list-item-id="guildsnav___${guild}"]`);
  const server = clean(guildNode?.getAttribute('aria-label') || guildNode?.textContent || document.querySelector('[data-server-name]')?.getAttribute('data-server-name'));
  let links = [...document.querySelectorAll('[data-list-item-id^="channels___"][href], [data-list-item-id^="channels___"] a[href]')];
  if (!links.length) links = [...document.querySelectorAll('nav a[href^="/channels/"], nav a[href^="https://discord.com/channels/"]')];
  const channels = links.map(link => {
    let url;
    try { url = new URL(link.href, location.origin); } catch { return null; }
    const match = url.pathname.match(/^\/channels\/([1-9][0-9]{16,19})\/([1-9][0-9]{16,19})$/);
    if (!match || match[1] !== guild || url.search || url.hash) return null;
    const name = link.querySelector('[class*="name"]');
    const label = clean(name?.textContent || link.textContent || link.getAttribute('aria-label'));
    return { url: url.href, label };
  }).filter(Boolean);
  return { guild, server, channels };
}

const DISCOVERY_SCRIPT = `(${discoverChannelDirectory.toString()})()`;

module.exports = { guildFromURL, normalizeChannelDirectory, DISCOVERY_SCRIPT };
