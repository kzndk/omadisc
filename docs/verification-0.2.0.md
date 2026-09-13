# OmaDisc 0.2.0 verification

Verified on 2026-09-13 on this ARM64 Omarchy desktop, with Electron 44.3.0 and 15 GiB usable RAM.

- Installed and opened `~/.local/share/omadisc/releases/0.2.0-arm64/` through the managed launcher. The existing profile and workspace were retained; release 0.1.0 remains available.
- JavaScript syntax checks passed. All 29 unit tests passed, including failed/concurrent native builds and preservation of an open library image. The build's unit service peaked at 92.5 MiB.
- All four Electron integration tests passed against the installed bundle. They cover six independent panes, drafts and persistence, navigation security, shared fixture sign-in and clearing its gate, theme replacement and immediate opt-out without losing a draft. With the final private test bus and containment assertions, the service peaked at 465.8 MiB.
- The installed bundle reached the real Discord login form on native Wayland and remained healthy for 60 seconds. Six channel assignments used one actual sign-in view and five waiting panes. The final fully contained test service peaked at 590.6 MiB, below its unchanged 1536 MiB limit, with no swap.
- `npm audit` reported zero vulnerabilities. Desktop entry validation passed. Installed source hashes match the verified project source. The normal installed window is mapped on Wayland, with sandboxed renderers and no debugging endpoint.

The theme opt-out initially failed because removing an inserted user-origin stylesheet left its colors active in Electron 44.3.0. Author-origin `!important` rules passed the regression test and restore site colors without a reload.

An early live run exhausted the 1536 MiB service limit, with about 675 MiB of shared memory and 832 MiB of anonymous memory reported by the kernel. Follow-up investigation found that Chromium's XDG portal registration moved the browser process into a separate, uncapped systemd scope. Earlier 467.5/494.2 MiB measurements therefore excluded that process and are not whole-app measurements. The test wrapper now uses a private D-Bus session without service activation and explicitly verifies that the browser remains in the capped cgroup. The original spike's precise trigger was not reproduced; it is not claimed fixed by the containment change. Memory and time limits were not raised.

Evidence is in `test-results/live-discord.json`, `live-memory.json`, `installed-runtime.json`, and `installed-manifest.json`. The standalone archive is `dist/omadisc-0.2.0-linux-arm64.tar.gz`. The pre-resume source backup is `../omadisc-backups/before-resume-0.2.0-20260913.tar.gz`.

Authenticated chat, real message sending and six authenticated Discord pages have not been tested. Fixture sign-in does not prove those behaviors. The isolated test bus does not cover desktop portal integrations; the normal installed launch retains the real desktop session.
