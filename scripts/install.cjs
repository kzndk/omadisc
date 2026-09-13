const path = require('node:path');
const os = require('node:os');
const pkg = require('../package.json');
const source = path.resolve(__dirname, '..', 'dist', `omadisc-${pkg.version}-linux-${process.arch}`);
const {launcher,desktop,release}=require('./installer.cjs').installRelease({source,home:os.homedir()});
console.log(`Installed OmaDisc ${pkg.version}: ${launcher}\nDesktop entry: ${desktop}\nRuntime: ${release}`);
