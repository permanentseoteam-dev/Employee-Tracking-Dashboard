# Desktop auto-update

Channel: `https://github.com/permanentseoteam-dev/Employee-Tracking-Dashboard/releases/latest/download/latest.json`

## In-app popup

Installed desktop builds check GitHub Releases shortly after launch, then about every 15 minutes (and on window focus). When `latest.json` is newer than the running version, users see an **Update available** dialog with **Update & restart** / **Later**. Choosing update downloads the signed installer and relaunches.

## Ship a release

1. Bump `version` in `package.json` + `src-tauri/tauri.conf.json` + `src-tauri/Cargo.toml`
2. Tag and push: `git tag v0.1.1 && git push origin v0.1.1`
3. Or run Actions → **Release Desktop** / `npm run release:desktop`

GitHub Actions builds the NSIS installer, signs updater artifacts, and uploads `latest.json`. After that file is live, open apps will prompt to update.

## Secrets (one-time)

Repo secrets:

- `TAURI_SIGNING_PRIVATE_KEY` — full contents of `%USERPROFILE%\.tauri\employee-tracking.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — `tracking-updater`

## Local signed build

```bash
npm run build:desktop
```

Uses the same key from `~/.tauri/employee-tracking.key`. Never commit the private key.
