# Release Guide

## Local Data Directory

The app keeps all user data in one folder so it can be copied to a new device
without a migration tool.

### Desktop

- Default location: `<Documents>/Ranking/ranking-data/`
- Stored files:
  - `library.json`
  - `images/`
  - `exports/works/`
  - `exports/rankings/`

### Android

- Default location: `Directory.Documents/ranking-data/`
- The same relative layout applies inside that folder.

### Moving to a New Device

1. Close the app.
2. Copy the entire `ranking-data/` folder to the new device.
3. Open the app on the new device.
4. Confirm the same library, images, and exports are visible.

The integration test in `test/migration.test.ts` covers this copy-and-reload
flow from the repository layer.

## Build Artifacts

CI publishes native artifacts after the verify job passes:

- Android debug APK: `ranking-android-debug-apk`
- Linux desktop AppImage: `ranking-linux-appimage`
- Windows installer: `ranking-windows-installer`
- macOS DMG: `ranking-macos-dmg`

The workflow also creates a GitHub prerelease automatically on successful
pushes to `master` and uploads the current build outputs there.

Local build commands mirror the same outputs where the host platform allows it:

- `npm run android:build`
- `npm run electron:build`

The Android path requires a Java/Android SDK setup. Desktop builds require the
Electron binary download step to succeed, and the native target must match the
host runner or local OS.

## First-Release Boundary

Included in the first release:

- Local-first JSON storage
- Category, work, review, score, and ranking management
- Work cover and long-form share exports
- Ranking share exports
- Android and desktop builds

Explicitly out of scope for the first release:

- Cloud sync
- Account login
- Multi-user collaboration
- Social auto-posting
- iOS App Store delivery as a required path

The product stays device-copied rather than server-synced, so the same data
folder remains the migration contract.
