/**
 * models/BusinessInfo.js — Business Information Model (singleton row)
 * M.R. Textile CMS
 */

'use strict';

class BusinessInfoModel {
  constructor(db) { this.db = db; }

  get() {
    return this.db.prepare('SELECT * FROM business_info WHERE id = 1').get() || {};
  }

  update(data) {
    const ts = new Date().toISOString();
    const cols = [
      'business_name','address_street','address_city','address_state',
      'address_postal','address_country','phone_primary','phone_secondary',
      'whatsapp','email','gst','maps_link',
      'hours_weekday_open','hours_weekday_close',
      'hours_weekend_open','hours_weekend_close','hours_closed_days',
      'instagram','facebook','youtube',
    ];

    // Build SET clause
    const sets  = cols.map(c => `${c} = @${c}`).join(', ');
    const vals  = { id: 1, updated_at: ts };
    for (const c of cols) {
      const alias = c.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
      vals[c] = data[alias] !== undefined ? data[alias] : (data[c] !== undefined ? data[c] : null);
    }

    this.db.prepare(`
      INSERT OR REPLACE INTO business_info (id, ${cols.join(', ')}, updated_at)
      VALUES (@id, ${cols.map(c => `@${c}`).join(', ')}, @updated_at)
    `).run(vals);
  }
}

module.exports = BusinessInfoModel;
