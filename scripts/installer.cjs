const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const exists=p=>{try{return fs.lstatSync(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const escape=s=>s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/`/g,'\\`').replace(/\$/g,'\\$').replace(/%/g,'%%');
function installRelease({source,home}) {
 const marker=JSON.parse(fs.readFileSync(path.join(source,'omadisc-release.json'),'utf8'));
 if(marker.app!=='omadisc'||!/^\d+\.\d+\.\d+$/.test(marker.version)||!['arm64','x64'].includes(marker.arch))throw new Error('Invalid OmaDisc release metadata.');
 const install=path.join(home,'.local/share/omadisc'),releases=path.join(install,'releases'),release=path.join(releases,`${marker.version}-${marker.arch}`),current=path.join(install,'current');
 const launcher=path.join(home,'.local/bin/omadisc'),desktop=path.join(home,'.local/share/applications/omadisc.desktop'),icon=path.join(home,'.local/share/icons/hicolor/scalable/apps/omadisc.svg');
 if(exists(release))throw new Error(`Release already installed: ${release}. Close OmaDisc before replacing an owned release, or increment the version.`);
 // All ownership checks precede copying or switching any release.
 const link=exists(current);
 if(link){
  if(!link.isSymbolicLink())throw new Error('Refusing unexpected current target.');
  const target=path.resolve(path.dirname(current),fs.readlinkSync(current));
  if(path.dirname(target)!==releases)throw new Error('Refusing unrelated current target.');
  let old;try{old=JSON.parse(fs.readFileSync(path.join(target,'omadisc-release.json'),'utf8'));}catch{throw new Error('Refusing unverified current target.');}
  if(old.app!=='omadisc')throw new Error('Refusing unrelated current release.');
 }
 for(const [file,mark] of [[launcher,'# OmaDisc managed launcher'],[desktop,'X-OmaDisc-Managed=true']]){
  const stat=exists(file);if(stat&&(!stat.isFile()||!fs.readFileSync(file,'utf8').includes(mark)))throw new Error(`Refusing unrelated file: ${file}`);
 }
 if(exists(icon)&&(!link||!exists(icon).isFile()))throw new Error(`Refusing unrelated icon: ${icon}`);
 const text=`[Desktop Entry]\nVersion=1.0\nType=Application\nName=OmaDisc\nComment=Discord channels, side by side\nExec="${escape(launcher)}"\nIcon=omadisc\nTerminal=false\nCategories=Network;InstantMessaging;\nKeywords=Discord;Chat;Grid;Omarchy;\nStartupWMClass=omadisc\nX-OmaDisc-Managed=true\n`;
 const validation=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-desktop-'));
 try{
  const file=path.join(validation,'omadisc.desktop');fs.writeFileSync(file,text);
  const result=spawnSync('desktop-file-validate',[file],{encoding:'utf8'});
  if(result.error||result.status!==0)throw new Error('Desktop validation failed before installation. Is desktop-file-validate installed?');
 }finally{fs.rmSync(validation,{recursive:true,force:true});}
 const staged=`${release}.staging-${process.pid}`,next=`${current}.next-${process.pid}`;
 const pending=[];
 try{
  fs.mkdirSync(releases,{recursive:true});fs.cpSync(source,staged,{recursive:true,errorOnExist:true,force:false});
  for(const [file,contents,mode] of [
   [launcher,'#!/bin/sh\n# OmaDisc managed launcher\nunset ELECTRON_RUN_AS_NODE\nexec "$HOME/.local/share/omadisc/current/omadisc" "$@"\n',0o755],
   [desktop,text,0o644],
   [icon,fs.readFileSync(path.join(staged,'resources/app/src/ui/icon.svg')),0o644]
  ]){
   fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.next-${process.pid}`;
   fs.writeFileSync(tmp,contents,{flag:'wx',mode});pending.push([tmp,file]);
  }
  fs.renameSync(staged,release);
  fs.symlinkSync(release,next);
  for(const [tmp,file] of pending)fs.renameSync(tmp,file);
  // Only expose the runtime after validation and every prepared launcher asset succeeds.
  fs.renameSync(next,current);
 }finally{
  if(exists(staged))fs.rmSync(staged,{recursive:true});
  if(exists(next))fs.unlinkSync(next);
  for(const [tmp] of pending)if(exists(tmp))fs.unlinkSync(tmp);
 }
 spawnSync('update-desktop-database',[path.dirname(desktop)],{stdio:'ignore'});
 return {release,current,launcher,desktop};
}
module.exports={installRelease};
