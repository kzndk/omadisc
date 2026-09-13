const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readState, writeState } = require('../src/store.cjs');
const { defaultState, reduceState } = require('../src/model.cjs');
function fixture(t) { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omadisc-state-')); t.after(()=>fs.rmSync(dir,{recursive:true,force:true})); return path.join(dir,'nested','workspace.json'); }
test('first launch creates no config until a change', t => { const f=fixture(t); assert.deepEqual(readState(f),defaultState()); assert.equal(fs.existsSync(f),false); });
test('real atomic roundtrip keeps hidden assignments and strips unknown fields', t => {
  const f=fixture(t); let s=reduceState(defaultState(),{type:'assign',index:5,url:'https://discord.com/channels/123456789012345678/234567890123456789',label:'Build'}); s=reduceState(s,{type:'layout',count:6});
  writeState(f,{...s,token:'never-save-this'}); assert.deepEqual(readState(f),s); assert.equal(fs.statSync(f).mode & 0o777,0o600); assert.equal(fs.readFileSync(f,'utf8').includes('never-save-this'),false);
  writeState(f,reduceState(s,{type:'layout',count:1})); assert.equal(readState(f).panes[5].label,'Build'); assert.deepEqual(fs.readdirSync(path.dirname(f)),['workspace.json']);
});
test('corrupt or oversized config is explicit error, not silently overwritten', t => { const f=fixture(t); fs.mkdirSync(path.dirname(f)); for(const text of ['broken json','[]','{"version":99}',' '.repeat(100000)]) { fs.writeFileSync(f,text); assert.throws(()=>readState(f)); assert.equal(fs.readFileSync(f,'utf8'),text); } });
