const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {installRelease}=require('../scripts/installer.cjs');
function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-install-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const home=path.join(base,'home'),source=path.join(base,'source');
 fs.mkdirSync(path.join(source,'resources/app/src/ui'),{recursive:true});
 fs.writeFileSync(path.join(source,'omadisc-release.json'),JSON.stringify({app:'omadisc',version:'0.1.0',arch:process.arch}));
 fs.writeFileSync(path.join(source,'omadisc'),'#!/bin/sh\n# TEST FIXTURE — never launched\n',{mode:0o755});
 fs.writeFileSync(path.join(source,'resources/app/src/ui/icon.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 return {home,source};
}
for(const file of ['.local/bin/omadisc','.local/share/applications/omadisc.desktop','.local/share/icons/hicolor/scalable/apps/omadisc.svg'])test(`refuses unrelated ${file} before switching or copying release`,t=>{
 const f=fixture(t),destination=path.join(f.home,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,'UNRELATED');
 assert.throws(()=>installRelease(f),/unrelated/);assert.equal(fs.readFileSync(destination,'utf8'),'UNRELATED');assert.ok(!fs.existsSync(path.join(f.home,'.local/share/omadisc')));
});
test('installs executable launcher, validated desktop and owned current release; repeated install is non-destructive',t=>{
 const f=fixture(t),result=installRelease(f);assert.ok(fs.lstatSync(result.current).isSymbolicLink());assert.equal(fs.realpathSync(result.current),result.release);assert.equal(fs.statSync(result.launcher).mode&0o777,0o755);
 assert.ok(fs.readFileSync(result.desktop,'utf8').includes('X-OmaDisc-Managed=true'));assert.equal(JSON.parse(fs.readFileSync(path.join(result.current,'omadisc-release.json'))).app,'omadisc');
 assert.throws(()=>installRelease(f),/already installed/);assert.equal(fs.realpathSync(result.current),result.release);
});
test('rejects unexpected current symlink without disturbing the target',t=>{
 const f=fixture(t),current=path.join(f.home,'.local/share/omadisc/current');fs.mkdirSync(path.dirname(current),{recursive:true});fs.symlinkSync(f.source,current);
 assert.throws(()=>installRelease(f),/current/);assert.equal(fs.readlinkSync(current),f.source);
});
