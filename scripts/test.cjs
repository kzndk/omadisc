const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const [suite = 'unit', ...options] = process.argv.slice(2);
if (!['unit', 'e2e', 'live'].includes(suite)) throw new Error('Choose the unit, e2e or live test suite.');
const e2e = suite !== 'unit';
const live = suite === 'live';
if (live && options.length) throw new Error('Live smoke checks do not accept test filters.');
const directory = path.join(root, 'tests', ...(e2e ? ['e2e'] : []));
const files = live ? [path.join(root, 'scripts', 'smoke-live.cjs')] : fs.readdirSync(directory).filter(file => file.endsWith('.test.cjs')).sort().map(file => path.join(directory, file));
if (!files.length) throw new Error('No test files found.');

// Keep the complete test process tree in its own cgroup. A V8 heap limit alone
// does not bound native buffers, compiler children, or Electron processes.
const args = [
  '--user', '--pipe', '--wait', '--collect',
  `--working-directory=${root}`,
  '-p', `MemoryMax=${e2e ? '1536M' : '768M'}`,
  '-p', 'MemorySwapMax=0',
  '-p', `RuntimeMaxSec=${e2e ? '300s' : '120s'}`,
  '-p', 'LimitCORE=0',
  '-p', 'OOMPolicy=kill',
];
// A user service may have an older environment than the calling terminal.
for (const key of ['PATH', 'DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS',
  'XDG_CONFIG_HOME', 'XDG_STATE_HOME', 'XDG_DATA_HOME', 'OMADISC_TEST_APP', 'OMADISC_TEST_EXE', 'OMADISC_THEME_FILE']) {
  if (process.env[key] !== undefined) args.push(`--setenv=${key}=${process.env[key]}`);
}
// Chromium registers an XDG portal scope through the session bus and moves its
// main process out of this service. A private test bus keeps that process tree
// inside the limit; normal installed launches still use the desktop session.
if (e2e) args.push('dbus-run-session', `--config-file=${path.join(__dirname,'test-bus.conf')}`, '--');
args.push(process.execPath, '--max-old-space-size=256');
if (!live) args.push('--test', '--test-concurrency=1', `--test-timeout=${e2e ? 240000 : 30000}`, ...options);
args.push(...files);
const result = spawnSync('systemd-run', args, { cwd: root, stdio: 'inherit' });
if (result.error) console.error(`Could not start memory-limited tests: ${result.error.message}`);
if (result.error || result.signal || result.status !== 0) {
  console.error('Tests failed or could not start. A systemd user session with memory-controller support is required; no unrestricted retry was attempted.');
}
process.exit(result.status ?? 1);
