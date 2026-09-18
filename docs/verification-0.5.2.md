# OmaDisc 0.5.2 — Full accessible server directory

The toolbar menu now merges two official Discord surfaces for the active server: its normal channel sidebar and its channel-browser page. This includes channels omitted by Discord's channel opt-in feature as well as collapsed, virtualized and linkless voice/stage rows. Strict validation still accepts only channel identifiers belonging to the current server.

The channel browser runs in a temporary off-screen sandboxed `WebContentsView` using the existing Discord session. It has no preload or Node access, never reads Discord stores or tokens, and is closed after discovery. The active chat does not navigate or reload, preserving its draft.

Integration coverage serves an additional channel only from the channel-browser fixture and a voice channel as a linkless row. The menu merges both with the sidebar, deduplicates URLs and navigates the active pane. The unit suite, source and packaged Electron integration suites, syntax check and local installation check passed under the repository's resource-limited wrappers.

The side-by-side 0.5.2 release becomes active after OmaDisc is closed and reopened.
