const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chatCSS } = require('./chat-style.cjs');

const DARK = { background:'#111418', foreground:'#e6e9ef', accent:'#b2dac7', color1:'#f2a49d' };
const LIGHT = { background:'#e9ece8', foreground:'#1e2922', accent:'#30644b', color1:'#a82c28' };
function parseColors(text) {
  const colors = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([a-z][a-z0-9_]*)\s*=\s*["'](#[0-9a-fA-F]{6})["']\s*(?:#.*)?$/);
    if (match) colors[match[1]] = match[2].toLowerCase();
  }
  return colors.background && colors.foreground && colors.accent ? colors : null;
}
const rgb = color => [1,3,5].map(i => parseInt(color.slice(i,i+2),16));
function blend(a,b,weight) {
  const other=rgb(b);
  return '#'+rgb(a).map((v,i)=>Math.round(v*(1-weight)+other[i]*weight).toString(16).padStart(2,'0')).join('');
}
function luminance(color) { return rgb(color).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0); }
function palette(colors, name='Omarchy') {
  const bg=colors.background, fg=colors.foreground, accent=colors.accent;
  return { name, dark:luminance(bg)<luminance(fg), vars:{
    bg, panel:blend(bg,fg,0.035), raised:blend(bg,fg,0.085), line:blend(bg,fg,0.20), fg,
    muted:blend(bg,fg,0.68), accent, 'accent-ink':luminance(accent)>0.179?'#000000':'#ffffff',
    border:colors.active_border_color||accent, danger:colors.color1||accent,
    selection:colors.selection_background||accent, 'selection-ink':colors.selection_foreground||bg
  }};
}
function themeFiles(env=process.env, home=os.homedir()) {
  if(env.OMADISC_THEME_FILE) return [path.resolve(env.OMADISC_THEME_FILE)];
  return [path.join(env.XDG_STATE_HOME||path.join(home,'.local/state'),'omarchy/current/theme/colors.toml'),
    path.join(env.XDG_CONFIG_HOME||path.join(home,'.config'),'omarchy/current/theme/colors.toml')];
}
function readTheme(files=themeFiles()) {
  for(const file of files) {
    try {
      if(fs.statSync(file).size>65536) continue;
      const colors=parseColors(fs.readFileSync(file,'utf8')); if(!colors) continue;
      let name='Omarchy';
      try { name=fs.readFileSync(path.resolve(file,'../../theme.name'),'utf8').trim().replace(/-/g,' ').slice(0,80)||name; } catch {}
      return palette(colors,name);
    } catch { /* Themes can be replaced atomically while the application runs. */ }
  }
  return null;
}
function watchTheme(callback, {files=themeFiles(),interval=1500}={}) {
  let current=readTheme(files), signature=JSON.stringify(current);
  const timer=setInterval(()=>{
    const next=readTheme(files);
    if(!next) return; // Keep the last palette during a theme switch or a partial write.
    const nextSignature=JSON.stringify(next);
    if(nextSignature!==signature) { current=next;signature=nextSignature;callback(next); }
  },interval);
  timer.unref();
  return { get current() { return current; }, close:()=>clearInterval(timer) };
}
function resolveTheme(appearance, omarchy, dark) {
  if(appearance==='system' && omarchy) return omarchy;
  return palette(appearance==='light'||(appearance==='system'&&!dark)?LIGHT:DARK,appearance==='system'?'System':appearance);
}
function discordCSS(theme, options) {
  const v=theme.vars;
  // Override only presentation. No script, token access, remote preload or private API.
  const groups = [
    [['background-primary','background-base-low','background-surface-high','background-default'],v.bg],
    [['background-secondary','background-secondary-alt','background-base-lower','background-surface-higher','background-mobile-primary','card-primary-bg'],v.panel],
    [['background-tertiary','background-base-lowest','background-floating','background-mobile-secondary','modal-background','modal-footer-background','background-surface-highest'],v.bg],
    [['background-modifier-hover','background-modifier-active','background-modifier-selected','background-message-hover','input-background','input-background-default','channeltextarea-background','chat-background-default','button-secondary-background'],v.raised],
    [['text-normal','text-primary','header-primary','interactive-active','interactive-text-active','channels-default','button-secondary-text'],v.fg],
    [['text-muted','text-secondary','header-secondary','interactive-normal','interactive-icon-default','interactive-text-default','interactive-muted'],v.muted],
    [['text-link','text-brand','brand-500','brand-560','brand-experiment','control-brand-foreground','control-primary-background-default','button-filled-brand-background'],v.accent],
    [['control-primary-text-default','button-filled-brand-text'],v['accent-ink']],
    [['background-modifier-accent','border-subtle','border-normal','input-border','app-border-frame'],v.line],
    [['status-danger','text-danger'],v.danger]
  ];
  const declarations=groups.flatMap(([names,value])=>names.map(name=>`--${name}:${value}!important;`)).join('');
  const ownVariables=Object.entries(v).map(([name,value])=>`--omadisc-${name}:${value}!important;`).join('');
  return `:root,body,.theme-dark,.theme-light,.theme-darker,.theme-midnight{${declarations}${ownVariables}color-scheme:${theme.dark?'dark':'light'}!important;}
    html,body{background-color:${v.bg}!important;color:${v.fg}!important;}
    ::selection{background:${v.selection}!important;color:${v['selection-ink']}!important;}
    ${chatCSS(options)}`;
}
module.exports={parseColors,palette,readTheme,watchTheme,resolveTheme,discordCSS,themeFiles};
