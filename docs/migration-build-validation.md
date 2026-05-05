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

## Current Runtime Gap

The core repository is portable, but production runtime adapters still need to
bind it to visible platform folders:

- Electron currently exposes `window.rankingDesktop`, not a
  `window.rankingNative.storage` backend, so the renderer falls back to browser
  storage instead of `<Documents>/Ranking/ranking-data/`.
- Android has Capacitor dependencies and can sync web assets, but there is not
  yet a complete native project with a Gradle wrapper.
- A Capacitor filesystem backend should use `Directory.Documents` and the
  `ranking-data/` app folder so copied data remains user-visible.

These gaps should be closed before release artifacts are considered complete.

## Smoke Commands

| Command                          | Result | Notes                                                                                                    |
| -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `npm run build`                  | Pass   | TypeScript and Vite production build complete.                                                           |
| `npm exec cap -- ls`             | Pass   | Capacitor sees `@capacitor/filesystem` and `@capacitor/share` for Android.                               |
| `npm run android:sync`           | Pass   | Builds web assets and syncs them into `android/app/src/main/assets/public`.                              |
| `npm run android:build`          | Fail   | Sync succeeds, then `./gradlew assembleDebug` fails because `android/gradlew` does not exist.            |
| `npm exec electron -- --version` | Fail   | Local Electron package reports that the Electron binary did not install correctly.                       |
| `npm run electron:build`         | Fail   | Web build and electron-builder startup succeed, then Electron zip download from GitHub fails with `EOF`. |

## Build Conclusions

Android artifact generation is not yet ready. Task 14 should add a complete
Capacitor Android project, commit the required native project files, and set up
CI with Java and Gradle so `assembleDebug` can run on a Linux runner.

Desktop artifact generation is structurally configured through `electron-builder`
but depends on a successful Electron binary download. CI should not set
`ELECTRON_SKIP_BINARY_DOWNLOAD` for artifact jobs, and it should cache Electron
downloads when possible.

The current green local checks are still useful release gates:

- `npm run format`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm audit --audit-level=high`

They verify the shared codebase, but they do not replace native artifact smoke
tests.
