const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root=path.resolve(__dirname,'..');
function run(command,args,env=process.env){const r=spawnSync(command,args,{env,encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout;}
test('ARM compatibility is feature-selective and restricted to its adjacent OmaDisc runtime',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-native-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const lib=path.join(dir,'libomadisc-compat.so');
 run('cc',['-shared','-fPIC','-O2','-Wall','-Wextra','-Werror','-Wl,-z,relro,-z,now,-z,noexecstack','-o',lib,path.join(root,'src/native/arm-compat.c'),'-ldl','-pthread']);
 const probe=path.join(dir,'probe.c');
 fs.writeFileSync(probe,'#include <stdio.h>\n#include <sys/auxv.h>\nint main(void){ printf("%lu %lu %lu\\n",getauxval(AT_HWCAP),getauxval(AT_HWCAP2),getauxval(AT_PAGESZ)); return 0; }\n');
 const exe=path.join(dir,'omadisc-bin');run('cc',['-o',exe,probe]);
 const normal=run(exe,[]).trim().split(' ').map(BigInt);
 const compat=run(exe,[],{...process.env,LD_PRELOAD:lib}).trim().split(' ').map(BigInt);
 assert.equal(compat[2],normal[2],'unrelated auxv data is unchanged');
 const sme=1n<<23n,sve=1n<<22n;
 if(process.arch==='arm64' && !(normal[0]&sve) && (normal[1]&sme)){assert.equal(compat[1]&sme,0n);assert.equal(compat[0]&1n,normal[0]&1n);}else assert.deepEqual(compat,normal);
 fs.mkdirSync(path.join(dir,'unrelated')); const unrelated=path.join(dir,'unrelated','omadisc-bin');fs.copyFileSync(exe,unrelated);
 assert.deepEqual(run(unrelated,[],{...process.env,LD_PRELOAD:lib}).trim().split(' ').map(BigInt),normal,'inherited library does not change other applications');
 const contracts=path.join(dir,'contract.c');
 fs.writeFileSync(contracts,'#include <assert.h>\n#include "arm-caps.h"\nint main(void){ unsigned long value=~0UL; assert(omadisc_mask_caps(16,value,1)==value); assert(omadisc_mask_caps(26,value,1)==value); assert(omadisc_mask_caps(6,4096,0)==4096); assert((omadisc_mask_caps(26,value,0)&(1UL<<23))==0); assert((omadisc_mask_caps(26,value,0)&(1UL<<37))==0); assert((omadisc_mask_caps(16,value,0)&(1UL<<22))!=0); assert((omadisc_mask_caps(26,value,0)&(1UL<<13))!=0); return 0;}\n');
 run('cc',['-Wall','-Wextra','-Werror','-I',path.join(root,'src/native'),'-o',path.join(dir,'contract'),contracts]);run(path.join(dir,'contract'),[]);
});
