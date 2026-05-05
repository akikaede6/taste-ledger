# Migration and Build Smoke Validation

## Scope

This note validates the repository after the work and ranking share export
features were added. It focuses on the data-directory copy model, Android build
path, and desktop build path.

## Data Directory Migration

The repository layer is compatible with folder-copy migration:

- `LibraryRepository` treats one backend root as the full user data directory.
- `library.json` stores schema-versioned structured data.
- Imported cover bytes are stored below `images/`.
- Work share exports are stored below `exports/works/`.
- Ranking share exports are stored below `exports/rankings/`.
- Works keep relative asset paths, so copying the whole root preserves image and
  export references.
- `createNodeFileBackend` rejects paths that escape the configured data root.

The covered tests now verify save/load behavior, image storage, work export
storage, ranking export storage, work share payloads, and ranking share payloads.
That is enough to validate the core migration contract: copy the data root, then
load the same `library.json` and relative byte files from the new location.

## Current Runtime Adapters

The core repository is now wired to visible platform folders:

- Electron exposes a `window.rankingNative.storage` bridge in preload.
- Electron main process files live below `<Documents>/Ranking/ranking-data/`.
- Android uses a Capacitor Filesystem backend rooted at `ranking-data/` inside
  `Directory.Documents`.
- The shared browser fallback still exists for non-native development and test
  environments.

The remaining build-time dependency is the local Java/Android SDK toolchain
needed to compile the Android artifact.

## Smoke Commands

| Command                          | Result | Notes                                                                                                  |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `npm run build`                  | Pass   | TypeScript and Vite production build complete.                                                         |
| `npm exec cap -- ls`             | Pass   | Capacitor sees `@capacitor/filesystem` and `@capacitor/share` for Android.                             |
| `npm run android:sync`           | Pass   | Builds web assets and syncs them into the Android project.                                             |
| `npm run android:build`          | Fail   | Sync succeeds, then `./gradlew assembleDebug` stops because this local shell has no Java installation. |
| `npm exec electron -- --version` | Fail   | The local `electron` package still reports that its binary was not installed correctly.                |
| `npm run electron:build`         | Pass   | electron-builder downloads Electron and produces `dist-electron/Ranking-0.1.0.AppImage`.               |

## Build Conclusions

Android artifact generation is ready in principle. Task 14 should keep the
native project checked in, set up CI with Java and Android tooling, and publish
`assembleDebug` only when the build job succeeds.

Desktop artifact generation is structurally configured through
`electron-builder`. The CI artifact job should not set
`ELECTRON_SKIP_BINARY_DOWNLOAD`, and it should upload the AppImage only after
the build step succeeds.

The current green local checks are still useful release gates:

- `npm run format`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm audit --audit-level=high`

They verify the shared codebase, but they do not replace native artifact smoke
tests.
