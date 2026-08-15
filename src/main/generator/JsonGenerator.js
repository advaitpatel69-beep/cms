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
    this.generateSearchIndex(products, categories);
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

  generateSearchIndex(products, categories) {
    const catMap = {};
    for (const c of categories) {
      catMap[c.id] = { name: c.name, slug: c.slug, url: c.html_file || '' };
    }

    // Include both active AND out_of_stock — OOS products are still visible
    // on category pages (just badged), so visitors should be able to search them.
    const index = products
      .filter(p => p.status === 'active' || p.status === 'out_of_stock')
      .map(p => {
        const cat = catMap[p.category_id] || {};
        return {
          id:       p.id,
          name:     p.name,
          category: cat.name  || '',
          desc:     (p.description || '').substring(0, 200),
          image:    p.main_image || '',
          slug:     cat.slug || p.category_slug || '',
          url:      cat.url  || '',          // relative path to category page, e.g. "silk.html"
          status:   p.status,
        };
      });
    this._write('search-index.json', index);
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
