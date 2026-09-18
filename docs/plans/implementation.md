# OmaDisc Implementation Plan

**Goal:** Installed Omarchy app with 1/2/4/6 simultaneously visible, independently navigable Discord channels and personal identity.
**Architecture:** Electron 44 shell + sandboxed WebContentsViews rendering Discord Web. This supersedes the prior bot-client suggestion: a bot would not preserve personal authorship. No user-token extraction, API automation, remote preload, injected Discord script, iframe/CSP bypass or automated login. Shared dedicated persistent browser session. Vanilla HTML/CSS/JS local shell and validated private JSON preferences. Version 0.2 adds optional presentation-only Discord CSS, following the Omarchy desktop palette.
**Design:** Compact utilitarian chrome, visible 1/2/4/6 selector, pane headers with choose/reload/focus. Empty slots accept a Discord channel link or browse through Discord's own picker. Hide rather than destroy panes on layout reduction; preserve drafts. Temporary focus, keyboard navigation, workspace-wide page scale and Omarchy/light/dark appearance. Settings provides the Discord account connection and chat-design opt-out. Open a single dedicated account window using the existing persistent Discord partition, defer signed-out/new panes, and resume their assigned channels after sign-in without reloading active drafts or changing the layout.
**Scope:** Text-channel web workspace. Voice/video/screenshare denied and out of scope. External links prompt then open in system browser. Downloads use native save dialog. No message posting or login automation during development.

## Task 1: Pure contracts (RED then GREEN)
Create tests/model.test.cjs then src/model.cjs. `npm test` must cover strict official HTTPS channel/DM/thread URLs without token queries or identifier repairs; exact layouts, geometry/no overlap; retained hidden assignments; bounded labels/zoom/appearance; unknown-action rejection.
## Task 2: Persistence (RED then GREEN)
Create tests/store.test.cjs then src/store.cjs. Test real temp filesystem roundtrips, 0600 permissions, atomic replacement, unknown-field exclusion, explicit corrupt/oversized config failure. Never silently overwrite corrupt data.
## Task 3: Native app
Create src/main.cjs, src/window.cjs, src/security.cjs, src/preload.cjs and src/ui/* assets. Strict local custom protocol and sender-frame-validated IPC, no Electron bridge in remote views. Remote sandbox/contextIsolation/webSecurity, no Node/preload. Top-level navigation HTTPS discord.com only. Confirm external links; deny unneeded permission/hardware/media requests. Close all views on shutdown. Save stable channel navigation, never login/query URLs. Keep hidden panes alive and muted.
## Task 4: Electron integration
Create tests/e2e/workspace.test.cjs using Playwright Electron with temporary --user-data-dir. Test-harness-only interception provides explicitly labelled fixtures; no production network bypass. Prove unique live views, per-pane routes/drafts, focus/layout/modal geometry, resize, reload, validation, security preferences and relaunch persistence. Separately verify actual Discord loads to the sign-in gate. Capture no private chat data.
## Task 5: Package/install
Create scripts/build.cjs, scripts/install.cjs, icon, README, LICENSE. Build standalone Linux bundle from locked Electron runtime without sudo, system package mutation or sandbox-disable flags. User-local ~/.local/share/omadisc runtime, ~/.local/bin/omadisc launcher, applications desktop entry. Source is maintained in the public `kzndk/omadisc` repository. Keep local installation data and unrelated changes outside source commits.
## Completion
Fresh core/e2e tests, dependency audit, build, desktop-file validation, installed real Wayland launch. Authenticated chat behavior remains a user-login gate; do not represent fixture tests as real Discord message proof.

Version 0.2.0 is built, installed and running as of 2026-09-13. See [verification and remaining limits](../verification-0.2.0.md), including the test-cgroup containment fix and the observed live memory spike.

Version 0.3.0 adds an Omarchy channel layout over Discord's message list/editor: compact monospace rows, square avatars, a minimal composer, and per-pane navigation toggles without reload. It is installed and loads on the next app restart. See [0.3.0 verification](../verification-0.3.0.md) and the fixture preview.

Version 0.4.0 moves sign-in to **Settings → Discord account**. A single sandboxed account window shares the existing persistent Discord partition with every channel. Waiting panes reconnect after sign-in; active drafts and the selected layout remain intact. Cancellation, retry, session expiry and persisted fixture storage are covered by integration tests. See [0.4.0 verification](../verification-0.4.0.md).

Version 0.4.1 fixes channel-only panes for Discord's nested content subgrid, preserving named grid lines and service notices while hiding server/channel navigation, account controls, duplicate headers and members. Choosing a channel through + also exits navigation. The fixture now models the nested layout and checks full-width messages, composer bounds, navigation restoration and retained drafts. See [0.4.1 verification](../verification-0.4.1.md).

Version 0.5.0 adds a top toolbar menu for the active pane's Discord server. A fixed read-only DOM query collects the server name and rendered channel links, while the main process validates every returned URL and label before exposing it to the local shell. Choosing a channel opens it in the active pane without using tokens, Discord stores or private APIs.

Version 0.5.1 completes that directory by scanning the full channel sidebar, including virtualized rows and collapsed categories. Discovery temporarily exposes navigation inside a hidden native view, expands and scrolls the list, then restores its category and scroll state before showing the pane again.

Version 0.5.2 adds channels omitted from a member's opted-in sidebar. When Discord exposes its official channel-browser route, OmaDisc loads that route in a temporary off-screen sandboxed view, merges its directory with the sidebar and closes the view. Linkless rows carrying channel IDs cover voice and stage channels without touching Discord's stores or authentication token.

Version 0.5.3 keeps Discord's QR sign-in visible alongside password sign-in. The dedicated account window now has a desktop-layout minimum width and an isolated 90% scale, preventing workspace zoom or a compact tiled window from hiding Discord's QR panel. Settings describes both choices, and the live smoke check confirms the real Discord page exposes both without capturing the QR code or entering credentials.

Version 0.5.4 makes server-channel discovery independent of Discord rendering a Browse Channels link. OmaDisc derives the official channel-browser route from the validated active server ID, scans every substantial virtualized scroll container, and merges several delayed directory passes instead of accepting the initially rendered sidebar rows as complete. Discovery cancels during sign-in and closes immediately if Discord redirects away from the server directory.
