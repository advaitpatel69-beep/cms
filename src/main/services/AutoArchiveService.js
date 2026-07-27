/**
 * services/AutoArchiveService.js
 * M.R. Textile CMS — Auto-archives products after 7 days out-of-stock
 */

'use strict';

class AutoArchiveService {
  constructor(db) { this.db = db; }

  checkAndArchive() {
    const now = new Date().toISOString();

    // Find all scheduled archive actions that are due
    const due = this.db.prepare(`
      SELECT sq.*, p.name AS product_name
      FROM scheduler_queue sq
      JOIN products p ON p.id = sq.entity_id
      WHERE sq.entity_type = 'product'
        AND sq.action = 'archive'
        AND sq.completed = 0
        AND sq.scheduled_for <= ?
    `).all(now);

    if (!due.length) return { archived: 0 };

    const archiveStmt = this.db.prepare(`
      UPDATE products
      SET status = 'archived', archive_date = ?, updated_at = ?
      WHERE id = ? AND status = 'out_of_stock'
    `);

    const markDone = this.db.prepare(`
      UPDATE scheduler_queue SET completed = 1, completed_at = ? WHERE id = ?
    `);

    let archived = 0;
    const tx = this.db.transaction(() => {
      for (const item of due) {
        const result = archiveStmt.run(now, now, item.entity_id);
        if (result.changes > 0) {
          archived++;
          // Log the auto-archive
          this.db.prepare(`
            INSERT INTO activity_log (action, entity_type, entity_id, details, created_at)
            VALUES ('auto_archived', 'product', ?, ?, ?)
          `).run(item.entity_id, `Auto-archived: ${item.product_name}`, now);
        }
        markDone.run(now, item.id);
      }
    });

    tx();

    console.log(`[AutoArchive] Archived ${archived} out-of-stock product(s)`);
    return { archived };
  }
}

module.exports = AutoArchiveService;
