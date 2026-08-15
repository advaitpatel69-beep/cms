/**
 * services/CsvImportExportService.js — Bulk CSV Import & Export
 * M.R. Textile CMS
 *
 * Handles CSV parsing, per-row validation, import commit, and export.
 * No npm dependencies — CSV is plain-text manipulation.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── CSV helpers ────────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into an array of row objects keyed by header names.
 * Handles quoted fields and embedded commas.
 */
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = splitCsvRow(lines[0]).map(h => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitCsvRow(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (values[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

/** Split one CSV line respecting quoted fields */
function splitCsvRow(line) {
  const result = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ',') { result.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/** Escape a value for CSV output */
function csvCell(val) {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Serialize an array of row arrays to a CSV string */
function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => csvCell(row[h] ?? '')).join(','));
  }
  return lines.join('\r\n');
}

// ── The service class ──────────────────────────────────────────────────────────

class CsvImportExportService {
  constructor(db, websiteRoot) {
    this.db          = db;
    this.websiteRoot = websiteRoot;
  }

  // ── EXPORT ────────────────────────────────────────────────────────────────

  /**
   * Export all products to a CSV string.
   * @param {object[]} products  - from ProductModel.list()
   * @param {object[]} categories
   * @returns {string} CSV text
   */
  export(products, categories) {
    const catById = {};
    for (const c of categories) catById[c.id] = c.slug;

    const HEADERS = [
      'product_code', 'name', 'category_slug', 'description',
      'status', 'featured', 'display_order',
      'seo_title', 'seo_description', 'image_filename', 'specs',
    ];

    const rows = products.map(p => {
      // specs: array → compact JSON string
      const specsJson = Array.isArray(p.specs) && p.specs.length
        ? JSON.stringify(p.specs)
        : '';

      // image_filename: extract just the filename from the stored web path
      const imgFile = p.main_image
        ? path.basename(p.main_image.replace(/\\/g, '/'))
        : '';

      return {
        product_code:    p.product_code,
        name:            p.name,
        category_slug:   catById[p.category_id] || '',
        description:     p.description || '',
        status:          p.status || 'active',
        featured:        p.featured ? 'yes' : 'no',
        display_order:   p.display_order ?? 0,
        seo_title:       p.seo_title || '',
        seo_description: p.seo_description || '',
        image_filename:  imgFile,
        specs:           specsJson,
      };
    });

    return toCsv(HEADERS, rows);
  }

  /**
   * Return a downloadable CSV template string (headers + one example row).
   */
  template() {
    const HEADERS = [
      'product_code', 'name', 'category_slug', 'description',
      'status', 'featured', 'display_order',
      'seo_title', 'seo_description', 'image_filename', 'specs',
    ];
    const example = {
      product_code:    'saree_200',
      name:            'Example Saree',
      category_slug:   'silk-sarees',
      description:     'A beautiful example saree.',
      status:          'active',
      featured:        'no',
      display_order:   '0',
      seo_title:       '',
      seo_description: '',
      image_filename:  'saree_200.jpg',
      specs:           '[{"key":"Colors","value":"4"}]',
    };
    return toCsv(HEADERS, [example]);
  }

  // ── PREVIEW / VALIDATE ────────────────────────────────────────────────────

  /**
   * Parse a CSV string and validate every row.
   * Returns a preview object — NO database writes happen here.
   *
   * @param {string}   csvText
   * @param {object[]} categories  - from CategoryModel.list()
   * @returns {{ clean: object[], warned: object[], errored: object[] }}
   *   Each entry has { rowNum, data, errors: [], warnings: [] }
   */
  preview(csvText, categories) {
    const rows = parseCsv(csvText);
    const catBySlug = {};
    for (const c of categories) catBySlug[c.slug] = c;

    // Get existing product codes for duplicate detection
    const existingCodes = new Set(
      this.db.prepare('SELECT product_code FROM products').all().map(r => r.product_code)
    );

    const clean   = [];
    const warned  = [];
    const errored = [];

    rows.forEach((row, idx) => {
      const rowNum  = idx + 2; // +2: 1-indexed + skip header
      const errors  = [];
      const warnings = [];

      // ── Required fields ─────────────────────────────────────────────────
      const code = (row['product_code'] || '').trim();
      const name = (row['name'] || '').trim();
      const slug = (row['category_slug'] || '').trim();

      if (!code)   errors.push('Missing product_code');
      if (!name)   errors.push('Missing name');
      if (!slug)   errors.push('Missing category_slug');

      if (code && existingCodes.has(code)) {
        errors.push(`product_code "${code}" already exists in the database`);
      }

      const cat = catBySlug[slug];
      if (slug && !cat) {
        errors.push(`category_slug "${slug}" not found — available: ${Object.keys(catBySlug).join(', ')}`);
      }

      // ── Optional field validation ────────────────────────────────────────
      const status = (row['status'] || 'active').trim();
      if (!['active', 'out_of_stock'].includes(status)) {
        errors.push(`status must be "active" or "out_of_stock", got "${status}"`);
      }

      const featured = (row['featured'] || 'no').trim().toLowerCase();
      if (!['yes', 'no', ''].includes(featured)) {
        warnings.push(`featured should be "yes" or "no", got "${featured}" — treating as "no"`);
      }

      const displayOrder = parseInt(row['display_order'] || '0', 10);
      if (isNaN(displayOrder)) {
        warnings.push(`display_order "${row['display_order']}" is not a number — defaulting to 0`);
      }

      // ── Image file check ─────────────────────────────────────────────────
      const imgFile = (row['image_filename'] || '').trim();
      let imageExists = false;
      if (imgFile) {
        const imgPath = path.join(this.websiteRoot, 'import-images', imgFile);
        if (fs.existsSync(imgPath)) {
          imageExists = true;
        } else {
          warnings.push(`image_filename "${imgFile}" not found in import-images/ folder — product will import without image`);
        }
      }

      // ── Specs JSON check ─────────────────────────────────────────────────
      let specs = [];
      const specsRaw = (row['specs'] || '').trim();
      if (specsRaw) {
        try {
          const parsed = JSON.parse(specsRaw);
          if (Array.isArray(parsed)) {
            specs = parsed;
          } else {
            warnings.push('specs is not a JSON array — importing with empty specs');
          }
        } catch {
          warnings.push(`specs JSON is malformed: "${specsRaw.slice(0, 40)}" — importing with empty specs`);
        }
      }

      // ── Build validated data object ──────────────────────────────────────
      const entry = {
        rowNum,
        raw: row,
        errors,
        warnings,
        data: {
          product_code:    code,
          name,
          category_id:     cat ? cat.id : null,
          category_slug:   slug,
          description:     (row['description'] || '').trim(),
          status,
          featured:        ['yes', '1', 'true'].includes(featured) ? 1 : 0,
          display_order:   isNaN(displayOrder) ? 0 : displayOrder,
          seo_title:       (row['seo_title'] || '').trim(),
          seo_description: (row['seo_description'] || '').trim(),
          image_filename:  imgFile,
          image_exists:    imageExists,
          specs,
        },
      };

      if (errors.length > 0)        errored.push(entry);
      else if (warnings.length > 0) warned.push(entry);
      else                          clean.push(entry);
    });

    return { clean, warned, errored, total: rows.length };
  }

  // ── COMMIT ────────────────────────────────────────────────────────────────

  /**
   * Commit validated rows (clean + warned) to the database.
   * For each row with an image, runs ImageProcessor pipeline.
   * Returns a result summary.
   *
   * @param {object[]} rows - clean and warned entries from preview()
   * @returns {Promise<{ added: number, withImage: number, errors: string[] }>}
   */
  async commit(rows) {
    const ProductModel   = require('../database/models/Product');
    const ImageProcessor = require('../image/ImageProcessor');
    const CategoryModel  = require('../database/models/Category');

    const model    = new ProductModel(this.db);
    const catModel = new CategoryModel(this.db);
    const processor = new ImageProcessor(this.websiteRoot);

    let added     = 0;
    let withImage = 0;
    const errors  = [];

    for (const entry of rows) {
      const d = entry.data;
      try {
        // Re-check duplicate at commit time (race condition safety)
        if (model.getByCode(d.product_code)) {
          errors.push(`Row ${entry.rowNum}: product_code "${d.product_code}" already exists — skipped`);
          continue;
        }

        // Process image if present
        let mainImagePath = '';
        if (d.image_filename && d.image_exists) {
          try {
            const cat = catModel.getById(d.category_id);
            const srcPath = path.join(this.websiteRoot, 'import-images', d.image_filename);
            const result  = await processor.processProductImage(
              srcPath,
              cat.slug,
              d.product_code,
              0  // variantIndex = 0 (main image)
            );
            mainImagePath = result.webPath;
            withImage++;
          } catch (imgErr) {
            errors.push(`Row ${entry.rowNum}: image processing failed for "${d.image_filename}" — product imported without image (${imgErr.message})`);
          }
        }

        model.create({
          product_code:    d.product_code,
          name:            d.name,
          category_id:     d.category_id,
          description:     d.description,
          status:          d.status,
          featured:        d.featured,
          display_order:   d.display_order,
          seo_title:       d.seo_title,
          seo_description: d.seo_description,
          main_image:      mainImagePath,
          specs:           d.specs,
        });

        added++;
      } catch (err) {
        errors.push(`Row ${entry.rowNum} ("${d.name}"): ${err.message}`);
      }
    }

    return { added, withImage, errors };
  }
}

module.exports = CsvImportExportService;
