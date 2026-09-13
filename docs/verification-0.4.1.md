# OmaDisc 0.4.1 — Selected channel fills each pane

The running 0.4.0 app had Omarchy chat design enabled, but its selected channel still showed Discord's server and channel lists. The collapse selector assumed the sidebar was a direct child of the app grid. Discord's current layout places it inside a content subgrid. The original flat test fixture did not represent that structure.

The fix handles both nested and direct children and preserves Discord's named grid lines to avoid empty implicit columns. Selected channels now show messages and the composer beneath OmaDisc's pane header. The server/channel lists, account controls, duplicate Discord headers and member panel are hidden. Service notices keep their row above the chat. The ☰ control restores navigation without a reload; choosing a channel in Discord or through OmaDisc's + dialog returns to the compact view. Discord Home retains navigation until a conversation is selected.

The current grid structure was checked against Discord's public [app stylesheet](https://discord.com/assets/307314.9ca6eb41da8da923.css). The fixture now includes the nested content subgrid, named grid lines, server list, channel list, account panel, member wrapper and notice row. The integration check asserts full pane width without blank columns, visible composer bounds, hidden surrounding UI, restored navigation, retained drafts, same-channel selection without reload and compatibility with the earlier direct-child layout.

Validation on 2026-09-13:

- Build syntax checks and 30 unit tests passed.
- The focused channel-layout test passed on source. All six Electron integration tests passed on the packaged ARM64 runtime using the unchanged memory limits and private test bus.
- The installed source/runtime and desktop entry are verified in `test-results/installed-manifest-0.4.1.json`.

The [channel preview](images/channel-preview.png) contains local example messages. New layout behavior was verified with fixtures matching the current public grid structure. The active user session was kept open to retain drafts; reopen OmaDisc to load 0.4.1. No real messages were sent. The temporary capture used to diagnose the old layout was deleted.

Backup: `../omadisc-backups/before-channel-only-fix-0.4.1-20260913.tar.gz`. Bundle: `dist/omadisc-0.4.1-linux-arm64/`.
