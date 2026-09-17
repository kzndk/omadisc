# OmaDisc 0.5.0 — Active server channel menu

The top toolbar now follows the active pane. When that pane is in a server channel, the menu displays the server name and the channel links Discord has rendered for that server. Choosing an entry opens it in the same pane. Home and direct-message views do not expose a server menu.

The remote query is fixed and read-only. It does not modify Discord, inspect tokens or use private APIs. The main process accepts only strict Discord channel URLs belonging to the pane's current server, removes duplicates, bounds the result count and sanitizes labels before sending data to the local UI.

Verification uses the local **Morpheus & Team** fixture with `#kzn`, `#team-lounge` and `#planning`. It checks discovery, active-pane display, menu navigation, refresh after channel changes, server isolation, malformed data, theme behavior and sign-in expiry. The unit suite, source and packaged Electron integration suites, syntax check and local installation check passed under the repository's resource-limited wrappers.

The running 0.4.1 process was left untouched. The side-by-side 0.5.0 release becomes active after OmaDisc is closed and reopened.
