const { test } = require('node:test');
const assert = require('node:assert/strict');
const { channelURL, navigationAllowed, externalURL, defaultState, normalizeState, reduceState, layoutRects } = require('../src/model.cjs');
const channel = 'https://discord.com/channels/123456789012345678/234567890123456789';
test('accepts official channel, message/thread and DM links without changing identifiers', () => {
  for (const url of [channel, channel + '/345678901234567890', 'https://discord.com/channels/@me/234567890123456789', 'https://discord.com/channels/@me']) assert.equal(channelURL(url), url);
});
test('rejects malformed/hostile channel URLs instead of repairing them', () => {
  for (const url of ['', null, {}, channel + '?token=secret', channel + '#secret', channel.replace('https:', 'http:'), channel.replace('discord.com', 'discord.com.evil.test'), channel.replace('discord.com', 'user:pass@discord.com'), channel.replace('discord.com', 'discord.com:443'), channel.replace('/channels/', '/wrong/../channels/'), channel.replace('234567890123456789', '2e18'), channel.replace('234567890123456789', '012345678901234567'), channel + '/extra', 'javascript:alert(1)', 'file:///etc/passwd', 'https://discord.com/login', '\n' + channel]) assert.equal(channelURL(url), null, String(url));
});
test('navigation and external links have separate strict authority', () => {
  assert.equal(navigationAllowed('https://discord.com/login?redirect_to=%2Fchannels%2F%40me'), true);
  for (const url of ['https://discord.com.evil.test/', 'https://evil.test/', 'https://discord.com@evil.test/', 'file:///tmp/a', 'https://discord.com:9443/', 'https://discord.com./']) assert.equal(navigationAllowed(url), false);
  assert.equal(externalURL('https://example.com/path?q=one'), 'https://example.com/path?q=one');
  for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'discord://foo', 'http://example.com', 'https://user:pw@example.com', 'https://example.com\n']) assert.equal(externalURL(url), null);
});
test('only exact layouts; layout changes retain hidden assigned panes', () => {
  let s = reduceState(defaultState(), { type: 'assign', index: 5, url: channel, label: 'Engineering' });
  for (const count of [6, 4, 2, 1, 6]) { s = reduceState(s, { type: 'layout', count }); assert.equal(s.count, count); assert.equal(s.panes[5].url, channel); }
  for (const action of [{ type: 'layout', count: 3 }, { type: 'layout', count: '6' }, { type: 'assign', index: -1, url: channel }, { type: 'assign', index: 0, url: 'https://evil.test' }, { type: 'execute', command: 'oops' }]) assert.throws(() => reduceState(s, action));
});
test('clear, labels, scale and appearance are bounded', () => {
  let s = reduceState(defaultState(), { type: 'assign', index: 0, url: channel, label: 'My channel' });
  s = reduceState(s, { type: 'clear', index: 0 }); assert.equal(s.panes[0].url, null);
  for (const value of ['system', 'dark', 'light']) assert.equal(reduceState(s, { type: 'appearance', value }).appearance, value);
  for (const value of [0.65, 0.8, 1, 1.25]) assert.equal(reduceState(s, { type: 'zoom', value }).zoom, value);
  for (const action of [{ type: 'zoom', value: 0.01 }, { type: 'appearance', value: 'evil' }, { type: 'assign', index: 0, url: channel, label: 'x'.repeat(81) }]) assert.throws(() => reduceState(s, action));
});
test('normalize rebuilds only valid non-secret fields', () => {
  const s = normalizeState({ count: 3, appearance: 'fake', zoom: 50, token: 'secret', panes: [{ url: 'https://evil.test', label: '<script>label</script>', token: 'secret' }] });
  assert.equal(s.count, 1); assert.equal(s.appearance, 'system'); assert.equal(s.zoom, 1); assert.equal(s.panes.length, 6); assert.equal(s.panes[0].url, null); assert.equal(JSON.stringify(s).includes('secret'), false);
});
for (const [count, cols, rows] of [[1, 1, 1], [2, 2, 1], [4, 2, 2], [6, 3, 2]]) test(`${count} pane geometry: no overlaps, native content below header`, () => {
  for (const [w, h] of [[820,620], [1365,877], [1920,1080], [2560,1440]]) {
    const rects = layoutRects(w,h,count,null); assert.equal(rects.length,count);
    assert.equal(new Set(rects.map(r => r.frame.x)).size,cols); assert.equal(new Set(rects.map(r => r.frame.y)).size,rows);
    for (const { frame:f, content:c } of rects) { assert.ok(f.x>=0 && f.y>=60 && f.x+f.width<=w && f.y+f.height<=h); assert.ok(c.y>f.y && c.height>0 && c.width>0 && c.y+c.height<=f.y+f.height); }
    for (let a=0;a<count;a++) for (let b=a+1;b<count;b++) { const x=rects[a].frame,y=rects[b].frame; assert.ok(x.x+x.width<=y.x || y.x+y.width<=x.x || x.y+x.height<=y.y || y.y+y.height<=x.y); }
  }
});
test('temporary focus retains identity and fills canvas', () => { const r=layoutRects(1400,900,6,5); assert.equal(r.length,1); assert.equal(r[0].index,5); assert.deepEqual(r[0].frame,layoutRects(1400,900,1,null)[0].frame); assert.equal(layoutRects(1400,900,6,null).length,6); });
