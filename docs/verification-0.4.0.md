# OmaDisc 0.4.0 — Discord account in Settings

Built and installed on 2026-09-13 for Linux ARM64. Reopen OmaDisc to load the update. The current user window was not restarted, so its in-memory drafts remain available.

Open **Settings (⚙) → Discord account → Sign in to Discord**. A single sandboxed Discord window handles sign-in and reuses OmaDisc's existing `persist:discord` partition. Every channel uses that same persistent browser session. Repeated clicks focus the open account window. Successful sign-in closes it and reloads only waiting/signed-out panes at their saved channels. Active peers retain their drafts; the selected layout stays intact. Cancellation leaves channels ready for retry. Load failures produce a Settings error with a retry button. Closing the main workspace also closes the account window.

The settings UI does not receive credentials or tokens. The remote account window has no Node access or preload bridge and uses the same navigation and permission restrictions as channel views. Account status is observed during this run; an existing browser session is reused on startup without requiring another settings action. Discord can still expire or revoke a session. The chat-design switch now lives in Settings.

Validation:

- 30 unit tests passed; build syntax checks passed.
- Six Electron integration tests passed on source and the packaged runtime. Central sign-in tests use clearly labelled temporary fixtures to verify shared Session identity, persistent cookies and local storage across waiting/new channels and a full app restart, one account window, cancellation, expiry, retry, saved channel assignments, retained active drafts, sandbox isolation and shutdown cleanup.
- The packaged runtime loaded the actual Discord sign-in form on Wayland and remained healthy for 60 seconds. One account window served six waiting assignments, with no separate channel login renderers. All 1/2/4/6 layouts stayed available. The contained service peaked at 575.2 MiB, below the unchanged 1536 MiB cap.
- The local install retains the existing browser profile and workspace. Installed source hashes and desktop entry validation are recorded in `test-results/installed-manifest-0.4.0.json`.

The [Settings preview](images/settings-preview.png) contains only local test fixtures. No user messages, account details or QR codes were captured. Real Discord authentication and sending were not performed; cross-pane persistence was verified using fixture browser storage.

Artifacts: `test-results/live-discord.json`, `test-results/live-memory.json`, `test-results/installed-manifest-0.4.0.json`, and `dist/omadisc-0.4.0-linux-arm64/`. Backup: `../omadisc-backups/before-settings-sign-in-0.4.0-20260913.tar.gz`.
