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

function channelBrowserURL(currentURL) {
  const guild=guildFromURL(currentURL);
  return guild?`https://discord.com/channels/${guild}/channel-browser`:null;
}

// This fixed, read-only DOM query runs in Discord's page after navigation. It
// reads the links Discord already rendered; it does not access tokens, stores,
// private APIs, or modify the remote document.
async function discoverChannelDirectory() {
  const parts = location.pathname.split('/').filter(Boolean);
  const guild = parts[0] === 'channels' && /^[1-9][0-9]{16,19}$/.test(parts[1] || '') ? parts[1] : null;
  if (!guild) return { guild: null, server: '', channels: [] };
  const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 160) : '';
  const guildNode = document.querySelector(`[data-list-item-id="guildsnav___${guild}"]`);
  const guildLabel = guildNode?.matches('[aria-label]') ? guildNode : guildNode?.querySelector('[aria-label]');
  const server = clean(guildLabel?.getAttribute('aria-label') || guildNode?.textContent || document.querySelector('[data-server-name]')?.getAttribute('data-server-name'));
  const initial = [...document.querySelectorAll('[data-list-item-id^="channels___"][href], [data-list-item-id^="channels___"] a[href]')];
  const sidebar=document.querySelector('[class*="sidebarList_"]');
  const root = parts[2]==='channel-browser'?document:sidebar||initial[0]?.closest('[role="tree"], [role="list"], nav') || [...document.querySelectorAll('nav')].find(nav => [...nav.querySelectorAll('a[href]')].some(link => {
    try { return new URL(link.href,location.origin).pathname.startsWith(`/channels/${guild}/`); } catch { return false; }
  }));
  if (!root) return { guild, server, channels: [] };
  const pause = delay => new Promise(resolve => setTimeout(resolve,delay));
  const found = new Map();
  function collect() {
    const links = [...root.querySelectorAll('[data-list-item-id^="channels___"][href], [data-list-item-id^="channels___"] a[href], a[href^="/channels/"], a[href^="https://discord.com/channels/"]')];
    for (const link of links) {
      let url;
      try { url = new URL(link.href,location.origin); } catch { continue; }
      const match = url.pathname.match(/^\/channels\/([1-9][0-9]{16,19})\/([1-9][0-9]{16,19})$/);
      if (!match || match[1] !== guild || url.search || url.hash || found.has(url.href)) continue;
      const name = link.querySelector('[class*="name"]');
      found.set(url.href,{url:url.href,label:clean(name?.textContent || link.textContent || link.getAttribute('aria-label'))});
    }
    const items=[...root.querySelectorAll('[data-channel-id], [data-list-item-id^="channels___"]')];
    for(const item of items) {
      if(item.matches('[aria-expanded]')||item.querySelector(':scope > [aria-expanded]'))continue;
      const rawId=item.getAttribute('data-channel-id')||(item.getAttribute('data-list-item-id')||'').split('___').at(-1);
      if(!/^[1-9][0-9]{16,19}$/.test(rawId||''))continue;
      const url=`https://discord.com/channels/${guild}/${rawId}`;
      if(found.has(url))continue;
      const name=item.querySelector('[class*="name"]');
      const label=clean(name?.textContent||item.getAttribute('aria-label')||item.textContent);
      found.set(url,{url,label});
    }
  }
  const categoryKey = element => clean(element.getAttribute('data-list-item-id') || element.getAttribute('aria-controls') || element.getAttribute('aria-label') || element.textContent);
  const expanded = new Set();
  function expandVisible() {
    let changed=false;
    for(const element of root.querySelectorAll('[aria-expanded="false"]')) {
      const key=categoryKey(element);
      if(!key||expanded.has(key))continue;
      expanded.add(key);element.click();changed=true;
    }
    return changed;
  }
  function restoreVisible() {
    let changed=false;
    for(const element of root.querySelectorAll('[aria-expanded="true"]')) {
      const key=categoryKey(element);
      if(!expanded.has(key))continue;
      expanded.delete(key);element.click();changed=true;
    }
    return changed;
  }
  const candidates=[root,...root.querySelectorAll('*')];
  for(let element=root.parentElement,depth=0;element&&depth<4;element=element.parentElement,depth++)candidates.push(element);
  // Discord virtualizes both the normal sidebar and its channel-browser list.
  // Scan every substantial scroll container instead of guessing that the one
  // with the largest overflow is the directory we want.
  const scrollers=[...new Set(candidates)].filter(element=>Number.isFinite(element?.scrollTop)&&element.scrollHeight>element.clientHeight+2).sort((a,b)=>(b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight)).slice(0,6);
  const originalScroll=new Map(scrollers.map(element=>[element,element.scrollTop]));
  async function scan(scroller,action) {
    if(!scroller) {
      const changed=action();if(changed)await pause(40);collect();return;
    }
    let top=0;
    for(let pass=0;pass<80;pass++) {
      scroller.scrollTop=top;await pause(30);
      const changed=action();if(changed)await pause(45);
      collect();
      const end=Math.max(0,scroller.scrollHeight-scroller.clientHeight);
      if(top>=end-1)break;
      const next=Math.min(end,top+Math.max(120,Math.floor(scroller.clientHeight*.75)));
      if(next===top)break;top=next;
    }
  }
  try {
    if(scrollers.length)for(const scroller of scrollers)await scan(scroller,expandVisible);
    else await scan(null,expandVisible);
    collect();
  } finally {
    for(let pass=0;pass<3&&expanded.size;pass++) {
      if(scrollers.length)for(const scroller of scrollers)await scan(scroller,restoreVisible);
      else await scan(null,restoreVisible);
    }
    for(const scroller of scrollers)scroller.scrollTop=Math.min(originalScroll.get(scroller),Math.max(0,scroller.scrollHeight-scroller.clientHeight));
    if(scrollers.length)await pause(30);
  }
  return { guild, server, channels: [...found.values()] };
}

const DISCOVERY_SCRIPT = `(${discoverChannelDirectory.toString()})()`;

module.exports = { guildFromURL, normalizeChannelDirectory, channelBrowserURL, DISCOVERY_SCRIPT };
