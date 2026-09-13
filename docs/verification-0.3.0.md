# OmaDisc 0.3.0 — Omarchy channel design

Built and installed on 2026-09-13 for Linux ARM64. Close and reopen OmaDisc to use the new release; the existing 0.2.0 window was left open to preserve drafts.

The channel view now uses compact message rows, the active Omarchy palette, JetBrainsMono Nerd Font with monospace fallbacks, square avatars, thin separators and a minimal composer. Recognized channel layouts hide Discord's server/channel navigation, top app bar and member list. Each pane's **☰** button restores navigation without reloading; **←** returns to chat. Selecting another channel also returns to chat. Login and home navigation remain available. Help's **Use Omarchy chat design** switch restores the original Discord view.

This is a custom CSS presentation over Discord's message list and editor. It adds no remote script, token handling, API client or automated messaging. Selectors use semantic attributes and CSS-module prefixes rather than fixed hashes; the current public Discord stylesheet was checked for the app grid, sidebar, chat and composer structure. Discord may change these structures, so the original-view switch remains available.

Validation:

- 29 unit tests passed; build syntax checks passed.
- Five Electron integration tests passed on the source and installed bundle. The new test checks full-width chat geometry, navigation toggling independently in two panes, preserved editor drafts and fixture event handlers, return to chat after channel selection, original-style restoration, and visible login navigation.
- The packaged runtime reached real Discord sign-in on Wayland and stayed healthy for 60 seconds with one sign-in pane and five waiting assignments. The fully contained live test peaked at 587.1 MiB under the unchanged 1536 MiB cap.
- Installed source hashes match the verified source. Desktop entry validation passed. The existing browser profile and workspace were retained.

The [channel preview](images/channel-preview.png) contains local example messages. It is not a capture of the user's chat. Authenticated channel appearance and message sending have not been verified live; no real messages were sent.

Artifacts: `test-results/installed-manifest-0.3.0.json`, `test-results/live-discord.json`, `test-results/live-memory.json`, and `dist/omadisc-0.3.0-linux-arm64.tar.gz`. Source backup: `../omadisc-backups/before-channel-ui-0.3.0-20260913.tar.gz`.
