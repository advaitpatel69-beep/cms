# Prompt: Package M.R. Textile CMS as a Windows Desktop App

Copy everything below into your AI coding assistant (Claude Code, or paste into chat with the project open/uploaded).

---

## Task

I have an existing Electron desktop application called **M.R. Textile CMS**. Right now I have to open a terminal, `cd` into the project folder, and run `npm start` to launch it. I want to package it into a proper Windows installer so I can just double-click a desktop icon to open it — no terminal involved.

## Project context

- **Stack:** Electron 29 (main process: `main.js`, preload: `preload.js`), vanilla HTML/CSS/JS renderer in `src/renderer/`, business logic in `src/main/` (database via `better-sqlite3`, image processing via `sharp`, git automation, static site generator).
- **Data:** Uses a local SQLite database at `data/cms.db`, plus `data/backups/`. This is real, ongoing business data — **it must NOT be bundled inside the installed app** and must NOT be wiped or overwritten on install/reinstall. It needs to keep living in a stable location the app reads from every launch, surviving future rebuilds/reinstalls.
- **Native module:** `better-sqlite3` is a native Node module and must be correctly rebuilt for the packaged Electron app (not just the Node.js version), or the app will fail to start.
- **Current `package.json`** already has a `"build"` key with `appId: "com.mrtextile.cms"` and `productName: "M.R. Textile CMS"` — extend this, don't replace it wholesale.
- **This is for personal/single-user use only** — no auto-update, no code signing, no publishing to any store, no telemetry needed.

## What I need you to do

1. Add `electron-builder` as a dev dependency and configure it correctly for a **Windows target** (NSIS installer producing a `Setup.exe`), building on the existing `build` config in `package.json`.
2. Make sure the `files` array in the build config includes everything the app needs to run (`main.js`, `preload.js`, `src/**/*`, `node_modules/**/*`, `package.json`) and correctly **excludes** the `data/` directory from being bundled — the packaged app should read/write `data/cms.db` from a persistent location outside the installed app directory (e.g., `app.getPath('userData')`), not from inside the install folder. If the code currently hardcodes a path to `data/cms.db` relative to the project root, update it to use the correct persistent path in both development and packaged (production) modes, without breaking the current dev workflow (`npm start` should still work exactly as before).
3. Confirm `better-sqlite3` will be rebuilt correctly for the target Electron version as part of the packaging process (via `electron-builder`'s native rebuild step) — flag it clearly if any extra config is needed for this.
4. Add an `npm run dist` script that runs the Windows build.
5. Walk me through exactly which files you changed and why, and give me the exact commands to run, in order, to produce and install the app.
6. After packaging, tell me how to verify: the app launches from a desktop/Start Menu shortcut with no visible terminal, existing product/category data is still accessible, and a fresh product/image save still works correctly.

## Constraints

- Do not change any existing business logic (product management, stock workflow, SEO fields, image processing, git publish flow) — this task is packaging/build config only.
- Do not remove or weaken the current authentication check.
- Keep changes minimal and clearly explained — I want to understand what changed, not just receive a diff.
- If something about my current project structure blocks a clean implementation of any step above, tell me clearly instead of working around it silently.
