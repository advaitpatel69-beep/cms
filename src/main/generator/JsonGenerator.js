/**
 * generator/JsonGenerator.js
 * M.R. Textile CMS
 */

'use strict';

const fs   = require('fs');
const path = require('path');

class JsonGenerator {
  constructor(websiteRoot) {
    this.websiteRoot = websiteRoot;
    this.dataDir     = path.join(websiteRoot, 'data');
    fs.mkdirSync(this.dataDir, { recursive: true });
  }

  generateAll(categories, products, galleryItems) {
    this.generateCategories(categories);
    this.generateProducts(products);
    this.generateGallery(galleryItems);
    // search-index.json removed: the per-category DOM filter (Task 2) is the
    // working search implementation. If site-wide search is needed in future,
    // re-add a JSON index and wire the search bar to fetch it.
  }

  generateCategories(categories) {
    const data = categories.map(c => ({
      id:              c.id,
      slug:            c.slug,
      name:            c.name,
      htmlFile:        c.html_file,
      heroImage:       c.hero_image,
      description:     c.description,
      displayOrder:    c.display_order,
      homepageVisible: c.homepage_visible === 1,
      productCount:    c.active_products || 0,
    }));
    this._write('categories.json', data);
  }

  generateProducts(products) {
    const data = products
      .filter(p => p.status === 'active' || p.status === 'out_of_stock')
      .map(p => ({
        id:          p.id,
        code:        p.product_code,
        name:        p.name,
        category:    p.category_slug,
        description: p.description,
        status:      p.status,
        featured:    p.featured === 1,
        mainImage:   p.main_image,
        variants:    p.variant_images ? p.variant_images.split(',').filter(Boolean) : [],
      }));
    this._write('products.json', data);
  }

  generateGallery(galleryItems) {
    const data = galleryItems.map(g => ({
      id:        g.id,
      imagePath: g.image_path,
      caption:   g.caption,
      category:  g.category,
      altText:   g.alt_text,
      order:     g.display_order,
    }));
    this._write('gallery.json', data);
  }


  _write(filename, data) {
    fs.writeFileSync(
      path.join(this.dataDir, filename),
      JSON.stringify(data, null, 2),
      'utf8'
    );
  }
}

module.exports = JsonGenerator;
