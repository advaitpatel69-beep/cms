/**
 * services/ImportService.js — First-Run Product Importer
 * M.R. Textile CMS
 *
 * Scans the existing website image folders and creates database records
 * for all existing products, so the administrator doesn't need to re-upload everything.
 */

'use strict';

const fs    = require('fs');
const path  = require('path');

const ProductModel  = require('../database/models/Product');
const CategoryModel = require('../database/models/Category');

class ImportService {
  constructor(db, websiteRoot) {
    this.db          = db;
    this.websiteRoot = websiteRoot;
  }

  async importExisting() {
    const productModel  = new ProductModel(this.db);
    const categoryModel = new CategoryModel(this.db);
    const categories    = categoryModel.list();

    let imported = 0;
    let skipped  = 0;

    for (const cat of categories) {
      const folderPath = path.join(this.websiteRoot, cat.image_dir);

      if (!fs.existsSync(folderPath)) {
        console.log(`[Import] Folder not found, skipping: ${folderPath}`);
        continue;
      }

      // Collect and sort image files
      const files = fs.readdirSync(folderPath)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.includes('_thumb'))
        .sort();

      // Group by base number: saree_1, saree_2, etc.
      // OR by new naming: saree_101, saree_101.1, etc.
      const groups = this._groupFiles(files, cat.image_dir);

      for (const [code, { main, variants }] of groups.entries()) {
        // Check if already in DB
        const existing = productModel.getByCode(code);
        if (existing) {
          skipped++;
          continue;
        }

        if (!main) continue;

        const ts = new Date().toISOString();
        const displayOrder = imported;

        // Create product record
        const product = productModel.create({
          productCode:  code,
          name:         this._autoName(cat.name, code),
          category_id:  cat.id,
          description:  `High-quality ${cat.name} wholesale saree with beautiful finish.`,
          status:       'active',
          featured:     0,
          display_order: displayOrder,
          mainImage:    `${cat.image_dir}/${main}`,
          created_at:   ts,
          updated_at:   ts,
        });

        // Save variant images
        if (variants.length > 0) {
          productModel.setImages(
            product.id,
            variants.map(v => `${cat.image_dir}/${v}`)
          );
        }

        imported++;
      }
    }

    console.log(`[Import] Done: ${imported} imported, ${skipped} skipped (already existed)`);
    return { imported, skipped };
  }

  _groupFiles(files, imageDir) {
    const groups = new Map();

    for (const file of files) {
      const name = path.parse(file).name;

      // New naming: saree_101 or saree_101.1
      const newMain    = name.match(/^(saree_\d{3,})$/);
      const newVariant = name.match(/^(saree_\d{3,})\.(\d+)$/);

      // Legacy naming: saree_1, saree_2, etc.
      const legacyMain = name.match(/^saree_(\d{1,2})$/);

      if (newMain) {
        const code = newMain[1];
        if (!groups.has(code)) groups.set(code, { main: null, variants: [] });
        groups.get(code).main = file;
      } else if (newVariant) {
        const code = newVariant[1];
        const idx  = parseInt(newVariant[2]) - 1;
        if (!groups.has(code)) groups.set(code, { main: null, variants: [] });
        groups.get(code).variants[idx] = file;
      } else if (legacyMain) {
        // Legacy: treat each file as its own product
        const num  = legacyMain[1];
        const code = `saree_${num}`;
        if (!groups.has(code)) groups.set(code, { main: null, variants: [] });
        if (!groups.get(code).main) {
          groups.get(code).main = file;
        } else {
          groups.get(code).variants.push(file);
        }
      }
    }

    return groups;
  }

  _autoName(categoryName, productCode) {
    const num = productCode.replace('saree_', '');
    // Remove "Sarees" from category name for product name
    const base = categoryName.replace(/\sSarees?$/i, '').trim();
    return `${base} #${num}`;
  }
}

module.exports = ImportService;
