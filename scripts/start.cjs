const { spawn } = require('node:child_process');
const path = require('node:path');
const { compatibleEnv } = require('./native.cjs');
const exe=require('electron');
const child=spawn(exe,[path.resolve(__dirname,'..'),...process.argv.slice(2)],{stdio:'inherit',env:compatibleEnv(exe)});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
