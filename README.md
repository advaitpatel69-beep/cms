# M.R. Textile CMS

**Private desktop Content Management System for the M.R. Textile / M.R. Sarees website.**

> This application is NOT part of the public website. It runs locally on the administrator's computer.

---

## Quick Start

```bash
# Install dependencies (first time only)
npm install

# Launch the CMS
npm start
```

**Default Password:** `12345678` *(Change in Settings after first login)*

---

## Architecture

```
cms/                          ← This application
├── main.js                   ← Electron main process + IPC handlers
├── preload.js                ← Secure IPC bridge
├── src/
│   ├── main/
│   │   ├── database/         ← SQLite models (Product, Category, etc.)
│   │   ├── generator/        ← Static site generator
│   │   ├── git/              ← Git automation
│   │   ├── image/            ← Sharp image processing
│   │   └── services/         ← Business logic (Publish, Backup, Import)
│   └── renderer/
│       ├── index.html        ← CMS shell
│       ├── css/cms.css       ← Dark theme design system
│       └── js/
│           ├── app.js        ← Entry point + auth + routing
│           ├── router.js     ← Client-side view router
│           ├── components/   ← Toast, Modal
│           └── views/        ← One file per CMS section
└── data/
    ├── cms.db                ← SQLite database (auto-created)
    └── backups/              ← ZIP backups
```

---

## CMS Workflow

1. **Login** with administrator password
2. **Import Existing Products** (first run — Dashboard → "Import Existing Products")
3. **Manage Products** — Add/edit/delete, upload images
4. **Manage Stock** — Bulk mark In Stock / Out of Stock / Archive
5. **Publish Website** — Click the big "Publish Website" button
6. Website is live on GitHub Pages within ~60 seconds

---

## What Publish Does

1. Validates all content
2. Regenerates all category HTML pages from SQLite
3. Regenerates B2B pages
4. Writes `data/products.json`, `data/categories.json`, `data/gallery.json`
5. Regenerates `sitemap.xml`
6. Runs `git add . && git commit && git push`

---

## Requirements

- Node.js 18+
- Git installed and configured with GitHub credentials
- Windows 10/11

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 29 |
| Database | SQLite (better-sqlite3) |
| Image Processing | Sharp |
| Git | Local Git CLI |
| UI | Vanilla HTML/CSS/JS (ES Modules) |
