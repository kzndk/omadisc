const { BrowserWindow, WebContentsView, session, ipcMain, nativeTheme, Menu } = require('electron');
const path = require('node:path');
const { readState, writeState } = require('./store.cjs');
const { channelURL, reduceState, layoutRects, paneIndex, HOME } = require('./model.cjs');
const { REMOTE_PREFERENCES, secureSession, secureRemote } = require('./security.cjs');
const { watchTheme, resolveTheme, discordCSS } = require('./theme.cjs');
const { SignIn, isSignInURL } = require('./sign-in.cjs');
const { guildFromURL, normalizeChannelDirectory, channelBrowserURL, DISCOVERY_SCRIPT } = require('./channel-directory.cjs');
const SHELL = 'omadisc://app/index.html';
async function createWorkspace(file) {
  let state = readState(file), focus = null, overlay = false, active = 0, notice = '', closed = false;
  const views = new Map(), statuses = new Map(), browsing = new Set(), directories = new Map(), directoryRevisions = new Map();
  const signIn = new SignIn();
  let accountWindow=null, accountError='', accountLoading=false;
  const themeWatcher = watchTheme(()=>applyTheme());
  let omarchyTheme = themeWatcher.current;
  function theme() { return resolveTheme(state.appearance,omarchyTheme,nativeTheme.shouldUseDarkColors); }
  const win = new BrowserWindow({ width: 1440, height: 950, minWidth: 820, minHeight: 620, title: 'OmaDisc', backgroundColor: '#111418', show: false, autoHideMenuBar: true, icon: path.join(__dirname,'ui','icon.svg'), webPreferences: { ...REMOTE_PREFERENCES, preload: path.join(__dirname,'preload.cjs') } });
  const discord = session.fromPartition('persist:discord');
  secureSession(discord);
  // Use the bundled Chromium identity, not a spoofed Chrome version or a Discord native-client token.
  discord.setUserAgent(discord.getUserAgent().replace(/\s(?:OmaDisc|omadisc)\/\S+/g, '').replace(/\sElectron\/\S+/g, ''));
  function rects() { const [w,h] = win.getContentSize(); return layoutRects(w,h,state.count,focus); }
  function selectedDirectory() { const index=focus??active,value=directories.get(index);return {index,loading:!!value?.loading,server:value?.server||'',channels:value?.channels||[]}; }
  function snapshot() { return { state, focus, overlay, active, notice, browsing:[...browsing], directory:selectedDirectory(), account:{status:signIn.status,open:!!accountWindow,loading:accountLoading,error:accountError}, theme:theme(), dark: nativeTheme.shouldUseDarkColors, rects: rects(), statuses: Object.fromEntries(statuses) }; }
  function publish() { if (!closed && !win.webContents.isDestroyed()) win.webContents.send('workspace:state', snapshot()); }
  function status(i, value) { statuses.set(i, { ...statuses.get(i), ...value }); publish(); }
  function persist(next) { writeState(file,next); state=next; notice=''; }
  function flushSession() { discord.flushStorageData();return discord.cookies.flushStore().catch(()=>{}); }
  function openAccount() {
    if(accountWindow) { accountWindow.show();accountWindow.focus();return; }
    signIn.begin();accountError='';accountLoading=true;
    // Discord presents password and QR sign-in side by side at its desktop
    // breakpoint. Keep this window wide enough for both choices, even when the
    // workspace itself uses a compact page scale.
    const login=new BrowserWindow({parent:win,width:1100,height:780,minWidth:900,minHeight:620,title:'Discord sign-in · Password or QR · OmaDisc',backgroundColor:theme().vars.bg,autoHideMenuBar:true,webPreferences:{...REMOTE_PREFERENCES,session:discord}});
    accountWindow=login;
    const wc=login.webContents;
    wc.setZoomMode('isolated');wc.setZoomFactor(0.9);
    secureRemote(wc,login);
    let completing=false;
    async function navigated(url) {
      if(completing||closed||accountWindow!==login)return;
      const result=signIn.observeAccount(url);
      if(result.signedIn) {
        completing=true;
        await flushSession();
        if(closed||accountWindow!==login)return;
        accountError='';
        for(const index of result.resume)if(state.panes[index].url)load(index,state.panes[index].url);
        login.destroy();win.focus();sync();
      } else publish();
    }
    wc.on('did-navigate',(_event,url)=>void navigated(url));
    wc.on('did-navigate-in-page',(_event,url,main)=>{if(main)void navigated(url);});
    wc.on('did-start-loading',()=>{accountLoading=true;publish();});
    // Navigation initializes the document's zoom. Reapply the isolated factor
    // after each Discord redirect so compact workspace zoom cannot hide the QR
    // choice and this account window cannot resize the channel panes.
    wc.on('did-finish-load',()=>wc.setZoomFactor(0.9));
    wc.on('did-stop-loading',()=>{accountLoading=false;publish();});
    function failed(message) { if(completing)return;accountError=message;login.destroy(); }
    wc.on('did-fail-load',(_event,code,_description,_url,main)=>{if(main&&code!==-3)failed(`Discord sign-in could not load (${code}). Check your connection and try again.`);});
    wc.on('render-process-gone',()=>failed('The sign-in window stopped responding. Please try again.'));
    login.on('page-title-updated',event=>event.preventDefault());
    login.on('closed',()=>{if(accountWindow===login){accountWindow=null;accountLoading=false;signIn.end();if(!closed)sync();}});
    // Start at login so Discord itself redirects an existing saved session to
    // channels. Merely loading /channels initially is not proof of sign-in.
    void wc.loadURL('https://discord.com/login').catch(()=>{});
    publish();
  }
  function applyTheme() {
    if(closed)return;
    omarchyTheme=themeWatcher.current;
    const colors=theme();win.setBackgroundColor(colors.vars.bg);
    for(const view of views.values()) { view.setBackgroundColor(colors.vars.bg);view.applyTheme?.(); }
    publish();
  }
  function navigation(i,url) {
    // Selecting another channel through the navigation returns to the chat view.
    if(browsing.has(i)&&channelURL(url)&&url!==HOME&&url!==state.panes[i].url) {
      browsing.delete(i);void views.get(i)?.applyTheme?.();
    }
    if(isSignInURL(url)) {
      signIn.require(i);status(i,{loading:false,error:null,waiting:true});
      const view=views.get(i);view?.webContents.stop();
      // Retire this signed-out renderer after the navigation callback. Login
      // belongs to Settings, and an unused Discord login page can be expensive.
      setImmediate(()=>{
        if(view&&!closed&&views.get(i)===view&&signIn.waiting.has(i)) {
          views.delete(i);win.contentView.removeChildView(view);view.webContents.close();sync();
        }
      });
      sync();return;
    }
    if(signIn.waiting.has(i))return;
    savedNavigation(i,url);sync();
  }
  function savedNavigation(i, url) {
    const valid = channelURL(url);
    if (!valid || valid === state.panes[i].url) return;
    try { persist(reduceState(state,{type:'assign',index:i,url:valid,label:state.panes[i].label})); }
    catch { notice='Could not save the latest channel. Check available disk space and permissions.'; }
    publish();
  }
  async function scanChannelBrowser(url,i,revision) {
    if(!url||closed||signIn.status==='required'||signIn.open)return null;
    const browser=new WebContentsView({webPreferences:{...REMOTE_PREFERENCES,session:discord,backgroundThrottling:false}}),wc=browser.webContents;
    browser.directoryDiscovery=true;
    win.contentView.addChildView(browser);browser.setBounds({x:-2000,y:-2000,width:1000,height:800});browser.setVisible(true);secureRemote(wc,win);
    const found=new Map();let latest=null;
    try {
      await wc.loadURL(url);
      if(signIn.status==='required'||signIn.open)return null;
      const expected=new URL(url),loaded=new URL(wc.getURL());
      if(loaded.origin!==expected.origin||loaded.pathname!==expected.pathname)return null;
      // The channel browser initially renders the familiar sidebar before its
      // complete directory. Preserve every result and keep waiting instead of
      // mistaking that first partial render for the finished server scan.
      for(const delay of [200,500,1000]) {
        await new Promise(resolve=>setTimeout(resolve,delay));
        if(closed||signIn.status==='required'||signIn.open||directoryRevisions.get(i)!==revision||wc.isDestroyed())return null;
        const raw=await wc.executeJavaScript(DISCOVERY_SCRIPT);
        if(raw&&Array.isArray(raw.channels)) {
          latest=raw;
          for(const channel of raw.channels)if(channel?.url)found.set(channel.url,channel);
        }
      }
    } catch { return null; }
    finally {
      try {if(!closed)win.contentView.removeChildView(browser);}catch{}
      if(!wc.isDestroyed())wc.close();
    }
    return latest?{...latest,channels:[...found.values()]}:null;
  }
  function refreshDirectory(i) {
    const view=views.get(i), revision=(directoryRevisions.get(i)||0)+1;directoryRevisions.set(i,revision);
    if(signIn.status==='required'||signIn.open||!view||view.webContents.isDestroyed()||!guildFromURL(view.webContents.getURL())) {if(view)view.directoryScan=false;directories.delete(i);syncGeometry();publish();return;}
    directories.set(i,{loading:true,server:directories.get(i)?.server||'',channels:directories.get(i)?.channels||[]});publish();
    const attempt=(number,delay)=>setTimeout(async()=>{
      if(closed||directoryRevisions.get(i)!==revision||views.get(i)!==view||view.webContents.isDestroyed())return;
      const scanNavigation=state.themeDiscord&&!browsing.has(i);let raw;
      try {
        raw=await view.webContents.executeJavaScript(DISCOVERY_SCRIPT);
        if(scanNavigation&&raw?.channels?.length){view.directoryScanRevision=revision;view.directoryScan=true;syncGeometry();await view.applyTheme?.();raw=await view.webContents.executeJavaScript(DISCOVERY_SCRIPT);}
        if(directoryRevisions.get(i)!==revision||view.webContents.isDestroyed())return;
        const browserURL=channelBrowserURL(view.webContents.getURL()),browserRaw=await scanChannelBrowser(browserURL,i,revision);
        if(browserRaw)raw={guild:raw.guild,server:raw.server||browserRaw.server,channels:[...raw.channels,...browserRaw.channels]};
        if(directoryRevisions.get(i)!==revision||view.webContents.isDestroyed())return;
        const value=normalizeChannelDirectory(view.webContents.getURL(),raw);
        if(value.channels.length||number===2) {directories.set(i,{...value,loading:false});publish();return;}
      } catch { if(number===2){directories.set(i,{loading:false,server:'',channels:[]});publish();return;} }
      finally {if(scanNavigation&&view.directoryScanRevision===revision){view.directoryScan=false;await view.applyTheme?.();syncGeometry();}}
      attempt(number+1,number===0?350:900);
    },delay);
    attempt(0,0);
  }
  function shortcut(event, input, index) {
    if (input.type !== 'keyDown') return;
    if (input.control && input.alt && ['1','2','4','6'].includes(input.key)) { event.preventDefault(); act({type:'layout',count:Number(input.key)}); }
    else if (input.control && input.key.toLowerCase()==='l') { event.preventDefault(); win.webContents.send('workspace:command',{type:'choose',index}); win.webContents.focus(); }
    else if (input.control && input.shift && input.key.toLowerCase()==='f') { event.preventDefault(); act({type:'focus',index}); }
    else if (input.alt && !input.control && /^[1-6]$/.test(input.key)) { const i=Number(input.key)-1; if(i<state.count) {event.preventDefault(); active=i; if(focus!==null)focus=i; sync(); views.get(i)?.webContents.focus();} }
    else if (input.control && input.key.toLowerCase()==='r') {event.preventDefault(); act({type:'reload',index});}
    else if (input.key==='Escape' && focus!==null && !overlay) { event.preventDefault(); focus=null; sync(); }
  }
  function createPane(i) {
    const view = new WebContentsView({ webPreferences: { ...REMOTE_PREFERENCES, session: discord } });
    view.directoryScan=false;
    views.set(i,view); win.contentView.addChildView(view); view.setBackgroundColor('#202127');
    const wc=view.webContents; secureRemote(wc,win);
    let styleKey=null,styleRevision=0;
    view.applyTheme=async()=>{
      const revision=++styleRevision;
      if(wc.isDestroyed())return;
      const old=styleKey;styleKey=null;
      if(old)await wc.removeInsertedCSS(old).catch(()=>{});
      if(!state.themeDiscord||wc.isDestroyed()||!wc.getURL().startsWith('https://discord.com/'))return;
      try {
        // Electron 44 does not remove user-origin sheets reliably. Author-origin
        // !important rules keep the theme removable without reloading drafts.
        const key=await wc.insertCSS(discordCSS(theme(),{navigation:browsing.has(i)||view.directoryScan}),{cssOrigin:'author'});
        if(revision!==styleRevision||wc.isDestroyed()) { if(!wc.isDestroyed())await wc.removeInsertedCSS(key).catch(()=>{}); }
        else styleKey=key;
      } catch { /* A navigation can replace the document during a theme change. */ }
    };
    wc.on('did-start-navigation',(_event,_url,inPlace,main)=>{if(main){view.directoryScan=false;directories.delete(i);directoryRevisions.set(i,(directoryRevisions.get(i)||0)+1);if(!inPlace){styleKey=null;styleRevision++;}}});
    wc.on('dom-ready',()=>void view.applyTheme());
    wc.on('before-input-event',(event,input)=>shortcut(event,input,i));
    wc.on('focus',()=>{active=i;publish();});
    wc.on('did-start-loading',()=>{status(i,{loading:true,error:null});syncGeometry();});
    wc.on('did-stop-loading',()=>status(i,{loading:false}));
    wc.on('did-finish-load',()=>{wc.setZoomFactor(state.zoom);status(i,{error:null});syncGeometry();refreshDirectory(i);});
    wc.on('did-navigate',(_event,url)=>navigation(i,url));
    wc.on('did-navigate-in-page',(_event,url,main)=>{if(main){navigation(i,url);refreshDirectory(i);}});
    wc.on('page-title-updated',(_event,title)=>status(i,{title:title.slice(0,160)}));
    wc.on('did-fail-load',(_e,code,_description,_url,main)=>{if(main&&code!==-3){status(i,{loading:false,error:`Discord could not load (${code}). Check your connection, then reload.`});syncGeometry();}});
    wc.on('render-process-gone',(_event,details)=>{console.error(`OmaDisc pane ${i+1} process exited: ${details.reason} (${details.exitCode})`);status(i,{loading:false,error:`This pane stopped responding (${details.reason}). Reload to reconnect.`});syncGeometry();});
    wc.on('context-menu',(_e,params)=>{const items=params.isEditable?[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]:[{role:'copy',enabled:!!params.selectionText},{role:'selectAll'}];Menu.buildFromTemplate(items).popup({window:win});});
    return view;
  }
  function load(i,url) {
    if(signIn.defer(i)) { status(i,{loading:false,error:null,waiting:true});return; }
    signIn.remove(i);
    const view=views.get(i)||createPane(i); status(i,{loading:true,error:null,waiting:false});
    void view.webContents.loadURL(url).catch(()=>{});
  }
  function syncGeometry() {
    if (closed) return;
    const visible = new Map(rects().map(r=>[r.index,r]));
    for(const [i,v] of views) { const r=visible.get(i); if(r)v.setBounds(r.content); const shown=!!r&&!overlay&&!v.directoryScan&&!statuses.get(i)?.error&&!statuses.get(i)?.waiting;v.setVisible(shown);v.webContents.setAudioMuted(!shown); }
  }
  function sync() {
    if(closed)return;
    for(const {index} of rects()) if(state.panes[index].url&&(!views.has(index)||statuses.get(index)?.waiting)) {
      if(signIn.status==='required'||signIn.open) {
        if(!statuses.get(index)?.waiting) {signIn.waiting.add(index);status(index,{loading:false,error:null,waiting:true});}
      } else load(index,state.panes[index].url);
    }
    syncGeometry(); publish();
  }
  function act(action) {
    try {
      if (!action || typeof action!=='object') throw new Error('Invalid action.');
      switch(action.type) {
        case 'account-sign-in': openAccount();break;
        case 'overlay': if(typeof action.value!=='boolean') throw new Error('Invalid overlay.'); overlay=action.value; break;
        case 'focus': {const i=paneIndex(action.index);if(i>=state.count)throw new Error('Pane is hidden.');focus=focus===i?null:i;active=i;break;}
        case 'unfocus': focus=null;break;
        case 'reload': {const i=paneIndex(action.index);if(state.panes[i].url)load(i,state.panes[i].url);break;}
        case 'navigation': {
          const i=paneIndex(action.index);
          if(i>=state.count)throw new Error('Pane is hidden.');
          if(browsing.has(i))browsing.delete(i);else browsing.add(i);
          void views.get(i)?.applyTheme?.();break;
        }
        default: {
          const next=reduceState(state,action); const previous=state; persist(next);
          if(action.type==='layout') {focus=null;active=Math.min(active,state.count-1);}
          if(action.type==='assign') {
            browsing.delete(action.index);
            if(previous.panes[action.index].url!==state.panes[action.index].url)load(action.index,state.panes[action.index].url);
            else void views.get(action.index)?.applyTheme?.();
          }
          if(action.type==='clear') {browsing.delete(action.index);directories.delete(action.index);directoryRevisions.set(action.index,(directoryRevisions.get(action.index)||0)+1);signIn.remove(action.index);const v=views.get(action.index);if(v){win.contentView.removeChildView(v);v.webContents.close();views.delete(action.index);}statuses.delete(action.index);}
          if(action.type==='zoom')for(const v of views.values())v.webContents.setZoomFactor(state.zoom);
          if(action.type==='appearance'||action.type==='theme-discord')applyTheme();
        }
      }
      sync();return {ok:true};
    } catch(error) { return {ok:false,error: error.code ? 'Could not save workspace. Check disk space and file permissions.' : error.message}; }
  }
  function authorized(event) { return !closed && event.sender===win.webContents && event.senderFrame===win.webContents.mainFrame && event.senderFrame.url===SHELL; }
  ipcMain.handle('workspace:get',event=>{if(!authorized(event))throw new Error('Unauthorized');return snapshot();});
  ipcMain.handle('workspace:action',(event,action)=>{if(!authorized(event))throw new Error('Unauthorized');return act(action);});
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.webContents.on('before-input-event',(e,input)=>shortcut(e,input,active));
  win.on('page-title-updated',event=>event.preventDefault());
  // Compositor fullscreen changes can update native view bounds without a
  // BrowserWindow resize event. Reflow after the native layout has settled.
  let reflowQueued=false;
  function queueReflow() { if(reflowQueued||closed)return;reflowQueued=true;setImmediate(()=>{reflowQueued=false;if(!closed)sync();}); }
  win.contentView.on('bounds-changed',queueReflow);
  for(const event of ['resize','enter-full-screen','leave-full-screen','maximize','unmaximize'])win.on(event,queueReflow);
  const themeChanged=()=>applyTheme(); nativeTheme.on('updated',themeChanged);
  win.on('close',()=>void flushSession());
  win.on('closed',()=>{closed=true;accountWindow?.destroy();themeWatcher.close();nativeTheme.removeListener('updated',themeChanged);ipcMain.removeHandler('workspace:get');ipcMain.removeHandler('workspace:action');for(const view of views.values())if(!view.webContents.isDestroyed())view.webContents.close();views.clear();});
  await win.loadURL(SHELL);applyTheme();sync();win.show();return win;
}
module.exports={createWorkspace};
