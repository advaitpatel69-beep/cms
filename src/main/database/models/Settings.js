/**
 * models/Settings.js — Key-Value Settings Store
 * M.R. Textile CMS
 */

'use strict';

class SettingsModel {
  constructor(db) { this.db = db; }

  get(key) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  set(key, value) {
    this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
  }

  getAll() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    return rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
  }

  /**
   * Seed defaults only if they don't already exist.
   */
  seedDefaults(defaults = {}) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
    `);
    const seed = this.db.transaction((defs) => {
      for (const [k, v] of Object.entries(defs)) {
        stmt.run(k, String(v));
      }
    });

    seed({
      websiteRoot:     defaults.websiteRoot     || '',
      siteUrl:         defaults.siteUrl         || 'https://mrtextile.online',
      adminPassword:   defaults.defaultPassword || '12345678',
      lastPublished:   '',
      autoArchiveDays: '7',
      gitAutoCommit:   'true',
    });
  }
}

module.exports = SettingsModel;
