const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { assertContained } = require('./test-isolation.cjs');
const root = path.resolve(__dirname, '..');
const executable = process.env.OMADISC_TEST_EXE || require('electron');
const launchEnv = process.env.OMADISC_TEST_EXE ? { ...process.env, ELECTRON_RUN_AS_NODE: '' } : require('./native.cjs').compatibleEnv(executable);
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omadisc-live-'));
  const initial=require('../src/model.cjs').defaultState();initial.panes.forEach(p=>p.url=null);
  fs.writeFileSync(path.join(dir,'workspace.json'),JSON.stringify(initial));
  const started=Date.now(), samples=[];
  const cgroup=fs.readFileSync('/proc/self/cgroup','utf8').split('\n').find(line=>line.startsWith('0::'))?.slice(3);
  const memoryFile=cgroup&&path.join('/sys/fs/cgroup',cgroup,'memory.current');
  const peakFile=cgroup&&path.join('/sys/fs/cgroup',cgroup,'memory.peak');
  let app, metrics, sampling=false, phase='loading-discord';
  try {
    app = await electron.launch({ executablePath: executable, chromiumSandbox: true, args: [process.env.OMADISC_TEST_APP || root, `--user-data-dir=${dir}`, '--ozone-platform=wayland'], env: launchEnv, timeout: 30000 });
    const page = await app.firstWindow();
    assertContained(app.process().pid);
    metrics=setInterval(async()=>{
      if(sampling)return;sampling=true;
      try {
        const processes=await app.evaluate(({app})=>app.getAppMetrics().map(({type,memory})=>({type,rssMiB:Math.round(memory.workingSetSize/1024)})));
        const workspace=await page.evaluate(()=>window.omadisc.getState());
        const memoryMiB=memoryFile?Math.round(Number(fs.readFileSync(memoryFile,'utf8'))/1048576):null;
        samples.push({seconds:Math.round((Date.now()-started)/1000),phase,memoryMiB,account:workspace.account.status,waitingPanes:Object.values(workspace.statuses).filter(s=>s.waiting).length,processes});
        fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
        fs.writeFileSync(path.join(root,'test-results','live-memory.json'),JSON.stringify(samples,null,2));
        console.log(`Live memory: ${memoryMiB} MiB (${phase})`);
      } catch { /* The app can close while the final sample is pending. */ }
      finally {sampling=false;}
    },5000);
    app.process().stderr.on('data', chunk => { const text=chunk.toString(); if(text.includes('OmaDisc pane')||text.includes('GPU process'))console.error(text); });
    await page.waitForFunction(() => !!window.omadisc);
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.getByRole('button',{name:'Sign in with password or QR',exact:true}).click();
    const deadline = Date.now() + 60000;
    let live;
    do {
      live = await app.evaluate(async ({ BrowserWindow, app }) => {
        const win = BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('https://discord.com/'));
        if (!win) return { loaded: false };
        const wc = win.webContents;
        const page = await Promise.race([wc.executeJavaScript(`(()=>{const text=document.body?.innerText||'';return {login:!!document.querySelector('input[type=password]'),qr:!!document.querySelector('[class*="qrCode"],img[alt*="QR" i]')||/\\bQR(?:\\s+Code)?\\b/i.test(text),title:document.title,ready:document.readyState}})()`).catch(() => ({ ready: 'loading' })),new Promise(resolve=>setTimeout(()=>resolve({ready:'unresponsive'}),1500))]);
        return { loaded: true, origin: new URL(wc.getURL()).origin, pathname: new URL(wc.getURL()).pathname, title: page.title, ready: page.ready, login: page.login, qr: page.qr, sandboxDisabled: app.commandLine.hasSwitch('no-sandbox'), sandbox: wc.getLastWebPreferences().sandbox, nodeIntegration: wc.getLastWebPreferences().nodeIntegration, contextIsolation: wc.getLastWebPreferences().contextIsolation, remotePreload: !!wc.getLastWebPreferences().preload, size: win.getContentSize(), zoom: wc.getZoomFactor(), zoomMode: wc.getZoomMode(), platform: app.commandLine.getSwitchValue('ozone-platform'), runtime: process.versions.electron };
      });
      if (live.login && live.qr && live.ready === 'complete') break;
      await new Promise(r => setTimeout(r, 250));
    } while (Date.now() < deadline);
    assert.equal(live.origin, 'https://discord.com'); assert.equal(live.login, true, 'Actual Discord login form must load'); assert.equal(live.qr, true, 'Actual Discord QR sign-in choice must be visible'); assert.ok(live.size[0]>=900);assert.equal(live.zoom,0.9);assert.equal(live.zoomMode,'isolated');assert.equal(live.sandboxDisabled, false); assert.equal(live.sandbox, true); assert.equal(live.nodeIntegration, false);
    console.log('Discord login loaded; checking 30-second video/render stability.');
    phase='settings-account-window';
    await new Promise(resolve=>setTimeout(resolve,30000));
    const stable=await page.evaluate(()=>window.omadisc.getState());
    assert.equal(stable.account.error,'');assert.equal(stable.account.open,true);assert.equal(live.remotePreload,false);assert.equal(live.contextIsolation,true);
    await page.getByRole('button',{name:'Done',exact:true}).click();
    const layouts = [];
    for (const count of [1, 2, 4, 6]) {
      await page.getByRole('button', { name: `${count} pane${count === 1 ? '' : 's'}`, exact: true }).click();
      const s = await page.evaluate(() => window.omadisc.getState());
      assert.equal(s.state.count, count); assert.equal(s.account.open, true);
      assert.equal(s.rects.length, count); layouts.push(count);
    }
    // All channels wait for the shared account sign-in window.
    for(let index=0;index<6;index++)await page.evaluate(index=>window.omadisc.dispatch({type:'assign',index,url:'https://discord.com/channels/@me',label:''}),index);
    phase='six-waiting-panes';
    await page.waitForFunction(async()=>{
      const s=await window.omadisc.getState();
      return s.account.open&&s.account.status==='required'&&Object.keys(s.statuses).length===6&&
        Object.values(s.statuses).every(v=>!v.loading&&!v.error)&&
        [0,1,2,3,4,5].every(index=>s.statuses[index].waiting);
    },undefined,{timeout:60000});
    await new Promise(resolve=>setTimeout(resolve,30000));
    const six=await page.evaluate(()=>window.omadisc.getState());
    assert.equal(Object.keys(six.statuses).length,6);
    assert.ok(Object.values(six.statuses).every(v=>!v.error),'Sign-in and waiting panes must stay healthy');
    const livePanes=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.filter(v=>v.webContents?.getURL().startsWith('https://discord.com/')).length);
    assert.equal(livePanes,0,'Waiting channel panes do not load separate sign-in pages');
    const accountWindows=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().startsWith('https://discord.com/')).length);
    assert.equal(accountWindows,1,'Only one central Discord sign-in window is needed');
    // No credential entry, QR capture or message sending.
    const memoryPeakMiB=peakFile?Math.round(Number(fs.readFileSync(peakFile,'utf8'))/1048576):null;
    assertContained(app.process().pid);
    const evidence = { checkedAt:new Date().toISOString(), version:require('../package.json').version, ...live, layouts, stableSeconds: 60, assignedPanes:6, livePanes, accountWindows, waitingPanes:6, memoryPeakMiB, authenticated: false, sentMessages: 0, fixtureInterception: false };
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(root, 'test-results', 'live-discord.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } finally { clearInterval(metrics);if (app) { const timer=setTimeout(()=>app.process().kill('SIGTERM'),5000);try{await app.close();}finally{clearTimeout(timer);} } fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
