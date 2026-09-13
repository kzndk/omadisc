const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { defaultState, normalizeState } = require('./model.cjs');
function readState(file) {
  try {
    if (fs.statSync(file).size > 32768) throw new Error('Workspace file is too large.');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) throw new Error('Unsupported workspace format.');
    return normalizeState(raw);
  } catch (error) { if (error.code === 'ENOENT') return defaultState(); throw error; }
}
function writeState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temp, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(normalizeState(state), null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
  } finally { try { fs.unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
}
module.exports = { readState, writeState };
