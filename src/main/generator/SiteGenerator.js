/**
 * generator/SiteGenerator.js — Main Orchestrator
 * M.R. Textile CMS
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const CategoryPageGenerator = require('./CategoryPageGenerator');
const SitemapGenerator      = require('./SitemapGenerator');
const JsonGenerator         = require('./JsonGenerator');
const ValidationEngine      = require('./ValidationEngine');
const ProductModel          = require('../database/models/Product');
const CategoryModel         = require('../database/models/Category');
const BusinessInfoModel     = require('../database/models/BusinessInfo');
const GalleryModel          = require('../database/models/Gallery');
const PageSEOModel          = require('../database/models/PageSEO');

class SiteGenerator {
  constructor(db, websiteRoot, siteUrl, window = null) {
    this.db          = db;
    this.websiteRoot = websiteRoot;
    this.siteUrl     = siteUrl;
    this.window      = window;

    this.categoryGen = new CategoryPageGenerator(websiteRoot, siteUrl);
    this.sitemapGen  = new SitemapGenerator(websiteRoot, siteUrl);
    this.jsonGen     = new JsonGenerator(websiteRoot);
    this.validator   = new ValidationEngine(websiteRoot);
  }

  /**
   * Run the full generation pipeline.
   * @returns {Promise<{success, summary, errors}>}
   */
  async run() {
    const errors  = [];
    let pagesGenerated = 0;

    try {
      // ── Load shared data ────────────────────────────────────────────────────
      this._progress('Loading data...', 5);
      const productModel  = new ProductModel(this.db);
      const categoryModel = new CategoryModel(this.db);
      const bizModel      = new BusinessInfoModel(this.db);
      const galleryModel  = new GalleryModel(this.db);
      const seoModel      = new PageSEOModel(this.db);

      const categories  = categoryModel.list();
      const businessInfo = bizModel.get();
      const galleryItems = galleryModel.list();

      // ── Validate before generating ──────────────────────────────────────────
      this._progress('Validating content...', 10);
      const validation = this.validator.run(
        categories,
        productModel.list({}),
      );
      if (validation.fatalErrors.length) {
        return { success: false, summary: 'Validation failed', errors: validation.fatalErrors };
      }
      if (validation.warnings.length) {
        errors.push(...validation.warnings.map(w => `Warning: ${w}`));
      }

      // ── Auto-update each category's hero image to first active product ──────
      // Build a map of category slug → first product image for homepage use
      const catFirstImage = {};
      const catProductCount = {};
      for (const cat of categories) {
        const products = productModel.listByCategory(cat.id, true);
        catProductCount[cat.slug] = products.length;
        if (products.length && products[0].main_image) {
          catFirstImage[cat.slug] = products[0].main_image;
          // Auto-update in-memory hero_image so generator uses newest product image
          cat.hero_image = products[0].main_image;
        }
      }

      // ── Generate each category page ─────────────────────────────────────────
      const totalPages = categories.length;
      for (let i = 0; i < categories.length; i++) {
        const cat      = categories[i];
        const products = productModel.listByCategory(cat.id, true);
        const pageSeo  = seoModel.getByKey(cat.slug);

        // Attach variants to each product for the generator
        for (const p of products) {
          p.variants = productModel.getVariants(p.id);
        }

        this._progress(`Generating ${cat.name}...`, 15 + Math.floor((i / totalPages) * 40));

        try {
          // Main site page
          this.categoryGen.generate(cat, products, businessInfo, pageSeo, false);
          pagesGenerated++;

          // B2B page (mirrors same products)
          if (cat.b2b_html_file) {
            this.categoryGen.generate(cat, products, businessInfo, pageSeo, true);
            pagesGenerated++;
          }
        } catch (err) {
          errors.push(`Failed to generate ${cat.html_file}: ${err.message}`);
        }
      }

      // ── Generate JSON data files ─────────────────────────────────────────────
      this._progress('Generating JSON data...', 60);
      const allProducts = productModel.list({});
      this.jsonGen.generateAll(categories, allProducts, galleryItems);

      // ── Update homepage ──────────────────────────────────────────────────────
      this._progress('Updating homepage...', 70);
      this._updateHomepageGallery(galleryItems, businessInfo, catFirstImage, catProductCount, categories);

      // ── Generate sitemap ─────────────────────────────────────────────────────
      this._progress('Generating sitemap...', 80);
      this.sitemapGen.generate(categories);

      // ── Ensure data dir for JSON ─────────────────────────────────────────────
      this._progress('Finalizing...', 90);

      this._progress('Done!', 100);

      const summary = `${pagesGenerated} pages generated, ${categories.length} categories processed`;
      return {
        success: true,
        summary,
        errors,
        pagesGenerated,
      };
    } catch (err) {
      console.error('[SiteGenerator]', err);
      return { success: false, summary: err.message, errors: [err.message] };
    }
  }

  /**
   * Update the homepage gallery masonry section.
   */
  _updateHomepageGallery(galleryItems, businessInfo, catFirstImage = {}, catProductCount = {}, categories = []) {
    const indexPath = path.join(this.websiteRoot, 'index.html');
    if (!fs.existsSync(indexPath)) return;

    let html = fs.readFileSync(indexPath, 'utf8');

    // Update Schema.org business info
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'ClothingStore',
      name: businessInfo.business_name || 'M.R. Textile / M.R. Sarees',
      description: 'Wholesale saree supplier based in Surat, Gujarat, offering Silk, Fancy, Brasso, Wedding and Printed sarees in bulk for retailers.',
      image: `${this.siteUrl}/images/sarees/degital-sarees/saree_1.jpeg`,
      telephone: [businessInfo.phone_primary, businessInfo.phone_secondary].filter(Boolean),
      priceRange: 'Wholesale enquiry',
      address: {
        '@type': 'PostalAddress',
        streetAddress:   businessInfo.address_street  || '',
        addressLocality: businessInfo.address_city    || 'Surat',
        addressRegion:   businessInfo.address_state   || 'Gujarat',
        postalCode:      businessInfo.address_postal  || '',
        addressCountry:  businessInfo.address_country || 'IN',
      },
      openingHoursSpecification: [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
        opens:  businessInfo.hours_weekday_open  || '10:00',
        closes: businessInfo.hours_weekday_close || '20:00',
      }],
      url: this.siteUrl + '/',
    };

    html = html.replace(
      /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">\n  ${JSON.stringify(schema, null, 2)}\n  </script>`
    );

    // ── Update each collection-card image and product count ─────────────────
    // Each card is: <article class="collection-card" data-category="SLUG" ...>
    // Inside it has: <img src="images/..." ...> and <span class="collection-card__count">N+ Designs</span>
    html = html.replace(
      /(<article\s+class="collection-card"\s+data-category="([^"]+)"[^>]*>)([\s\S]*?)(<\/article>)/g,
      (match, openTag, slug, body, closeTag) => {
        let updated = body;

        // Update the img src inside collection-card__img-wrap
        const newImg = catFirstImage[slug];
        if (newImg) {
          updated = updated.replace(
            /(<div\s+class="collection-card__img-wrap">\s*<img\s+src=")[^"]*(")/,
            `$1${newImg}$2`
          );
        }

        // Update product count label
        const count = catProductCount[slug];
        if (count !== undefined) {
          updated = updated.replace(
            /(<span\s+class="collection-card__count">)[^<]*(<\/span>)/,
            `$1${count}+ Designs$2`
          );
        }

        return openTag + updated + closeTag;
      }
    );

    // Update mobile menu phone numbers
    if (businessInfo.phone_primary) {
      html = html.replace(
        /href="tel:[^"]*">(\+91[^<]*)</g,
        (match, number) => {
          const phones = [businessInfo.phone_primary, businessInfo.phone_secondary].filter(Boolean);
          return match; // Keep existing for now — phone update requires more sophisticated replacement
        }
      );
    }

    fs.writeFileSync(indexPath, html, 'utf8');
  }

  _progress(message, percent) {
    console.log(`[Generator] ${percent}% — ${message}`);
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('progress', {
        type:    'generate',
        message,
        percent,
      });
    }
  }
}

module.exports = SiteGenerator;
