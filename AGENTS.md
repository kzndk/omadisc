# Working on OmaDisc

- Run unit tests through `npm test`, E2E through `npm run test:e2e`, and live Discord checks through `npm run test:live`; their wrapper provides a separate systemd service with memory and time limits. Run the suites sequentially and retain the existing limits.
- Do not retry a failed test outside those limits or raise the limits to make an unexplained memory failure disappear. Diagnose a focused test with `npm test -- --test-name-pattern='pattern'`.
- Electron tests must use the private D-Bus session in the wrapper and assert cgroup containment. Chromium otherwise moves its main process into an uncapped XDG portal scope. Keep memory measurements in `test-results/live-memory.json`; process RSS totals double-count shared pages.
- Large binary assertions must compare with `Buffer.equals()` and assert the boolean result, rather than constructing a byte-by-byte deep-equality diff. The latter exhausted RAM and ended Codex terminal sessions on 2026-09-13.
- Native compatibility builds must compile to a unique staging path and atomically rename the completed library. A failed compiler must preserve the old library; concurrent builds must not share temporary output.
- Preserve unrelated work and commit source changes to Git. Keep local backups outside this repository; never commit browser profiles, credentials or private test captures.
