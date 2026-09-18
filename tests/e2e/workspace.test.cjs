const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');
const { defaultState } = require('../../src/model.cjs');
const { assertContained } = require('../../scripts/test-isolation.cjs');
const ROOT = path.resolve(__dirname, '../..');
const APP = process.env.OMADISC_TEST_APP || ROOT;
const EXE = process.env.OMADISC_TEST_EXE || require('electron');
const launchEnv = process.env.OMADISC_TEST_EXE ? { ...process.env, ELECTRON_RUN_AS_NODE: '' } : require('../../scripts/native.cjs').compatibleEnv(EXE);
const channel = i => `https://discord.com/channels/123456789012345678/${234567890123456780n + BigInt(i)}`;
async function launch(dir, options={}) {
  const app = await electron.launch({ executablePath: EXE, chromiumSandbox: true, args: [APP, `--user-data-dir=${dir}`, '--ozone-platform=x11'], env: {...launchEnv,...options.env}, timeout: 30000 });
  const page = await app.firstWindow();
  await page.waitForFunction(() => !!window.omadisc);
  await app.context().route('https://discord.com/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Fixture · Discord</title><body style="background:#202227;color:#eee;font:20px sans-serif;padding:28px"><h1>LOCAL TEST FIXTURE — not Discord messages</h1><p>Channel route:</p><output></output><br><textarea aria-label="Draft" placeholder="Test-only draft"></textarea><script>document.querySelector("output").textContent=location.pathname;</script></body>' }));
  if(options.route)await app.context().route('https://discord.com/**',options.route);
  assertContained(app.process().pid);
  return { app, page };
}
async function state(page) { return page.evaluate(() => window.omadisc.getState()); }
async function nativeViews(app) { return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.filter(v => v.webContents && v.webContents.getURL().startsWith('https://discord.com')).map(v => ({ id: v.webContents.id, url: v.webContents.getURL(), bounds: v.getBounds(), visible: v.getVisible(), preferences: v.webContents.getLastWebPreferences() }))); }
async function eventually(fn, predicate, message) { const end = Date.now() + 15000; let v; do { v=await fn(); if(predicate(v)) return v; await new Promise(r=>setTimeout(r,80)); } while(Date.now()<end); assert.fail(message + ': ' + JSON.stringify(v)); }

test('real Electron shell: independent panes, focus, geometry, drafts, validation, security and persistence', { timeout: 120000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-e2e-'));
  const initial=defaultState(); initial.panes.forEach(p=>p.url=null); fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(initial));
  let app; t.after(async()=>{ if(app) await app.close().catch(()=>{}); fs.rmSync(dir,{recursive:true,force:true}); });
  let launched=await launch(dir); app=launched.app; let page=launched.page;
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  for(const n of [1,2,4,6]) { await page.getByRole('button',{name:`${n} pane${n===1?'':'s'}`,exact:true}).click(); assert.equal((await state(page)).state.count,n); assert.equal(await page.locator('.pane:not([hidden])').count(),n); }
  for(let i=0;i<6;i++) {
    await page.locator(`[data-pane="${i}"] [data-action="choose"]`).click();
    await page.getByLabel('Channel link').fill(channel(i)); await page.getByLabel('Pane label').fill(`Workspace ${i+1}`);
    await page.getByRole('button',{name:'Open channel',exact:true}).click();
  }
  const views=await eventually(()=>nativeViews(app),v=>v.length===6 && v.every(x=>!x.url.includes('@me')),'six native channel views');
  assert.equal(new Set(views.map(v=>v.id)).size,6); assert.equal(new Set(views.map(v=>v.url)).size,6); assert.ok(views.every(v=>v.visible));
  for(const v of views) { assert.equal(v.preferences.nodeIntegration,false); assert.equal(v.preferences.sandbox,true); assert.equal(v.preferences.contextIsolation,true); assert.equal(v.preferences.webSecurity,true); assert.ok(!v.preferences.preload); }
  const remote=app.context().pages().find(p=>p.url()===channel(5)); assert.ok(remote);
  await remote.getByLabel('Draft').fill('unsent local fixture draft');
  assert.deepEqual(await remote.evaluate(()=>({node:typeof require,bridge:typeof window.omadisc})),{node:'undefined',bridge:'undefined'});
  await page.getByRole('button',{name:'1 pane',exact:true}).click();
  assert.equal((await nativeViews(app)).filter(v=>v.visible).length,1);
  await page.getByRole('button',{name:'6 panes',exact:true}).click();
  assert.equal(await remote.getByLabel('Draft').inputValue(),'unsent local fixture draft');
  await page.locator('[data-pane="5"] [data-action="focus"]').click();
  assert.equal((await state(page)).focus,5); assert.equal((await nativeViews(app)).filter(v=>v.visible).length,1);
  await page.getByRole('button',{name:'Back to grid',exact:true}).click();
  assert.equal((await state(page)).focus,null); assert.equal((await nativeViews(app)).filter(v=>v.visible).length,6);
  await page.locator('[data-pane="0"] [data-action="choose"]').click();
  assert.equal((await nativeViews(app)).filter(v=>v.visible).length,0);
  await page.getByLabel('Channel link').fill('https://discord.com.evil.test/channels/123/456');
  await page.getByRole('button',{name:'Open channel',exact:true}).click();
  await page.locator('#form-error').filter({hasText:'https://discord.com/channels/'}).waitFor();
  assert.equal((await state(page)).state.panes[0].url,channel(0));
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await eventually(()=>nativeViews(app),v=>v.filter(x=>x.visible).length===6,'dialog close restores native panes');
  await page.getByLabel('Appearance').selectOption('light');
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await page.getByLabel('Page scale').selectOption('0.8');
  assert.equal((await state(page)).state.zoom,0.8);
  // Tiling compositors own window dimensions and can ignore setContentSize.
  const beforeWidth=(await state(page)).rects[0].frame.width;
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setFullScreen(true));
  await eventually(()=>state(page),s=>s.rects[0].frame.width!==beforeWidth,'compositor fullscreen resize');
  await eventually(async()=>({snap:await state(page),native:await nativeViews(app)}),({snap,native})=>snap.rects.every(rect=>JSON.stringify(native.find(v=>v.url===snap.state.panes[rect.index].url)?.bounds)===JSON.stringify(rect.content)),'native panes follow compositor resize');
  await remote.evaluate(()=>{ window.open('file:///etc/passwd'); });
  assert.equal((await nativeViews(app)).length,6);
  const sessions=await app.evaluate(({BrowserWindow})=>{const views=BrowserWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents?.getURL().startsWith('https://discord.com')); return views.every(v=>v.webContents.session===views[0].webContents.session);}); assert.equal(sessions,true);
  fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});
  await page.screenshot({path:path.join(ROOT,'test-results','shell-six-pane.png')});
  if(process.env.WAYLAND_DISPLAY && process.env.HYPRLAND_INSTANCE_SIGNATURE) {
    const {execFileSync}=require('node:child_process');
    const client=JSON.parse(execFileSync('hyprctl',['clients','-j'],{encoding:'utf8'})).find(c=>c.pid===app.process().pid);
    assert.ok(client?.mapped && client.visible,'test app must be visible for native screenshot');
    execFileSync('grim',['-g',`${client.at[0]},${client.at[1]} ${client.size[0]}x${client.size[1]}`,path.join(ROOT,'test-results','native-six-pane-fixtures.png')]);
  }
  assert.deepEqual(errors,[]);
  assertContained(app.process().pid);
  await app.close(); app=null;
  launched=await launch(dir); app=launched.app; page=launched.page;
  const restored=await state(page); assert.equal(restored.state.count,6); assert.equal(restored.state.appearance,'light'); assert.equal(restored.state.zoom,0.8);
  for(let i=0;i<6;i++){assert.equal(restored.state.panes[i].url,channel(i));assert.equal(restored.state.panes[i].label,`Workspace ${i+1}`);}
});

test('real top-level HTTP redirect requests confirmation and never opens a browser after cancellation',{timeout:45000},async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-redirect-'));
  const initial=defaultState();initial.panes.forEach(p=>p.url=null);fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(initial));
  const {app,page}=await launch(dir);t.after(async()=>{await app.close();fs.rmSync(dir,{recursive:true,force:true});});
  await app.evaluate(({dialog,shell})=>{
    globalThis.redirectTest={prompts:[],opened:[]};
    dialog.showMessageBox=async(_parent,options)=>{globalThis.redirectTest.prompts.push({title:options.title,defaultId:options.defaultId,cancelId:options.cancelId});return {response:0};};
    shell.openExternal=async url=>globalThis.redirectTest.opened.push(url);
  });
  await app.context().route('https://discord.com/redirect-fixture',r=>r.fulfill({status:302,headers:{location:'https://example.com/'}}));
  await page.evaluate(url=>window.omadisc.dispatch({type:'assign',index:0,url,label:''}),channel(0));
  await eventually(()=>nativeViews(app),v=>v.length===1,'first test webview');
  await app.evaluate(async({BrowserWindow})=>{
    const view=BrowserWindow.getAllWindows()[0].contentView.children.find(v=>v.webContents?.getURL().startsWith('https://discord.com'));
    await view.webContents.loadURL('https://discord.com/redirect-fixture').catch(()=>{});
  });
  const result=await eventually(()=>app.evaluate(()=>globalThis.redirectTest),v=>v.prompts.length===1,'external redirect confirmation');
  assert.deepEqual(result.prompts,[{title:'Open external link?',defaultId:0,cancelId:0}]);assert.deepEqual(result.opened,[]);
});

test('Settings sign-in shares persistent browser storage across panes and preserves active drafts', {timeout:90000}, async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-sign-in-'));
  const initial=defaultState();initial.count=4;initial.panes.forEach(p=>p.url=null);
  fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(initial));
  const requests=[];
  const route=async route=>{
    const url=route.request().url();
    const connected=(route.request().headers().cookie||'').includes('omadisc_fixture=connected');
    requests.push({url,connected});
    if(url.endsWith('/login'))return route.fulfill({contentType:'text/html',body:`<!doctype html><title>LOCAL SIGN-IN FIXTURE</title><p>Simulated sign-in only; no credentials.</p><script>if(localStorage.getItem('omadisc-fixture')==='connected')location.replace('/channels/@me')</script><button onclick="localStorage.setItem('omadisc-fixture','connected');document.cookie='omadisc_fixture=connected; Max-Age=3600; Path=/; Secure; SameSite=Lax';location.replace('/channels/@me')">Connect fixture account</button>`});
    if(url!==channel(0)&&!connected)return route.fulfill({status:302,headers:{location:'https://discord.com/login'}});
    return route.fulfill({contentType:'text/html',body:'<!doctype html><title>LOCAL CHANNEL FIXTURE</title><textarea aria-label="Draft"></textarea>'});
  };
  let app;
  t.after(async()=>{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});});
  let launched=await launch(dir,{route});app=launched.app;let page=launched.page;
  const assign=index=>page.evaluate(({index,url})=>window.omadisc.dispatch({type:'assign',index,url,label:`Saved ${index+1}`}),{index,url:channel(index)});
  await assign(0);
  await eventually(()=>nativeViews(app),views=>views.some(v=>v.url===channel(0)),'active fixture channel');
  const active=app.context().pages().find(p=>p.url()===channel(0));
  await active.getByLabel('Draft').fill('keep this unsent fixture draft');
  await assign(1);
  await eventually(()=>state(page),s=>s.account.status==='required'&&s.statuses[1]?.waiting,'signed-out pane waits for Settings');
  await assign(2);
  const waiting=await state(page);
  assert.equal(waiting.state.count,4);assert.deepEqual(waiting.rects.map(r=>r.index),[0,1,2,3]);
  assert.equal(waiting.state.panes[1].url,channel(1));assert.equal(waiting.statuses[2].waiting,true);
  assert.equal(requests.some(r=>r.url===channel(2)),false,'deferred pane must not load before sign-in');
  await page.locator('[data-pane="1"]').getByRole('button',{name:'Sign in in Settings'}).click();
  await page.getByRole('button',{name:'Sign in with password or QR',exact:true}).click();
  await eventually(()=>state(page),s=>s.account.open,'central account window opens');
  const accountDetails=()=>app.evaluate(({BrowserWindow})=>{
    const main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('omadisc://'));
    const accounts=BrowserWindow.getAllWindows().filter(w=>w!==main);
    const login=accounts[0];const peer=main.contentView.children.find(v=>v.webContents);
    return {count:accounts.length,id:login?.id,shared:login?.webContents.session===peer?.webContents.session,prefs:login?.webContents.getLastWebPreferences(),bounds:login?.getContentBounds(),zoom:login?.webContents.getZoomFactor(),zoomMode:login?.webContents.getZoomMode(),title:login?.getTitle()};
  });
  const details=await eventually(accountDetails,s=>s.count===1&&s.bounds?.width>=900&&s.zoom===0.9,'one full-width account window');
  assert.equal(details.shared,true);
  assert.ok(details.bounds.width>=900,'Discord desktop login keeps room for its QR panel');
  assert.equal(details.zoom,0.9);assert.equal(details.zoomMode,'isolated');assert.match(details.title,/Password or QR/);
  for(const [key,value] of Object.entries({sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}))assert.equal(details.prefs[key],value);
  assert.ok(!details.prefs.preload);
  await page.getByRole('button',{name:'Return to sign-in'}).click();
  assert.equal((await accountDetails()).id,details.id,'repeated clicks focus the existing window');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('https://discord.com/')).close());
  await eventually(()=>state(page),s=>!s.account.open&&s.account.status==='required','cancel retains waiting chats');
  await page.getByRole('button',{name:'Sign in with password or QR',exact:true}).click();
  const login=await eventually(async()=>app.context().pages().find(p=>p.url()==='https://discord.com/login'),p=>!!p,'account login fixture');
  assert.deepEqual(await login.evaluate(()=>({node:typeof require,bridge:typeof window.omadisc})),{node:'undefined',bridge:'undefined'});
  await login.getByRole('button',{name:'Connect fixture account'}).click();
  await eventually(()=>state(page),s=>s.account.status==='connected'&&!s.account.open&&!s.statuses[2]?.waiting,'account reconnects saved channels');
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await eventually(()=>nativeViews(app),views=>views.length===3&&views.every((v,i)=>v.url===channel(i)&&v.visible),'assigned channels restored');
  assert.equal(await active.getByLabel('Draft').inputValue(),'keep this unsent fixture draft');
  assert.equal(requests.filter(r=>r.url===channel(0)).length,1,'active peers must not reload');
  await assign(3);
  await eventually(()=>nativeViews(app),views=>views.some(v=>v.url===channel(3)),'new pane uses the saved session');
  assert.ok(requests.filter(r=>[channel(2),channel(3)].includes(r.url)).every(r=>r.connected),'waiting and new channels receive the account cookie');
  const peer=app.context().pages().find(p=>p.url()===channel(3));
  assert.equal(await peer.evaluate(()=>localStorage.getItem('omadisc-fixture')),'connected','browser local storage is shared too');
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'workspace.json'),'utf8'));
  for(let i=0;i<4;i++){assert.equal(saved.panes[i].url,channel(i));assert.equal(saved.panes[i].label,`Saved ${i+1}`);}
  assert.equal(JSON.stringify(saved).includes('omadisc_fixture'),false,'credentials do not belong in workspace settings');
  await active.evaluate(()=>{localStorage.removeItem('omadisc-fixture');document.cookie='omadisc_fixture=; Max-Age=0; Path=/; Secure';});
  await page.evaluate(()=>window.omadisc.dispatch({type:'reload',index:1}));
  await eventually(()=>state(page),s=>s.account.status==='required','expired fixture session requires central sign-in');
  await page.evaluate(()=>window.omadisc.dispatch({type:'reload',index:2}));
  await page.evaluate(()=>window.omadisc.dispatch({type:'clear',index:1}));
  assert.equal((await state(page)).statuses[2].waiting,true,'clearing a channel cannot bypass sign-in');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  // Fixture-only preview: no user messages, sign-in QR or account details.
  await page.screenshot({path:path.join(ROOT,'test-results','settings-sign-in-preview.png')});
  await page.getByRole('button',{name:'Sign in with password or QR',exact:true}).click();
  const relogin=await eventually(async()=>app.context().pages().find(p=>p.url()==='https://discord.com/login'),p=>!!p,'fixture reauthentication');
  await relogin.getByRole('button',{name:'Connect fixture account'}).click();
  await eventually(()=>state(page),s=>s.account.status==='connected'&&!s.account.open,'reconnected after expiry');
  assert.equal(await active.getByLabel('Draft').inputValue(),'keep this unsent fixture draft');
  await app.close();app=null;
  // Start empty to attach fixture interception before any remote requests. The
  // actual persistent Chromium partition is retained unchanged across restart.
  fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(initial));
  launched=await launch(dir,{route});app=launched.app;page=launched.page;
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Sign in with password or QR',exact:true}).click();
  await eventually(()=>state(page),s=>s.account.status==='connected'&&!s.account.open,'saved login reconnects after full restart without another sign-in');
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await assign(1);
  await eventually(()=>nativeViews(app),views=>views.some(v=>v.url===channel(1)),'channel reconnects after full restart');
  assert.equal(requests.filter(r=>r.url===channel(1)).at(-1).connected,true);
  assertContained(app.process().pid);
});

test('account sign-in failure can be retried and its window closes with the workspace', {timeout:45000}, async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-account-failure-'));
  const initial=defaultState();initial.panes.forEach(p=>p.url=null);fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(initial));
  let fail=true;
  const {app,page}=await launch(dir,{route:route=>fail?route.abort('internetdisconnected'):route.fulfill({contentType:'text/html',body:'<title>LOCAL ACCOUNT FIXTURE</title><p>Fixture sign-in</p>'})});
  t.after(async()=>{await app.close().catch(()=>{});fs.rmSync(dir,{recursive:true,force:true});});
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Sign in with password or QR',exact:true}).click();
  await eventually(()=>state(page),s=>!!s.account.error&&!s.account.open,'failed account window closes with retry message');
  assert.match(await page.locator('#account-error').textContent(),/Check your connection/);
  fail=false;
  await page.getByRole('button',{name:'Sign in with password or QR',exact:true}).click();
  await eventually(()=>state(page),s=>s.account.open&&!s.account.error&&!s.account.loading,'account retry opens cleanly');
  const exited=new Promise(resolve=>app.process().once('exit',resolve));
  await page.close();
  await Promise.race([exited,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Account window kept OmaDisc running after workspace closed')),5000);timer.unref();})]);
});

test('Omarchy palette updates shell and Discord CSS, with a persistent opt-out', {timeout:45000}, async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-theme-e2e-'));
  const themeDir=path.join(dir,'theme');fs.mkdirSync(themeDir);
  const colors=path.join(themeDir,'colors.toml');
  fs.writeFileSync(colors,'background = "#102030"\nforeground = "#f0f0f0"\naccent = "#abcdef"\n');
  const initial=defaultState();initial.panes.forEach(p=>p.url=null);
  fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(initial));
  const env={OMADISC_THEME_FILE:colors};
  let app;
  t.after(async()=>{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});});
  let launched=await launch(dir,{env});app=launched.app;let page=launched.page;
  await page.evaluate(url=>window.omadisc.dispatch({type:'assign',index:0,url,label:''}),channel(0));
  await eventually(()=>nativeViews(app),views=>views.some(v=>v.url===channel(0)),'themed fixture channel');
  const remote=app.context().pages().find(p=>p.url()===channel(0));
  await remote.getByLabel('Draft').fill('keep draft while changing appearance');
  const background=p=>p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  await eventually(()=>background(remote),value=>value==='rgb(16, 32, 48)','Discord uses Omarchy palette');
  assert.equal(await background(page),'rgb(16, 32, 48)');
  // Theme replacement is how the desktop publishes a new palette.
  fs.rmSync(themeDir,{recursive:true});fs.mkdirSync(themeDir);
  fs.writeFileSync(colors,'background = "#f8f4e0"\nforeground = "#202020"\naccent = "#506070"\n');
  await eventually(()=>background(page),value=>value==='rgb(248, 244, 224)','shell follows replaced palette');
  await eventually(()=>background(remote),value=>value==='rgb(248, 244, 224)','Discord follows replaced palette');
  assert.equal((await state(page)).theme.dark,false);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('Use Omarchy chat design').uncheck();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  assert.equal((await state(page)).state.themeDiscord,false);
  await eventually(()=>background(remote),value=>value==='rgb(32, 34, 39)','opt-out restores site CSS');
  assert.equal(await remote.getByLabel('Draft').inputValue(),'keep draft while changing appearance');
  assert.equal(await background(page),'rgb(248, 244, 224)');
  await remote.reload();
  await eventually(()=>background(remote),value=>value==='rgb(32, 34, 39)','opt-out survives page reload');
  await app.close();app=null;
  launched=await launch(dir,{env});app=launched.app;page=launched.page;
  assert.equal((await state(page)).state.themeDiscord,false);
});

test('Omarchy channel design fills the pane, preserves editing and restores Discord navigation', {timeout:60000}, async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-chat-view-'));
  const initial=defaultState();initial.count=2;initial.panes.forEach(p=>p.url=null);
  fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(initial));
  const fixture=fs.readFileSync(path.join(__dirname,'../fixtures/channel.html'),'utf8');
  const {app,page}=await launch(dir,{route:route=>{
    const url=route.request().url();
    const browser=`<!doctype html><title>LOCAL CHANNEL BROWSER FIXTURE</title><main aria-label="All channels"><a data-list-item-id="channels___234567890123456780" href="${channel(0)}">kzn</a><a data-list-item-id="channels___234567890123456782" href="${channel(2)}">team-lounge</a><a data-list-item-id="channels___234567890123456784" href="${channel(4)}">planning</a><a data-list-item-id="channels___234567890123456785" href="${channel(5)}">archive</a><div role="button" data-channel-id="234567890123456786" aria-label="voice-room">voice-room</div></main>`;
    const body=url.endsWith('/login')?'<title>LOCAL LOGIN FIXTURE</title><nav class="sidebar__fixture">Login navigation</nav><input aria-label="Fixture password" type="password">':url.endsWith('/channel-browser')?browser:fixture.replaceAll('__CURRENT_CHANNEL__',url).replaceAll('__NEXT_CHANNEL__',channel(2)).replaceAll('__PLANNING_CHANNEL__',channel(4)).replaceAll('__ARCHIVE_CHANNEL__',channel(5));
    return route.fulfill({contentType:'text/html',body});
  }});
  t.after(async()=>{await app.close();fs.rmSync(dir,{recursive:true,force:true});});
  for(let index=0;index<2;index++)await page.evaluate(({index,url})=>window.omadisc.dispatch({type:'assign',index,url,label:'Design studio'}),{index,url:channel(index)});
  await eventually(()=>nativeViews(app),views=>views.length===2&&views.every(v=>v.url.startsWith('https://discord.com/channels/')),'channel fixtures loaded');
  const remote=app.context().pages().find(p=>p.url()===channel(0));
  const peer=app.context().pages().find(p=>p.url()===channel(1));
  await app.evaluate(({BrowserWindow},url)=>BrowserWindow.getAllWindows()[0].contentView.children.find(view=>view.webContents?.getURL()===url)?.webContents.focus(),channel(0));
  await eventually(()=>state(page),s=>s.active===0,'first fixture pane is active');
  const directory=await eventually(()=>state(page),s=>s.directory?.server==='Morpheus & Team'&&s.directory.channels.length===5,'complete active server channel directory');
  assert.deepEqual(directory.directory.channels.map(entry=>entry.label),['kzn','team-lounge','planning','archive','voice-room']);
  assert.deepEqual(await page.getByLabel('Server channels').locator('option').allTextContents(),['Morpheus & Team (5)','# kzn','# team-lounge','# planning','# archive','# voice-room']);
  assert.equal(await remote.locator('#archive-category').getAttribute('aria-expanded'),'false','collapsed categories restore after discovery');
  const layout=p=>p.evaluate(()=>({
    sidebar:getComputedStyle(document.querySelector('.sidebar__fixture')).display,
    top:getComputedStyle(document.querySelector('.bar__fixture')).display,
    members:document.querySelector('.membersWrap_fixture').checkVisibility()?'visible':'none',
    servers:document.querySelector('.guilds__fixture').checkVisibility(),
    account:document.querySelector('.panels__fixture').checkVisibility(),
    header:document.querySelector('.title_fixture').checkVisibility(),
    width:document.querySelector('.chatContent_fixture').getBoundingClientRect().width,
    left:document.querySelector('.chatContent_fixture').getBoundingClientRect().left,
    topEdge:document.querySelector('.chatContent_fixture').getBoundingClientRect().top,
    composerBottom:document.querySelector('.form_fixture').getBoundingClientRect().bottom,
    height:innerHeight,
    viewport:innerWidth,
    font:getComputedStyle(document.querySelector('.messageContent_fixture')).fontFamily,
    avatar:getComputedStyle(document.querySelector('.avatar_fixture')).width
  }));
  await eventually(()=>layout(remote),s=>s.sidebar==='none'&&s.top==='none'&&s.members==='none','Discord chrome collapses around the chat');
  const compact=await layout(remote);
  assert.ok(Math.abs(compact.width-compact.viewport)<=2,'message view uses the full pane width');
  assert.equal(compact.left,0,'subgrid leaves no implicit sidebar columns');
  assert.equal(compact.topEdge,0,'only the conversation remains under the OmaDisc pane header');
  assert.ok(Math.abs(compact.composerBottom-compact.height)<=2,'composer stays visible at the bottom of the pane');
  assert.equal(compact.servers,false);assert.equal(compact.account,false);assert.equal(compact.header,false);
  assert.match(compact.font,/JetBrains Mono/);assert.equal(compact.avatar,'26px');
  // Service notices still occupy their named row above the chat when needed.
  await remote.locator('.notice__fixture').evaluate(el=>el.hidden=false);
  const withNotice=await layout(remote);
  assert.ok(withNotice.topEdge>0);assert.ok(Math.abs(withNotice.width-withNotice.viewport)<=2);
  await remote.locator('.notice__fixture').evaluate(el=>el.hidden=true);
  await remote.getByRole('textbox',{name:'Message fixture'}).fill('Draft stays here while I browse.');
  await remote.getByRole('button',{name:'Add fixture reaction'}).click();
  assert.equal(await remote.locator('.reaction_fixture span').textContent(),'3','Discord-owned event handlers still work');
  await page.getByRole('button',{name:'Show navigation 1',exact:true}).click();
  await eventually(()=>layout(remote),s=>s.sidebar!=='none'&&s.members!=='none','navigation is available on demand');
  const expanded=await layout(remote);
  assert.equal(expanded.servers,true);assert.equal(expanded.account,true);assert.equal(expanded.header,true);
  assert.equal((await layout(peer)).sidebar,'none','other pane stays in chat view');
  assert.equal(await remote.getByRole('textbox',{name:'Message fixture'}).textContent(),'Draft stays here while I browse.');
  await page.getByRole('button',{name:'Back to chat 1',exact:true}).click();
  await eventually(()=>layout(remote),s=>s.sidebar==='none','back to chat collapses navigation');
  assert.equal(await remote.getByRole('textbox',{name:'Message fixture'}).textContent(),'Draft stays here while I browse.');
  // Choosing even the same URL through OmaDisc exits navigation without reload.
  await page.getByRole('button',{name:'Show navigation 1',exact:true}).click();
  await page.getByRole('button',{name:'Choose channel 1',exact:true}).click();
  await page.getByRole('button',{name:'Open channel',exact:true}).click();
  await eventually(()=>layout(remote),s=>s.sidebar==='none','choosing a channel returns to chat');
  assert.equal(await remote.getByRole('textbox',{name:'Message fixture'}).textContent(),'Draft stays here while I browse.');
  // Retain support for the earlier layout with direct sidebar/page children.
  await peer.evaluate(()=>{
    const base=document.querySelector('.base__fixture'),content=document.querySelector('.app-content__fixture');
    base.append(...content.children);content.remove();
  });
  const direct=await layout(peer);
  assert.equal(direct.sidebar,'none');assert.ok(Math.abs(direct.width-direct.viewport)<=2);
  // Capture only local example messages, never the user's channel or sign-in QR.
  await remote.getByRole('textbox',{name:'Message fixture'}).fill('');
  await remote.screenshot({path:path.join(ROOT,'test-results','omarchy-channel-preview.png')});
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('Use Omarchy chat design').uncheck();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await eventually(()=>layout(remote),s=>s.sidebar!=='none'&&s.avatar==='40px','original Discord presentation restores');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('Use Omarchy chat design').check();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button',{name:'Show navigation 1',exact:true}).click();
  await remote.getByRole('link',{name:'Open next channel'}).click();
  await eventually(()=>state(page),s=>s.state.panes[0].url===channel(2)&&!s.browsing.includes(0),'channel selection returns to compact view');
  await eventually(()=>layout(remote),s=>s.sidebar==='none','new channel is compact');
  await eventually(()=>state(page),s=>s.directory?.channels.some(entry=>entry.url===channel(4)),'server menu refreshes after channel navigation');
  await page.getByLabel('Server channels').selectOption(channel(4));
  await eventually(()=>state(page),s=>s.state.panes[0].url===channel(4),'top server menu opens a channel in the active pane');
  await remote.goto('https://discord.com/login').catch(()=>{});
  await eventually(()=>state(page),s=>s.statuses[0]?.waiting,'expired chat uses Settings sign-in');
  assert.equal((await state(page)).state.panes[0].url,channel(4));
  assertContained(app.process().pid);
});
