# OmaDisc 0.5.3 — Password or QR sign-in

Settings now labels the account action **Sign in with password or QR** and explains that Discord's QR code can be scanned and approved with the Discord mobile app. The dedicated sandboxed Discord account window keeps a 900×620 minimum content area at an isolated 90% scale, preserving Discord's desktop login layout without changing the workspace panes' selected scale.

The source syntax check, unit suite and full Electron integration suite passed through the repository's resource-limited wrappers. Integration coverage verifies the account window's minimum width, isolated scale, shared persistent session and existing sandbox protections.

The live Wayland smoke check loaded the real `https://discord.com/login` page, detected both its password field and QR sign-in choice without capturing the QR image, entered no credentials, and remained stable for 60 seconds. The single account window continued coordinating six waiting panes. Peak cgroup memory was 590 MiB.

The side-by-side 0.5.3 release becomes active after OmaDisc is closed and reopened.
