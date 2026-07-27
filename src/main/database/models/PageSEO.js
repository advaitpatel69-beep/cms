/**
 * models/PageSEO.js — Per-Page SEO Model
 * M.R. Textile CMS
 */

'use strict';

class PageSEOModel {
  constructor(db) { this.db = db; }

  list() {
    return this.db.prepare('SELECT * FROM page_seo ORDER BY page_key').all();
  }

  getByKey(pageKey) {
    return this.db.prepare('SELECT * FROM page_seo WHERE page_key = ?').get(pageKey) || {};
  }

  upsert(pageKey, data) {
    const ts = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO page_seo (page_key, title, description, canonical, og_image, schema_json, updated_at)
      VALUES (@page_key, @title, @description, @canonical, @og_image, @schema_json, @updated_at)
      ON CONFLICT(page_key) DO UPDATE SET
        title       = excluded.title,
        description = excluded.description,
        canonical   = excluded.canonical,
        og_image    = excluded.og_image,
        schema_json = excluded.schema_json,
        updated_at  = excluded.updated_at
    `).run({
      page_key:    pageKey,
      title:       data.title       || '',
      description: data.description || '',
      canonical:   data.canonical   || '',
      og_image:    data.ogImage     || data.og_image || '',
      schema_json: data.schemaJson  || data.schema_json || null,
      updated_at:  ts,
    });
  }
}

module.exports = PageSEOModel;
