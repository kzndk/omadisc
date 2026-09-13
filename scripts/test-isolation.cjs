const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function assertContained(pid) {
  const own=fs.readFileSync('/proc/self/cgroup','utf8');
  assert.equal(fs.readFileSync(`/proc/${pid}/cgroup`,'utf8'),own,'Electron must stay in the memory-limited test service');
  const group=own.split('\n').find(line=>line.startsWith('0::'))?.slice(3);
  assert.ok(group,'Tests require cgroup v2');
  const limit=Number(fs.readFileSync(path.join('/sys/fs/cgroup',group,'memory.max'),'utf8'));
  assert.ok(Number.isFinite(limit)&&limit>0&&limit<=1536*1048576,'Electron tests must retain their memory cap');
}
module.exports={assertContained};
