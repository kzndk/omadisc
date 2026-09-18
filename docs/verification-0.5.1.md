# OmaDisc 0.5.1 — Complete current-server channel directory

The toolbar menu still follows the active pane's current server, but now discovers every accessible channel rather than only the links mounted in Discord's initial sidebar viewport. The scanner temporarily expands collapsed categories and walks a virtualized channel scroller before restoring the original collapsed categories and scroll position. The native Discord view stays hidden during that scan.

The **Morpheus & Team** integration fixture keeps `#archive` absent from the DOM until its category is expanded. Verification confirms that the menu includes `#kzn`, `#team-lounge`, `#planning` and `#archive`, that the category returns to its collapsed state, and that selecting a channel still navigates the active pane. Strict current-server URL validation remains in place.

The unit suite, source and packaged Electron integration suites, syntax check and local installation check passed under the repository's resource-limited wrappers. The side-by-side 0.5.1 release becomes active after OmaDisc is closed and reopened.
