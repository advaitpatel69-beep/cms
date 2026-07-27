/**
 * models/Activity.js — Activity Log Model
 * M.R. Textile CMS
 */

'use strict';

class ActivityModel {
  constructor(db) { this.db = db; }

  log(action, entityType, entityId, details) {
    this.db.prepare(`
      INSERT INTO activity_log (action, entity_type, entity_id, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(action, entityType || null, entityId || null, details || '', new Date().toISOString());
  }

  recent(limit = 20) {
    return this.db.prepare(`
      SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?
    `).all(limit);
  }

  clear() {
    this.db.prepare('DELETE FROM activity_log WHERE created_at < ?').run(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    );
  }
}

module.exports = ActivityModel;
