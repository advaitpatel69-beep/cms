/**
 * image/ImageProcessor.js — Sharp-based Image Processing Pipeline
 * M.R. Textile CMS
 */

'use strict';

const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');

const SIZES = [
  { suffix: '_thumb',  width: 400  },
  { suffix: '_md',     width: 800  },
  { suffix: '_lg',     width: 1200 },
];

class ImageProcessor {
  /**
   * @param {string} websiteRoot - Absolute path to the github-pages folder
   */
  constructor(websiteRoot) {
    this.websiteRoot = websiteRoot;
  }

  /**
   * Process a product image: copy, optimize JPEG, generate WebP, generate AVIF.
   *
   * @param {string} sourcePath     - Absolute path to the source image
   * @param {string} categorySlug  - e.g. "silk-sarees"
   * @param {string} productCode   - e.g. "saree_101"
   * @param {number} variantIndex  - 0 = main, 1+ = variant
   * @returns {Promise<{webPath: string, generated: string[]}>}
   */
  async processProductImage(sourcePath, categorySlug, productCode, variantIndex = 0) {
    const cat    = this._resolveCategory(categorySlug);
    const outDir = path.join(this.websiteRoot, 'images', 'sarees', cat);
    fs.mkdirSync(outDir, { recursive: true });

    // Derive filename: saree_101.jpg (main) or saree_101.1.jpg (variant)
    const basename = variantIndex === 0
      ? `${productCode}`
      : `${productCode}.${variantIndex}`;

    const jpgPath  = path.join(outDir, `${basename}.jpg`);
    const webpPath = path.join(outDir, `${basename}.webp`);
    const avifPath = path.join(outDir, `${basename}.avif`);

    const generated = [];

    // 1. Optimized JPEG (main copy)
    await sharp(sourcePath)
      .rotate()                      // Auto-rotate from EXIF
      .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toFile(jpgPath);
    generated.push(jpgPath);

    // 2. WebP version
    await sharp(sourcePath)
      .rotate()
      .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(webpPath);
    generated.push(webpPath);

    // 3. AVIF version (smaller, best compression)
    try {
      await sharp(sourcePath)
        .rotate()
        .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
        .avif({ quality: 65 })
        .toFile(avifPath);
      generated.push(avifPath);
    } catch {
      // AVIF may not be supported on all Sharp builds — skip silently
    }

    // 4. Thumbnail
    const thumbPath = path.join(outDir, `${basename}_thumb.jpg`);
    await sharp(sourcePath)
      .rotate()
      .resize({ width: 400, height: 533, fit: 'cover' })
      .jpeg({ quality: 75, progressive: true })
      .toFile(thumbPath);
    generated.push(thumbPath);

    // Return web-relative path (used in HTML)
    const webPath = `images/sarees/${cat}/${basename}.jpg`;
    return { webPath, generated };
  }

  /**
   * Process a gallery image.
   */
  async processGalleryImage(sourcePath) {
    const outDir  = path.join(this.websiteRoot, 'images', 'gallery');
    fs.mkdirSync(outDir, { recursive: true });

    const timestamp = Date.now();
    const basename  = `gallery_${timestamp}`;
    const jpgPath   = path.join(outDir, `${basename}.jpg`);
    const webpPath  = path.join(outDir, `${basename}.webp`);

    await sharp(sourcePath)
      .rotate()
      .resize({ width: 1200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toFile(jpgPath);

    await sharp(sourcePath)
      .rotate()
      .resize({ width: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(webpPath);

    return { webPath: `images/gallery/${basename}.jpg` };
  }

  /**
   * Convert ALL existing JPEG/PNG images in the website to WebP + AVIF.
   * Called on first publish when the user approves.
   *
   * @param {BrowserWindow} window - For progress updates
   */
  async convertAllExistingImages(window) {
    const imagesDir = path.join(this.websiteRoot, 'images');
    const files     = this._walkImages(imagesDir);
    let converted   = 0;
    let failed      = 0;

    for (const file of files) {
      // Skip already-generated WebP/AVIF files
      if (/\.(webp|avif)$/i.test(file)) continue;

      try {
        const parsed  = path.parse(file);
        const webpOut = path.join(parsed.dir, `${parsed.name}.webp`);
        const avifOut = path.join(parsed.dir, `${parsed.name}.avif`);

        // Generate WebP if not exists
        if (!fs.existsSync(webpOut)) {
          await sharp(file)
            .rotate()
            .webp({ quality: 80 })
            .toFile(webpOut);
        }

        // Generate AVIF if not exists
        if (!fs.existsSync(avifOut)) {
          try {
            await sharp(file)
              .rotate()
              .avif({ quality: 65 })
              .toFile(avifOut);
          } catch { /* AVIF skip */ }
        }

        converted++;

        // Send progress update to renderer
        if (window && !window.isDestroyed()) {
          window.webContents.send('progress', {
            type: 'image_convert',
            current: converted,
            total: files.length,
            file: path.basename(file),
          });
        }
      } catch (err) {
        failed++;
        console.error(`[ImageProcessor] Failed to convert: ${file}`, err.message);
      }
    }

    return { converted, failed, total: files.length };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  _resolveCategory(slug) {
    // Map CMS slug to actual folder name
    const map = {
      'silk-sarees':        'silk-sarees',
      'digital-sarees':     'degital-sarees',  // Note: existing typo preserved
      'brasso-sarees':      'brasso-sarees',
      'wedding-sarees':     'wedding-sarees',
      'printed-sarees':     'printed-sarees',
      'party-wear':         'partywear',
      'fancy-sarees':       'fancy-patern-sarees',
      'embroidery-sarees':  'embroidery-sarees',
    };
    return map[slug] || slug;
  }

  _walkImages(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        results.push(...this._walkImages(full));
      } else if (/\.(jpg|jpeg|png)$/i.test(entry)) {
        results.push(full);
      }
    }
    return results;
  }
}

module.exports = ImageProcessor;
