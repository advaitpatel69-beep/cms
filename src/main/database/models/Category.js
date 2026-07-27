/**
 * models/Category.js — Category Data Model
 * M.R. Textile CMS
 */

'use strict';

const now = () => new Date().toISOString();

class CategoryModel {
  constructor(db) { this.db = db; }

  list() {
    return this.db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active') AS active_products,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'out_of_stock') AS oos_products,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS total_products
      FROM categories c
      ORDER BY c.display_order ASC, c.name ASC
    `).all();
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  }

  getBySlug(slug) {
    return this.db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
  }

  count() {
    return this.db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  }

  create(data) {
    const ts = now();
    const info = this.db.prepare(`
      INSERT INTO categories (
        slug, name, html_file, b2b_html_file, image_dir, hero_image,
        description, intro_headline, intro_text,
        seo_title, seo_description, display_order, homepage_visible,
        created_at, updated_at
      ) VALUES (
        @slug, @name, @html_file, @b2b_html_file, @image_dir, @hero_image,
        @description, @intro_headline, @intro_text,
        @seo_title, @seo_description, @display_order, @homepage_visible,
        @created_at, @updated_at
      )
    `).run({
      slug:             data.slug,
      name:             data.name,
      html_file:        data.htmlFile        || data.html_file || `${data.slug}.html`,
      b2b_html_file:    data.b2bHtmlFile     || data.b2b_html_file || `b2b/${data.slug}.html`,
      image_dir:        data.imageDir        || data.image_dir || `images/sarees/${data.slug}`,
      hero_image:       data.heroImage       || data.hero_image || '',
      description:      data.description     || '',
      intro_headline:   data.introHeadline   || data.intro_headline || '',
      intro_text:       data.introText       || data.intro_text || '',
      seo_title:        data.seoTitle        || data.seo_title || '',
      seo_description:  data.seoDescription  || data.seo_description || '',
      display_order:    data.displayOrder    || data.display_order || 99,
      homepage_visible: data.homepageVisible !== false ? 1 : 0,
      created_at:       ts,
      updated_at:       ts,
    });
    return this.getById(info.lastInsertRowid);
  }

  update(id, data) {
    const ts = now();
    const fields = [];
    const values = { id, updated_at: ts };

    const cols = [
      ['name','name'], ['slug','slug'], ['html_file','htmlFile'],
      ['b2b_html_file','b2bHtmlFile'], ['image_dir','imageDir'],
      ['hero_image','heroImage'], ['description','description'],
      ['intro_headline','introHeadline'], ['intro_text','introText'],
      ['seo_title','seoTitle'], ['seo_description','seoDescription'],
      ['display_order','displayOrder'], ['homepage_visible','homepageVisible'],
    ];

    for (const [col, alias] of cols) {
      const val = data[alias] !== undefined ? data[alias] : data[col];
      if (val !== undefined) {
        fields.push(`${col} = @${col}`);
        values[col] = col === 'homepage_visible' ? (val ? 1 : 0) : val;
      }
    }

    if (!fields.length) return this.getById(id);
    fields.push('updated_at = @updated_at');

    this.db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = @id`).run(values);
    return this.getById(id);
  }

  delete(id) {
    // Products will remain — they'll be orphaned but not deleted
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  }
}

module.exports = CategoryModel;
