/**
 * services/BackupService.js — Backup & Restore
 * M.R. Textile CMS
 */

'use strict';

const fs       = require('fs');
const path     = require('path');
const archiver = require('archiver');

class BackupService {
  constructor(db, dataDir, websiteRoot) {
    this.db          = db;
    this.dataDir     = dataDir;
    this.websiteRoot = websiteRoot;
    this.backupsDir  = path.join(dataDir, 'backups');
    fs.mkdirSync(this.backupsDir, { recursive: true });
  }

  async create() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename  = `mr-textile-backup-${timestamp}.zip`;
    const outPath   = path.join(this.backupsDir, filename);

    return new Promise((resolve, reject) => {
      const output  = fs.createWriteStream(outPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        resolve({
          filename,
          path:     outPath,
          size:     archive.pointer(),
          created:  new Date().toISOString(),
        });
      });

      archive.on('error', reject);
      archive.pipe(output);

      // 1. SQLite database
      const dbPath = path.join(this.dataDir, 'cms.db');
      if (fs.existsSync(dbPath)) {
        archive.file(dbPath, { name: 'cms.db' });
      }

      // 2. JSON data files
      const dataWebDir = path.join(this.websiteRoot, 'data');
      if (fs.existsSync(dataWebDir)) {
        archive.directory(dataWebDir, 'data');
      }

      // 3. Images
      const imagesDir = path.join(this.websiteRoot, 'images');
      if (fs.existsSync(imagesDir)) {
        archive.directory(imagesDir, 'images');
      }

      archive.finalize();
    });
  }

  list() {
    if (!fs.existsSync(this.backupsDir)) return [];
    return fs.readdirSync(this.backupsDir)
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const full = path.join(this.backupsDir, f);
        const stat = fs.statSync(full);
        return { filename: f, path: full, size: stat.size, created: stat.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
  }

  async restore(filename) {
    const zipPath = path.join(this.backupsDir, filename);
    if (!fs.existsSync(zipPath)) throw new Error(`Backup not found: ${filename}`);

    const unzipper = require('unzipper');

    return new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Parse())
        .on('entry', (entry) => {
          const entryPath = entry.path;

          if (entryPath === 'cms.db') {
            const outPath = path.join(this.dataDir, 'cms.db');
            entry.pipe(fs.createWriteStream(outPath));
          } else if (entryPath.startsWith('data/')) {
            const outPath = path.join(this.websiteRoot, entryPath);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            entry.pipe(fs.createWriteStream(outPath));
          } else if (entryPath.startsWith('images/')) {
            const outPath = path.join(this.websiteRoot, entryPath);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            entry.pipe(fs.createWriteStream(outPath));
          } else {
            entry.autodrain();
          }
        })
        .on('close', () => resolve({ success: true }))
        .on('error', reject);
    });
  }
}

module.exports = BackupService;
