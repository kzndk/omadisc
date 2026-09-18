# OmaDisc 0.5.4 — Complete server discovery

The toolbar dropdown now actively discovers the current server's accessible channels rather than treating the first rendered sidebar rows as the complete result. OmaDisc derives Discord's channel-browser route from the validated server ID, scans all substantial virtualized scroll containers, expands and restores collapsed categories, and merges multiple delayed passes before publishing the directory.

The temporary sandboxed discovery view remains off-screen, uses the existing Discord session, and closes after the scan. It cancels while account sign-in is required and rejects redirects away from the expected server directory. No tokens, Discord stores or private APIs are accessed.

Regression coverage removes the visible Browse Channels link from the fixture, initially exposes only four channels, and adds a fifth after the first partial render. The dropdown still resolves all five. The syntax check, 32 unit tests, and six source Electron integration tests passed through the repository's resource-limited wrappers.

The side-by-side 0.5.4 release becomes active after OmaDisc is closed and reopened.
