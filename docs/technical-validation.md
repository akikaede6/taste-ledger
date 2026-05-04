# Cross-Platform Technical Validation

## Context

The local machine has Node.js and npm available, but does not have Flutter, Dart,
Java, Gradle, Rust, or Cargo installed. The implementation will therefore use a
TypeScript core and web UI, packaged as:

- Electron for Windows, macOS, and Linux desktop clients.
- Capacitor for the Android client.
- Vite for local development and browser fallback.

This keeps the domain model, JSON storage rules, scoring, ranking, and share
payload generation in one shared codebase while still producing Android and
desktop clients.

## Primary References Checked

- Capacitor states that it creates native mobile apps from modern web tooling:
  <https://capacitorjs.com/docs>
- Capacitor Filesystem supports scoped reads/writes, directory creation, and
  Android permission checks for `Directory.Documents`:
  <https://capacitorjs.jp/docs/v7/apis/filesystem>
- Electron `app.getPath()` exposes platform-specific `documents` and `userData`
  paths:
  <https://www.electronjs.org/docs/latest/api/app#appgetpathname>
- Electron `dialog.showSaveDialog()` supports user-selected export paths:
  <https://www.electronjs.org/docs/latest/api/dialog#dialogshowsavedialogwindow-options>

## Desktop Data Directory

Desktop builds should default to a user-visible data directory:

```text
<Documents>/Ranking/ranking-data/
  library.json
  images/
  exports/
```

Rationale:

- `app.getPath("documents")` provides a known user document location on the
  three desktop targets.
- The folder is easier for a user to copy than an opaque app-private directory.
- Electron can still use `app.getPath("userData")` for non-portable app
  settings, but the ranking library itself should live in the visible data
  folder.

The desktop shell should expose IPC methods for:

- Resolving and showing the current data directory.
- Reading/writing `library.json`.
- Copying imported images into `images/`.
- Saving exported PNG files through a native save dialog.

## Android Data Directory

Android builds should use Capacitor Filesystem under `Directory.Documents` with
the app-owned path `ranking-data/`.

Rationale:

- The Filesystem plugin documents `Directory.Documents` as the place for
  user-generated content.
- Permission checks are required on Android when using `Directory.Documents`.
- The app-created `ranking-data/` folder remains aligned with the requirement
  that the user can copy one folder to migrate data.

The Android shell should support:

- Creating `ranking-data/`, `images/`, and `exports/` with recursive directory
  creation.
- Reading/writing UTF-8 JSON.
- Writing imported cover images and exported PNG files as base64 content.
- Reporting permission denial as a recoverable UI error.

## Image Persistence

Imported cover images must be copied into the data directory instead of storing
external picker paths. Works should store only relative paths such as:

```text
images/<image-id>.<ext>
```

This satisfies cross-device migration because `library.json` and `images/` move
together.

## Share Export Strategy

Share exports should use shared payload builders and platform-specific saving:

- Work cover image: compact share card without long review.
- Work long image: all work information including long review.
- Ranking image: current ranking order, ranking criterion, rank number, title,
  and score.

The browser layer can render a share component to SVG/canvas and produce PNG
bytes. Platform adapters then save those bytes:

- Electron: use `dialog.showSaveDialog()` and Node file writing.
- Android: write PNG bytes through Capacitor Filesystem and optionally invoke
  Capacitor Share.

## Risks and Decisions

- CI must install Java and Android tooling because the local machine does not
  have them.
- Electron binary download was intentionally skipped locally after a stalled
  postinstall; CI artifact builds should allow Electron to download platform
  binaries.
- The web fallback may use browser storage for development, but the production
  desktop and Android adapters must persist the library in the JSON data
  directory.
- iOS remains out of first-version scope.
