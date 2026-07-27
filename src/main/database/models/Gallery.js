/**
 * models/Gallery.js — Gallery Model
 * M.R. Textile CMS
 */

'use strict';

class GalleryModel {
  constructor(db) { this.db = db; }

  list() {
    return this.db.prepare('SELECT * FROM gallery ORDER BY display_order ASC, id ASC').all();
  }

  add(imagePath, caption, category, altText) {
    const maxOrder = this.db.prepare('SELECT MAX(display_order) AS m FROM gallery').get();
    const order = (maxOrder?.m ?? -1) + 1;
    const info = this.db.prepare(`
      INSERT INTO gallery (image_path, caption, category, alt_text, display_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(imagePath, caption || '', category || '', altText || '', order, new Date().toISOString());
    return this.db.prepare('SELECT * FROM gallery WHERE id = ?').get(info.lastInsertRowid);
  }

  delete(id) {
    this.db.prepare('DELETE FROM gallery WHERE id = ?').run(id);
  }

  reorder(orderedIds) {
    const stmt = this.db.prepare('UPDATE gallery SET display_order = ? WHERE id = ?');
    const update = this.db.transaction((ids) => {
      ids.forEach((id, i) => stmt.run(i, id));
    });
    update(orderedIds);
  }
}

module.exports = GalleryModel;
