/**
 * models/Product.js — Product Data Model
 * M.R. Textile CMS
 */

'use strict';

const now = () => new Date().toISOString();

class ProductModel {
  constructor(db) {
    this.db = db;
  }

  /** List products with optional filters */
  list(filters = {}) {
    let sql = `
      SELECT p.*, c.name AS category_name, c.slug AS category_slug,
             c.image_dir AS category_image_dir, c.html_file,
             (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS variant_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      sql += ' AND p.status = ?';
      params.push(filters.status);
    }
    if (filters.categoryId) {
      sql += ' AND p.category_id = ?';
      params.push(filters.categoryId);
    }
    if (filters.featured !== undefined) {
      sql += ' AND p.featured = ?';
      params.push(filters.featured ? 1 : 0);
    }
    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.product_code LIKE ? OR p.description LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }
    if (!filters.includeArchived) {
      // By default hide archived
    }

    sql += ' ORDER BY p.display_order ASC, p.created_at DESC';

    return this.db.prepare(sql).all(...params).map(p => this._parseSpecs(p));
  }

  /** List only main products for Stock Manager (no variants) */
  listForStock(categoryId) {
    let sql = `
      SELECT p.id, p.product_code, p.name, p.status, p.main_image,
             p.out_of_stock_date, p.display_order,
             c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status IN ('active','out_of_stock')
    `;
    const params = [];
    if (categoryId) {
      sql += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    sql += ' ORDER BY c.display_order, p.display_order, p.name';
    return this.db.prepare(sql).all(...params);
  }

  /** Get single product by ID */
  getById(id) {
    const row = this.db.prepare(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug,
             c.image_dir AS category_image_dir, c.html_file
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(id);
    return this._parseSpecs(row);
  }

  /** Get single product by product_code */
  getByCode(code) {
    return this.db.prepare('SELECT * FROM products WHERE product_code = ?').get(code);
  }

  /** Count products matching a filter */
  count(filters = {}) {
    let sql = 'SELECT COUNT(*) AS n FROM products WHERE 1=1';
    const params = [];
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.categoryId) {
      sql += ' AND category_id = ?';
      params.push(filters.categoryId);
    }
    const row = this.db.prepare(sql).get(...params);
    return row ? row.n : 0;
  }

  /** Create a new product */
  create(data) {
    const ts    = now();
    const specs = this._serializeSpecs(data.specs);
    const info = this.db.prepare(`
      INSERT INTO products (
        product_code, name, category_id, description,
        status, featured, display_order,
        seo_title, seo_description, main_image, specs,
        created_at, updated_at
      ) VALUES (
        @product_code, @name, @category_id, @description,
        @status, @featured, @display_order,
        @seo_title, @seo_description, @main_image, @specs,
        @created_at, @updated_at
      )
    `).run({
      product_code:    data.productCode || data.product_code,
      name:            data.name,
      category_id:     data.categoryId  || data.category_id,
      description:     data.description || '',
      status:          data.status      || 'active',
      featured:        data.featured    ? 1 : 0,
      display_order:   data.displayOrder || data.display_order || 0,
      seo_title:       data.seoTitle     || data.seo_title      || '',
      seo_description: data.seoDesc      || data.seo_description || '',
      main_image:      data.mainImage    || data.main_image      || '',
      specs,
      created_at:      ts,
      updated_at:      ts,
    });

    return this.getById(info.lastInsertRowid);
  }

  /** Update an existing product */
  update(id, data) {
    const ts = now();

    // Build partial update
    const fields = [];
    const values = {};

    const map = {
      name:            'name',
      description:     'description',
      status:          'status',
      featured:        'featured',
      display_order:   'display_order',
      seo_title:       'seo_title',
      seo_description: 'seo_description',
      main_image:      'main_image',
      out_of_stock_date: 'out_of_stock_date',
      archive_date:    'archive_date',
      category_id:     'category_id',
      specs:           'specs',
    };

    // Accept camelCase or snake_case
    const aliases = {
      categoryId:    'category_id',
      displayOrder:  'display_order',
      seoTitle:      'seo_title',
      seoDesc:       'seo_description',
      mainImage:     'main_image',
      outOfStockDate: 'out_of_stock_date',
      archiveDate:   'archive_date',
    };

    for (const [alias, col] of Object.entries(aliases)) {
      if (data[alias] !== undefined) data[col] = data[alias];
    }

    for (const [col] of Object.entries(map)) {
      if (data[col] !== undefined) {
        fields.push(`${col} = @${col}`);
        if (col === 'featured') {
          values[col] = data[col] ? 1 : 0;
        } else if (col === 'specs') {
          values[col] = this._serializeSpecs(data[col]);
        } else {
          values[col] = data[col];
        }
      }
    }
    // Also handle camelCase specs
    if (data.specs !== undefined && values.specs === undefined) {
      fields.push('specs = @specs');
      values.specs = this._serializeSpecs(data.specs);
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = @updated_at');
    values.updated_at = ts;
    values.id = id;

    this.db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = @id`).run(values);
    return this.getById(id);
  }

  /** Soft-delete (permanently remove from DB) */
  delete(id) {
    this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }

  /** Bulk update status for multiple products */
  bulkUpdateStatus(ids, status) {
    if (!ids || ids.length === 0) return;
    const ts = now();
    const placeholders = ids.map(() => '?').join(',');

    const extraFields = [];
    const extraValues = [status, ts];

    if (status === 'out_of_stock') {
      extraFields.push(', out_of_stock_date = ?');
      extraValues.splice(2, 0, ts);

      // Schedule auto-archive in 7 days
      this._scheduleArchive(ids, ts);
    } else if (status === 'active') {
      extraFields.push(', out_of_stock_date = NULL');
      // Cancel pending archive schedules
      this._cancelSchedule(ids);
    } else if (status === 'archived') {
      extraFields.push(', archive_date = ?');
      extraValues.splice(2, 0, ts);
    }

    this.db.prepare(`
      UPDATE products
      SET status = ?${extraFields.join('')}, updated_at = ?
      WHERE id IN (${placeholders})
    `).run(...extraValues, ...ids);
  }

  _scheduleArchive(productIds, fromDate) {
    const archiveDate = new Date(fromDate);
    archiveDate.setDate(archiveDate.getDate() + 7);
    const scheduledFor = archiveDate.toISOString();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO scheduler_queue
      (entity_type, entity_id, action, scheduled_for, completed)
      VALUES ('product', ?, 'archive', ?, 0)
    `);

    const insertAll = this.db.transaction((ids) => {
      for (const id of ids) stmt.run(id, scheduledFor);
    });
    insertAll(productIds);
  }

  _cancelSchedule(productIds) {
    const placeholders = productIds.map(() => '?').join(',');
    this.db.prepare(`
      DELETE FROM scheduler_queue
      WHERE entity_type = 'product' AND entity_id IN (${placeholders}) AND completed = 0
    `).run(...productIds);
  }

  /** Get all active products for a category (used by generator) */
  listByCategory(categoryId, includeOutOfStock = true) {
    const statuses = includeOutOfStock
      ? ['active', 'out_of_stock']
      : ['active'];
    const placeholders = statuses.map(() => '?').join(',');
    return this.db.prepare(`
      SELECT p.*,
             (SELECT GROUP_CONCAT(image_path ORDER BY sort_order)
              FROM product_images WHERE product_id = p.id) AS variant_images
      FROM products p
      WHERE p.category_id = ?
        AND p.status IN (${placeholders})
      ORDER BY p.display_order ASC, p.created_at ASC
    `).all(categoryId, ...statuses);
  }

  /** Get variant images for a product */
  getImages(productId) {
    return this.db.prepare(`
      SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order
    `).all(productId);
  }

  /** Replace all variant images for a product */
  setImages(productId, imagePaths) {
    const del    = this.db.prepare('DELETE FROM product_images WHERE product_id = ?');
    const insert = this.db.prepare(`
      INSERT INTO product_images (product_id, image_path, sort_order)
      VALUES (?, ?, ?)
    `);

    const replace = this.db.transaction((pid, paths) => {
      del.run(pid);
      paths.forEach((p, i) => insert.run(pid, p, i));
    });

    replace(productId, imagePaths);
  }

  /** Get all featured products */
  listFeatured() {
    return this.db.prepare(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.featured = 1 AND p.status = 'active'
      ORDER BY p.display_order
    `).all().map(p => this._parseSpecs(p));
  }

  // ── Specs helpers ──────────────────────────────────────────────────────────

  /** Parse specs JSON string from DB into an array */
  _parseSpecs(row) {
    if (!row) return row;
    try {
      row.specs = row.specs ? JSON.parse(row.specs) : [];
    } catch {
      row.specs = [];
    }
    return row;
  }

  /** Serialize specs array to JSON string for DB storage */
  _serializeSpecs(specs) {
    if (!specs) return '[]';
    // Filter: only keep rows where BOTH key and value are non-empty strings
    const clean = (Array.isArray(specs) ? specs : [])
      .filter(s => s && String(s.key || '').trim() && String(s.value || '').trim())
      .map(s => ({ key: String(s.key).trim(), value: String(s.value).trim() }));
    return JSON.stringify(clean);
  }
}

module.exports = ProductModel;
