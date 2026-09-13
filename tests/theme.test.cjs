const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {parseColors,palette,readTheme,watchTheme,resolveTheme,discordCSS,themeFiles}=require('../src/theme.cjs');
const colors='background = "#0c0b0c"\nforeground = "#FAFCFB"\naccent = "#b59790"\n';
test('Omarchy colors are strict hex values, with safe derived UI colors',()=>{
  const parsed=parseColors(colors+'color1 = "url(https://example.com)"\n');
  assert.equal(parsed.color1,undefined);assert.equal(parsed.foreground,'#fafcfb');
  assert.equal(parseColors('background = "red"'),null);
  const theme=palette(parsed);assert.equal(theme.dark,true);
  assert.equal(theme.vars.bg,'#0c0b0c');assert.equal(theme.vars.accent,'#b59790');
  assert.ok(Object.values(theme.vars).every(v=>/^#[a-f0-9]{6}$/.test(v)));
  const css=discordCSS(theme);assert.match(css,/--background-base-low:#0c0b0c!important/);assert.doesNotMatch(css,/url\(|@import/);
  assert.equal(resolveTheme('system',theme,false),theme);assert.equal(resolveTheme('light',theme,true).dark,false);
});
test('theme discovery supports current and legacy Omarchy paths and XDG overrides',()=>{
  assert.deepEqual(themeFiles({XDG_STATE_HOME:'/state',XDG_CONFIG_HOME:'/config'},'/home/test'),['/state/omarchy/current/theme/colors.toml','/config/omarchy/current/theme/colors.toml']);
});
test('theme changes survive directory replacement, invalid partial files, and cleanup',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-theme-'));const themeDir=path.join(dir,'theme');fs.mkdirSync(themeDir);
  const file=path.join(themeDir,'colors.toml');fs.writeFileSync(file,colors);fs.writeFileSync(path.join(dir,'theme.name'),'last-horizon\n');
  assert.equal(readTheme([file]).name,'last horizon');
  const changes=[];const watcher=watchTheme(theme=>changes.push(theme),{files:[file],interval:20});
  t.after(()=>{watcher.close();fs.rmSync(dir,{recursive:true,force:true});});
  fs.rmSync(themeDir,{recursive:true});await new Promise(r=>setTimeout(r,60));assert.equal(changes.length,0);
  fs.mkdirSync(themeDir);fs.writeFileSync(file,'not a palette');await new Promise(r=>setTimeout(r,60));assert.equal(changes.length,0);
  fs.writeFileSync(file,colors.replace('#0c0b0c','#ffffff').replace('#FAFCFB','#151515'));
  for(let i=0;i<50&&!changes.length;i++)await new Promise(r=>setTimeout(r,20));
  assert.equal(changes.length,1);assert.equal(watcher.current.vars.bg,'#ffffff');assert.equal(watcher.current.dark,false);
});
