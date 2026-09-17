const api = window.omadisc;
const $ = selector => document.querySelector(selector);
let current, editing = 0;
let channelMenuSignature = '';
const channelDialog = $('#channel-dialog'), helpDialog = $('#help-dialog'), settingsDialog = $('#settings-dialog');
const dialogs = [channelDialog, helpDialog, settingsDialog];
const paneElements = Array.from({ length: 6 }, (_, i) => {
  const pane = document.createElement('section');
  pane.className = 'pane'; pane.dataset.pane = i; pane.setAttribute('aria-label', `Channel pane ${i + 1}`);
  const head = document.createElement('header'); head.className = 'pane-head';
  const number = document.createElement('span'); number.className = 'pane-number'; number.textContent = String(i + 1).padStart(2, '0');
  const dot = document.createElement('span'); dot.className = 'loading-dot'; dot.hidden = true;
  const title = document.createElement('span'); title.className = 'pane-title';
  head.append(number, dot, title);
  for (const [action, text, label] of [['navigation', '☰', 'Show navigation'], ['choose', '+', 'Choose channel'], ['reload', '↻', 'Reload channel'], ['focus', '⛶', 'Focus pane']]) {
    const button = document.createElement('button'); button.dataset.action = action; button.textContent = text; button.title = label; button.setAttribute('aria-label', `${label} ${i + 1}`);
    button.addEventListener('click', () => { if (action === 'choose') void choose(i); else void dispatch({ type: action, index: i }); });
    head.append(button);
  }
  const empty = document.createElement('div'); empty.className = 'empty';
  const mark = document.createElement('div'); mark.className = 'mark'; mark.textContent = '#'; mark.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('h2'); const copy = document.createElement('p'); const button = document.createElement('button'); button.textContent = 'Choose channel';
  button.addEventListener('click', () => { if(current?.statuses[i]?.waiting)void showSettings();else if (current?.statuses[i]?.error) void dispatch({ type: 'reload', index: i }); else void choose(i); });
  empty.append(mark, heading, copy, button); pane.append(head, empty); $('#workspace').append(pane);
  return { pane, title, dot, empty, heading, copy, button };
});
async function dispatch(action) {
  try { const result = await api.dispatch(action); if (!result.ok) $('#notice').textContent = result.error; return result; }
  catch { $('#notice').textContent = 'Workspace connection lost. Restart OmaDisc to reconnect.'; return { ok: false, error: 'Workspace connection lost.' }; }
}
function render(data) {
  current = data;
  const { state, focus, active, statuses, rects } = data;
  document.documentElement.dataset.theme = data.theme.dark ? 'dark' : 'light';
  for(const [key,value] of Object.entries(data.theme.vars))document.documentElement.style.setProperty(`--${key}`,value);
  $('#theme-discord').checked=state.themeDiscord;
  document.querySelectorAll('[data-layout]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.layout) === state.count)));
  $('#appearance').value = state.appearance; $('#zoom').value = String(state.zoom);
  const savedChannels = state.panes.flatMap((pane, index) => pane.url ? [{ pane, index, title: statuses[index]?.title || '' }] : []);
  const menuSignature = JSON.stringify(savedChannels);
  if (menuSignature !== channelMenuSignature) {
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = savedChannels.length ? `All channels (${savedChannels.length})` : 'No saved channels';
    const options = savedChannels.map(({ pane, index, title }) => {
      const option = document.createElement('option'); option.value = String(index);
      option.textContent = `${String(index + 1).padStart(2, '0')} · ${pane.label || title || (pane.url.endsWith('/@me') ? 'Discord home' : `Channel ${pane.url.split('/').at(-1)}`)}`;
      return option;
    });
    $('#channels').replaceChildren(placeholder, ...options); channelMenuSignature = menuSignature;
  }
  $('#channels').value = '';
  $('#unfocus').hidden = focus === null;
  $('#summary').textContent = data.account.status === 'required' ? 'Sign in through Settings · One account for all panes' : `${focus === null ? `${state.count} ${state.count === 1 ? 'pane' : 'panes'}` : `Pane ${focus + 1} · focused`} · ${data.theme.name}`;
  const account=data.account;
  $('#settings').dataset.attention=String(account.status==='required');
  $('#account-status').textContent=account.open?'Finish signing in on Discord':account.status==='connected'?'Discord connected':account.status==='required'?'Sign-in needed':'One account for every pane';
  $('#account-copy').textContent=account.open?'Your Discord sign-in window is open. Waiting chats reconnect when you finish.':account.status==='connected'?'Every chat uses this saved sign-in, including new panes and your next OmaDisc session.':'Sign in here once. All chat windows use the same saved session, including after restarting OmaDisc.';
  $('#account-sign-in').textContent=account.open?'Return to sign-in':account.status==='connected'?'Check saved sign-in':'Sign in to Discord';
  $('#account-error').textContent=account.error;
  $('#notice').textContent = data.notice;
  const visible = new Map(rects.map(r => [r.index, r]));
  paneElements.forEach((el, i) => {
    const rect = visible.get(i); el.pane.hidden = !rect;
    if (!rect) return;
    for (const [key, value] of Object.entries(rect.frame)) el.pane.style[{ x: 'left', y: 'top' }[key] || key] = `${value}px`;
    el.pane.dataset.active = String(i === active);
    const p = state.panes[i], status = statuses[i] || {};
    el.title.textContent = p.label || status.title || (p.url ? 'Discord' : 'Choose a channel');
    el.title.title = p.url || 'Empty pane';
    el.dot.hidden = !p.url; el.dot.dataset.loading = String(!!status.loading);
    el.empty.hidden = !!p.url && !status.error && !status.waiting;
    el.heading.textContent = status.waiting ? 'Your account, everywhere' : status.error ? 'Connection interrupted' : 'Make room for a conversation';
    el.copy.textContent = status.waiting ? 'Sign in once in Settings. This channel will reconnect automatically.' : status.error || 'Add a channel link or browse Discord. Each pane has its own conversation.';
    el.button.textContent = status.waiting ? 'Sign in in Settings' : status.error ? 'Reload channel' : 'Choose channel';
    el.pane.querySelector('[data-action=reload]').disabled = !p.url;
    const navigation=el.pane.querySelector('[data-action=navigation]');
    const browsing=data.browsing.includes(i);
    navigation.hidden=!state.themeDiscord;
    navigation.disabled=!p.url||!!status.waiting;
    navigation.setAttribute('aria-pressed',String(browsing));
    navigation.setAttribute('aria-label',`${browsing?'Back to chat':'Show navigation'} ${i+1}`);
    navigation.title=browsing?'Back to chat':'Show Discord navigation';
    navigation.textContent=browsing?'←':'☰';
  });
}
async function choose(index) {
  if (dialogs.some(dialog=>dialog.open) || !current) return;
  const result = await dispatch({ type: 'overlay', value: true }); if (!result.ok) return;
  editing = index; $('#pane-number').textContent = String(index + 1).padStart(2, '0');
  $('#channel-url').value = current.state.panes[index].url || ''; $('#channel-label').value = current.state.panes[index].label;
  $('#form-error').textContent = ''; $('#clear').hidden = !current.state.panes[index].url;
  channelDialog.showModal(); $('#channel-url').focus(); $('#channel-url').select();
}
async function submit(url) {
  const result = await dispatch({ type: 'assign', index: editing, url, label: $('#channel-label').value });
  if (result.ok) channelDialog.close(); else $('#form-error').textContent = result.error;
}
$('#channel-form').addEventListener('submit', event => { event.preventDefault(); void submit($('#channel-url').value); });
$('#browse').addEventListener('click', () => void submit('https://discord.com/channels/@me'));
$('#clear').addEventListener('click', async () => { if ((await dispatch({ type: 'clear', index: editing })).ok) channelDialog.close(); });
$('#cancel').addEventListener('click', () => channelDialog.close());
for (const dialog of dialogs) dialog.addEventListener('close', () => void dispatch({ type: 'overlay', value: false }));
async function showSettings() {
  if(dialogs.some(dialog=>dialog.open)||!current)return;
  if((await dispatch({type:'overlay',value:true})).ok)settingsDialog.showModal();
}
$('#settings').addEventListener('click',()=>void showSettings());
$('#settings-close').addEventListener('click',()=>settingsDialog.close());
$('#account-sign-in').addEventListener('click',()=>void dispatch({type:'account-sign-in'}));
$('#help').addEventListener('click', async () => { if ((await dispatch({ type: 'overlay', value: true })).ok) helpDialog.showModal(); });
$('#help-close').addEventListener('click', () => helpDialog.close());
$('#unfocus').addEventListener('click', () => void dispatch({ type: 'unfocus' }));
$('#channels').addEventListener('change', event => {
  const value = event.target.value; event.target.value = '';
  if (value !== '') void dispatch({ type: 'show-channel', index: Number(value) });
});
document.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => void dispatch({ type: 'layout', count: Number(b.dataset.layout) })));
$('#appearance').addEventListener('change', e => void dispatch({ type: 'appearance', value: e.target.value }));
$('#theme-discord').addEventListener('change', e => void dispatch({ type: 'theme-discord', value: e.target.checked }));
$('#zoom').addEventListener('change', e => void dispatch({ type: 'zoom', value: Number(e.target.value) }));
api.onState(render); api.onCommand(command => { if (command.type === 'choose') void choose(command.index); });
api.getState().then(render).catch(() => { $('#notice').textContent = 'Could not load workspace. Restart OmaDisc.'; });
