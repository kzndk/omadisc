const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const {buildCompat}=require('../scripts/native.cjs');
const supported=process.platform==='linux'&&process.arch==='arm64';
const helper=path.resolve(__dirname,'../scripts/native.cjs');
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-native-build-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function invocation(dir){return ['-e',`require(${JSON.stringify(helper)}).buildCompat(${JSON.stringify(dir)})`];}
test('failed compiler preserves the previous complete native library and cleans staging',{skip:!supported},t=>{
 const dir=temp(t),out=buildCompat(dir),before=fs.readFileSync(out),inode=fs.statSync(out).ino;
 const tools=temp(t),cc=path.join(tools,'cc');
 // A failing compiler really writes partial output before exiting, as linkers can.
 fs.writeFileSync(cc,'#!/bin/sh\nwhile [ "$#" -gt 0 ]; do\n if [ "$1" = "-o" ]; then shift; printf "%s" "PARTIAL TEST COMPILER OUTPUT" > "$1"; exit 7; fi\n shift\ndone\nexit 8\n',{mode:0o755});
 const result=spawnSync(process.execPath,invocation(dir),{env:{...process.env,PATH:`${tools}:/usr/bin:/bin`},encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/Could not build/);
 // Compare bytes without asking Node to construct an unbounded binary assertion diff.
 assert.ok(fs.readFileSync(out).equals(before),'failed compilation must not replace or truncate the previous image');
 assert.equal(fs.statSync(out).ino,inode);assert.deepEqual(fs.readdirSync(dir),['libomadisc-compat.so']);
});
test('successful native rebuild replaces the pathname without changing an open old image',{skip:!supported},t=>{
 const dir=temp(t),out=buildCompat(dir),fd=fs.openSync(out,'r');t.after(()=>fs.closeSync(fd));
 const old=fs.readFileSync(fd),inode=fs.fstatSync(fd).ino;buildCompat(dir);
 assert.notEqual(fs.statSync(out).ino,inode,'publish must replace the inode atomically');
 const held=Buffer.alloc(old.length);fs.readSync(fd,held,0,held.length,0);assert.ok(held.equals(old),'open old image must retain its bytes');
 assert.equal(fs.statSync(out).mode&0o777,0o755);assert.deepEqual(fs.readdirSync(dir),['libomadisc-compat.so']);
});
test('concurrent real native builds each publish complete output and leave no temporary files',{skip:!supported},async t=>{
 const dir=temp(t),out=buildCompat(dir),fd=fs.openSync(out,'r');t.after(()=>fs.closeSync(fd));const before=fs.readFileSync(fd);
 await Promise.all(Array.from({length:3},()=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,invocation(dir),{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',s=>error+=s);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(error)));
 })));
 assert.deepEqual(fs.readFileSync(out).subarray(0,4),Buffer.from([0x7f,0x45,0x4c,0x46]));
 const held=Buffer.alloc(before.length);fs.readSync(fd,held,0,held.length,0);assert.ok(held.equals(before),'concurrent builds must preserve the open old image');
 assert.deepEqual(fs.readdirSync(dir),['libomadisc-compat.so']);
});
