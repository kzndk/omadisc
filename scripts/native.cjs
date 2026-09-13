const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
function buildCompat(directory) {
  if (process.platform !== 'linux' || process.arch !== 'arm64') return null;
  const output=path.join(directory,'libomadisc-compat.so');
  // Compile beside the destination, then publish only a complete library. Each
  // build has its own staging directory, including concurrent invocations.
  const staging=fs.mkdtempSync(path.join(directory,'.omadisc-native-'));
  try {
    const staged=path.join(staging,'libomadisc-compat.so');
    const result=spawnSync('cc',['-shared','-fPIC','-O2','-Wall','-Wextra','-Werror','-Wl,-z,relro,-z,now,-z,noexecstack','-o',staged,path.resolve(__dirname,'../src/native/arm-compat.c'),'-ldl','-pthread'],{stdio:'inherit'});
    if(result.error||result.status!==0)throw new Error('Could not build the ARM media compatibility library. Install a C compiler.');
    fs.chmodSync(staged,0o755);
    fs.renameSync(staged,output);
    return output;
  } finally {
    fs.rmSync(staging,{recursive:true,force:true});
  }
}
function compatibleEnv(executable) {
  const lib=buildCompat(path.dirname(executable));
  return {...process.env,ELECTRON_RUN_AS_NODE:'',...(lib?{LD_PRELOAD:[lib,process.env.LD_PRELOAD].filter(Boolean).join(':')}:{})};
}
module.exports={buildCompat,compatibleEnv};
