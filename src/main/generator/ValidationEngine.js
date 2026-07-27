/**
 * generator/ValidationEngine.js
 * M.R. Textile CMS — Pre-publish validation
 */

'use strict';

const fs   = require('fs');
const path = require('path');

class ValidationEngine {
  constructor(websiteRoot) {
    this.websiteRoot = websiteRoot;
  }

  /**
   * Run all validations.
   * @returns {{ fatalErrors: string[], warnings: string[] }}
   */
  run(categories, products) {
    const fatalErrors = [];
    const warnings    = [];

    // 1. Check website root exists
    if (!fs.existsSync(this.websiteRoot)) {
      fatalErrors.push(`Website root not found: ${this.websiteRoot}`);
      return { fatalErrors, warnings };
    }

    // 2. Check category HTML files exist
    for (const cat of categories) {
      const htmlPath = path.join(this.websiteRoot, cat.html_file);
      if (!fs.existsSync(htmlPath)) {
        warnings.push(`Category page not found, will create: ${cat.html_file}`);
      }
    }

    // 3. Check product images exist
    let missingImages = 0;
    for (const p of products) {
      if (p.status === 'archived') continue;
      if (!p.main_image) {
        warnings.push(`Product "${p.name}" has no main image`);
        continue;
      }
      const imgPath = path.join(this.websiteRoot, p.main_image);
      if (!fs.existsSync(imgPath)) {
        missingImages++;
        if (missingImages <= 5) {
          warnings.push(`Missing image for "${p.name}": ${p.main_image}`);
        }
      }
    }
    if (missingImages > 5) {
      warnings.push(`...and ${missingImages - 5} more missing images`);
    }

    // 4. Check for duplicate product codes
    const codes = products.map(p => p.product_code);
    const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (dupes.length) {
      fatalErrors.push(`Duplicate product codes found: ${[...new Set(dupes)].join(', ')}`);
    }

    // 5. Check git is initialized
    const gitDir = path.join(this.websiteRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      warnings.push('Git repository not found in website root. Git push will not work.');
    }

    return { fatalErrors, warnings };
  }
}

module.exports = ValidationEngine;
