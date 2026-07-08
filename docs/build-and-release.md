# Build and Release Notes

## Environments

The app supports three backend environments:

- `development`
- `testing`
- `production`

Do not edit `src/constants.js` before each build. The app reads the active environment from Expo config:

```js
Constants.expoConfig.extra.appEnvironment
```

`app.config.js` sets this value from `APP_ENV`. If `APP_ENV` is not provided, the app defaults to `testing`.

## Local Expo

Expo Go defaults to `testing`.

To run against development in PowerShell:

```powershell
$env:APP_ENV="development"
npx expo start -c
```

To run against production locally:

```powershell
$env:APP_ENV="production"
npx expo start -c
```

## EAS Build Profiles

Build profiles are configured in `eas.json`.

```bash
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile testing-store --platform android
eas build --profile production --platform android
```

Profile mapping:

- `development` uses `APP_ENV=development`
- `preview` uses `APP_ENV=testing` and is intended for internal APK testing
- `testing-store` uses `APP_ENV=testing` and creates an Android App Bundle for Play Console testing
- `production` uses `APP_ENV=production`

Use `--platform ios` for iOS builds.

If Git is not available in the terminal PATH, EAS can be run without VCS metadata:

```powershell
$env:EAS_NO_VCS="1"; eas build --profile preview --platform android
```

This should be treated as a local workaround. The preferred long-term setup is to have Git installed and available in PATH.

## Testing Distribution

### Android

Create a testing build:

```bash
eas build --profile testing-store --platform android
```

Upload the generated `.aab` to Google Play Console:

1. Open the app in Google Play Console.
2. Go to Testing.
3. Choose Internal testing or Closed testing.
4. Create a new release.
5. Upload the `.aab`.
6. Add release notes.
7. Review and roll out to testers.

### iOS

Create a testing build:

```bash
eas build --profile preview --platform ios
```

Submit to App Store Connect:

```bash
eas submit --platform ios
```

Then in App Store Connect:

1. Open the app.
2. Go to TestFlight.
3. Wait for Apple processing.
4. Add the build to the tester group.
5. Add test notes if required.
6. Start testing.

## Versioning

There are two version concepts:

- `expo.version`: user-facing app version, for example `1.1.0`
- Android `versionCode` and iOS `buildNumber`: store build numbers

`expo.version` should be updated manually only when the release version changes.

Examples:

- bug fix: `1.1.1`
- minor feature: `1.2.0`
- major release: `2.0.0`

Android `versionCode` and iOS `buildNumber` must increase for every store upload. EAS handles this automatically because all build profiles have:

```json
"autoIncrement": true
```

So normally you should not manually edit `android.versionCode` or `ios.buildNumber` for every build.

The project uses remote EAS app version source:

```json
"appVersionSource": "remote"
```

With remote version source, EAS stores and increments the native build numbers on EAS servers. It does not edit local `app.json` for every build.
