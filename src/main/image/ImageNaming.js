/**
 * image/ImageNaming.js — Auto Product Code Assignment
 * M.R. Textile CMS
 */

'use strict';

const path = require('path');
const fs   = require('fs');

class ImageNaming {
  constructor(db, websiteRoot) {
    this.db          = db;
    this.websiteRoot = websiteRoot;
  }

  /**
   * Generate the next available product code for a category.
   * Format: saree_<number>
   * Starts at 101 and increments.
   *
   * @param {number} categoryId
   * @returns {string} e.g. "saree_101"
   */
  nextCode(categoryId) {
    // Find the highest saree_NNN number across ALL products (not just this category),
    // because product_code must be globally unique in the DB.
    const row = this.db.prepare(`
      SELECT product_code FROM products
      WHERE product_code LIKE 'saree_%'
      ORDER BY CAST(SUBSTR(product_code, 7) AS INTEGER) DESC
      LIMIT 1
    `).get();

    let next = row ? (parseInt(row.product_code.replace('saree_', '')) + 1) : 101;

    // Safety loop: keep incrementing until we find a code not already taken
    const exists = this.db.prepare(`SELECT 1 FROM products WHERE product_code = ?`);
    while (exists.get(`saree_${next}`)) {
      next++;
    }

    return `saree_${next}`;
  }


  /**
   * Detect variant groupings from a folder of image files.
   * Groups by base name pattern:
   *   saree_101.jpg       → main
   *   saree_101.1.jpg     → variant 1
   *   saree_101.2.jpg     → variant 2
   *
   * @param {string} folderPath - Absolute path to scan
   * @returns {Map<string, {main: string|null, variants: string[]}>}
   */
  detectGroups(folderPath) {
    if (!fs.existsSync(folderPath)) return new Map();

    const files = fs.readdirSync(folderPath)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.includes('_thumb'));

    const groups = new Map();

    for (const file of files) {
      const name = path.parse(file).name;

      // Match: saree_101 or saree_101.1
      const mainMatch    = name.match(/^(saree_\d+)$/);
      const variantMatch = name.match(/^(saree_\d+)\.(\d+)$/);

      if (mainMatch) {
        const code = mainMatch[1];
        if (!groups.has(code)) groups.set(code, { main: null, variants: [] });
        groups.get(code).main = path.join(folderPath, file);
      } else if (variantMatch) {
        const code    = variantMatch[1];
        const varIdx  = parseInt(variantMatch[2]);
        if (!groups.has(code)) groups.set(code, { main: null, variants: [] });
        groups.get(code).variants[varIdx - 1] = path.join(folderPath, file);
      }
    }

    return groups;
  }

  /**
   * Legacy detection: find grouped images by old naming (saree_1, saree_2, etc.)
   * Used during the first-run import of existing images.
   *
   * @param {string} folderPath
   * @returns {string[]} sorted list of image paths (no variant sub-grouping in legacy)
   */
  detectLegacyImages(folderPath) {
    if (!fs.existsSync(folderPath)) return [];

    return fs.readdirSync(folderPath)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map(f => ({ file: f, num: parseInt(f.match(/\d+/) || [0]) }))
      .sort((a, b) => a.num - b.num)
      .map(({ file }) => path.join(folderPath, file));
  }
}

module.exports = ImageNaming;
