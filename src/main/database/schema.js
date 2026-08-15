/**
 * database/schema.js — Database Schema & Migrations
 * M.R. Textile CMS
 */

'use strict';

const SCHEMA_VERSION = 3;

/**
 * Create all tables and run any pending migrations.
 * @param {import('better-sqlite3').Database} db
 */
function runMigrations(db) {
  // Create version tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const current = db.prepare('SELECT version FROM schema_version').get();
  const version = current ? current.version : 0;

  if (version < 1) {
    createV1Schema(db);
    db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(1);
  }

  if (version < 2) {
    migrateV2(db);
    db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(2);
  }

  if (version < 3) {
    migrateV3(db);
    db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(3);
  }

  // Future: if (version < 4) { ... }
}

/**
 * v2 — Product Specifications
 *  - specs column: JSON array of {key, value} pairs on each product
 *  - spec_keys table: collects all ever-used spec key names for autocomplete
 */
function migrateV2(db) {
  // Add specs column to existing products table (safe — ALTER TABLE ADD COLUMN)
  try {
    db.exec(`ALTER TABLE products ADD COLUMN specs TEXT DEFAULT '[]';`);
  } catch (e) {
    // Column may already exist if migration ran partially — ignore
    if (!e.message.includes('duplicate column')) throw e;
  }

  // New lookup table for autocomplete
  db.exec(`
    CREATE TABLE IF NOT EXISTS spec_keys (
      key TEXT PRIMARY KEY  -- e.g. "Colors", "Set of", "Fabric"
    );
  `);
}

/**
 * v3 — Product Variants
 *  - product_variants table: each row is a named variant with its own stock status
 *  - Migration: every existing product gets one default variant seeded from its current status
 */
function migrateV3(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      label      TEXT    NOT NULL,
      status     TEXT    DEFAULT 'active',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT    NOT NULL,
      updated_at TEXT    NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
  `);

  // Backfill: every existing product gets a single 'Default' variant.
  // Archived products get status 'out_of_stock' on the variant (archived is product-level).
  // Guard: WHERE NOT IN ensures this is idempotent — safe to run multiple times.
  db.exec(`
    INSERT INTO product_variants (product_id, label, status, sort_order, created_at, updated_at)
    SELECT
      id,
      'Default',
      CASE WHEN status = 'active' THEN 'active' ELSE 'out_of_stock' END,
      0,
      created_at,
      created_at
    FROM products
    WHERE id NOT IN (SELECT DISTINCT product_id FROM product_variants);
  `);
}

function createV1Schema(db) {
  db.exec(`
    -- ============================================================
    -- Categories
    -- ============================================================
    CREATE TABLE IF NOT EXISTS categories (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      slug             TEXT    UNIQUE NOT NULL,
      name             TEXT    NOT NULL,
      html_file        TEXT    NOT NULL,
      b2b_html_file    TEXT,
      image_dir        TEXT    NOT NULL,
      hero_image       TEXT,
      description      TEXT,
      intro_headline   TEXT,
      intro_text       TEXT,
      seo_title        TEXT,
      seo_description  TEXT,
      display_order    INTEGER DEFAULT 0,
      homepage_visible INTEGER DEFAULT 1,
      product_count    INTEGER DEFAULT 0,
      created_at       TEXT    NOT NULL,
      updated_at       TEXT    NOT NULL
    );

    -- ============================================================
    -- Products
    -- ============================================================
    CREATE TABLE IF NOT EXISTS products (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code     TEXT    UNIQUE NOT NULL,
      name             TEXT    NOT NULL,
      category_id      INTEGER NOT NULL,
      description      TEXT,
      status           TEXT    DEFAULT 'active',
      featured         INTEGER DEFAULT 0,
      display_order    INTEGER DEFAULT 0,
      seo_title        TEXT,
      seo_description  TEXT,
      main_image       TEXT,
      out_of_stock_date TEXT,
      archive_date     TEXT,
      created_at       TEXT    NOT NULL,
      updated_at       TEXT    NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_status   ON products(status);

    -- ============================================================
    -- Product Images (variants)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS product_images (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id   INTEGER NOT NULL,
      image_path   TEXT    NOT NULL,
      sort_order   INTEGER DEFAULT 0,
      alt_text     TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- ============================================================
    -- Business Information (single row, id always = 1)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS business_info (
      id                    INTEGER PRIMARY KEY,
      business_name         TEXT,
      address_street        TEXT,
      address_city          TEXT,
      address_state         TEXT,
      address_postal        TEXT,
      address_country       TEXT    DEFAULT 'IN',
      phone_primary         TEXT,
      phone_secondary       TEXT,
      whatsapp              TEXT,
      email                 TEXT,
      gst                   TEXT,
      maps_link             TEXT,
      hours_weekday_open    TEXT,
      hours_weekday_close   TEXT,
      hours_weekend_open    TEXT,
      hours_weekend_close   TEXT,
      hours_closed_days     TEXT,
      instagram             TEXT,
      facebook              TEXT,
      youtube               TEXT,
      updated_at            TEXT
    );

    -- Seed default business info from existing website data
    INSERT OR IGNORE INTO business_info (
      id, business_name, address_street, address_city,
      address_state, address_postal, address_country,
      phone_primary, phone_secondary, whatsapp,
      hours_weekday_open, hours_weekday_close, hours_closed_days,
      updated_at
    ) VALUES (
      1,
      'M.R. Textile / M.R. Sarees',
      '133, 1st Floor, Manish Market, Ring Road',
      'Surat', 'Gujarat', '395003', 'IN',
      '+91 9428393320', '+91 9427810031', '919428393320',
      '10:00', '20:00', 'Sunday',
      datetime('now')
    );

    -- ============================================================
    -- Gallery
    -- ============================================================
    CREATE TABLE IF NOT EXISTS gallery (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      image_path    TEXT    NOT NULL,
      caption       TEXT,
      category      TEXT,
      alt_text      TEXT,
      display_order INTEGER DEFAULT 0,
      created_at    TEXT    NOT NULL
    );

    -- ============================================================
    -- Page SEO
    -- ============================================================
    CREATE TABLE IF NOT EXISTS page_seo (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      page_key     TEXT    UNIQUE NOT NULL,
      title        TEXT,
      description  TEXT,
      canonical    TEXT,
      og_image     TEXT,
      schema_json  TEXT,
      updated_at   TEXT
    );

    -- ============================================================
    -- Activity Log
    -- ============================================================
    CREATE TABLE IF NOT EXISTS activity_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      action      TEXT    NOT NULL,
      entity_type TEXT,
      entity_id   INTEGER,
      details     TEXT,
      created_at  TEXT    NOT NULL
    );

    -- ============================================================
    -- Settings (key-value store)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- ============================================================
    -- Auto-archive scheduler queue
    -- ============================================================
    CREATE TABLE IF NOT EXISTS scheduler_queue (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type    TEXT    NOT NULL,
      entity_id      INTEGER NOT NULL,
      action         TEXT    NOT NULL,
      scheduled_for  TEXT    NOT NULL,
      completed      INTEGER DEFAULT 0,
      completed_at   TEXT
    );
  `);

  // Seed default categories from the existing website
  seedDefaultCategories(db);
  seedDefaultSEO(db);
}

function seedDefaultCategories(db) {
  const now = new Date().toISOString();
  const cats = [
    {
      slug: 'silk-sarees', name: 'Silk Sarees',
      html_file: 'silk.html', b2b_html_file: 'b2b/silk.html',
      image_dir: 'images/sarees/silk-sarees',
      hero_image: 'images/sarees/silk-sarees/saree_1.jpeg',
      description: 'Premium wholesale silk sarees from Surat',
      intro_headline: 'Woven Heritage of Elegance and Splendor',
      intro_text: 'Our wholesale silk saree collection captures the essence of royal Indian attire.',
      seo_title: 'Wholesale Silk Sarees Surat | M.R. Textile',
      seo_description: 'Buy premium wholesale silk sarees direct from Surat manufacturer.',
      display_order: 1,
    },
    {
      slug: 'digital-sarees', name: 'Digital Sarees',
      html_file: 'digital.html', b2b_html_file: 'b2b/digital.html',
      image_dir: 'images/sarees/degital-sarees',
      hero_image: 'images/sarees/degital-sarees/saree_1.jpeg',
      description: 'Digital printed sarees wholesale',
      intro_headline: 'Vivid Digital Prints, Wholesale Excellence',
      intro_text: 'Modern digital printing technology meets traditional saree aesthetics.',
      seo_title: 'Wholesale Digital Sarees Surat | M.R. Textile',
      seo_description: 'Buy digital printed sarees wholesale from Surat.',
      display_order: 2,
    },
    {
      slug: 'brasso-sarees', name: 'Brasso Sarees',
      html_file: 'brasso.html', b2b_html_file: 'b2b/brasso.html',
      image_dir: 'images/sarees/brasso-sarees',
      hero_image: 'images/sarees/brasso-sarees/saree_1.jpeg',
      description: 'Wholesale brasso sarees Surat',
      intro_headline: 'Sheer Elegance in Every Thread',
      intro_text: 'Brasso sarees feature semi-transparent velvet-like patterns.',
      seo_title: 'Wholesale Brasso Sarees Surat | M.R. Textile',
      seo_description: 'Buy brasso sarees wholesale from Surat.',
      display_order: 3,
    },
    {
      slug: 'wedding-sarees', name: 'Wedding Sarees',
      html_file: 'wedding.html', b2b_html_file: 'b2b/wedding.html',
      image_dir: 'images/sarees/wedding-sarees',
      hero_image: 'images/sarees/wedding-sarees/saree_1.jpeg',
      description: 'Wholesale wedding sarees for retailers',
      intro_headline: 'Bridal Grandeur at Wholesale Value',
      intro_text: 'Exquisite wedding saree collection for retailers.',
      seo_title: 'Wholesale Wedding Sarees Surat | M.R. Textile',
      seo_description: 'Buy wedding sarees wholesale from Surat.',
      display_order: 4,
    },
    {
      slug: 'printed-sarees', name: 'Printed Sarees',
      html_file: 'printed.html', b2b_html_file: 'b2b/printed.html',
      image_dir: 'images/sarees/printed-sarees',
      hero_image: 'images/sarees/printed-sarees/saree_1.jpeg',
      description: 'Printed sarees wholesale Surat',
      intro_headline: 'Artful Prints, Wholesale Prices',
      intro_text: 'Our printed saree collection spans block prints, screen prints and more.',
      seo_title: 'Wholesale Printed Sarees Surat | M.R. Textile',
      seo_description: 'Buy printed sarees wholesale from Surat.',
      display_order: 5,
    },
    {
      slug: 'party-wear', name: 'Party Wear Sarees',
      html_file: 'party-wear.html', b2b_html_file: 'b2b/party-wear.html',
      image_dir: 'images/sarees/partywear',
      hero_image: 'images/sarees/partywear/saree_1.jpeg',
      description: 'Party wear sarees wholesale',
      intro_headline: 'Glamour Meets Wholesale Value',
      intro_text: 'Festive party wear sarees for modern retail boutiques.',
      seo_title: 'Wholesale Party Wear Sarees Surat | M.R. Textile',
      seo_description: 'Buy party wear sarees wholesale from Surat.',
      display_order: 6,
    },
    {
      slug: 'fancy-sarees', name: 'Fancy Sarees',
      html_file: 'fancy.html', b2b_html_file: 'b2b/fancy.html',
      image_dir: 'images/sarees/fancy-patern-sarees',
      hero_image: 'images/sarees/fancy-patern-sarees/saree_1.jpeg',
      description: 'Fancy pattern sarees wholesale',
      intro_headline: 'Distinctive Patterns, Unbeatable Wholesale',
      intro_text: 'Unique fancy pattern sarees for discerning retailers.',
      seo_title: 'Wholesale Fancy Sarees Surat | M.R. Textile',
      seo_description: 'Buy fancy pattern sarees wholesale from Surat.',
      display_order: 7,
    },
    {
      slug: 'embroidery-sarees', name: 'Embroidery Sarees',
      html_file: 'embroidery.html', b2b_html_file: 'b2b/embroidery.html',
      image_dir: 'images/sarees/embroidery-sarees',
      hero_image: 'images/sarees/embroidery-sarees/saree_1.jpeg',
      description: 'Embroidery sarees wholesale Surat',
      intro_headline: 'Handcrafted Excellence at Every Stitch',
      intro_text: 'Intricate embroidery work on premium fabric.',
      seo_title: 'Wholesale Embroidery Sarees Surat | M.R. Textile',
      seo_description: 'Buy embroidery sarees wholesale from Surat.',
      display_order: 8,
    },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO categories (
      slug, name, html_file, b2b_html_file, image_dir, hero_image,
      description, intro_headline, intro_text,
      seo_title, seo_description, display_order, homepage_visible,
      created_at, updated_at
    ) VALUES (
      @slug, @name, @html_file, @b2b_html_file, @image_dir, @hero_image,
      @description, @intro_headline, @intro_text,
      @seo_title, @seo_description, @display_order, 1,
      @now, @now
    )
  `);

  const insert = db.transaction((categories) => {
    for (const cat of categories) {
      stmt.run({ ...cat, now });
    }
  });

  insert(cats);
}

function seedDefaultSEO(db) {
  const now = new Date().toISOString();
  const pages = [
    {
      page_key: 'home',
      title: 'M.R. Textile | Premium Saree Wholesaler in Surat, Gujarat',
      description: 'M.R. Textile (M.R. Sarees) is a wholesale saree supplier based in Manish Market, Surat — Silk, brasso, Fancy and wedding sarees in bulk for retailers across India.',
      canonical: 'https://mrtextile.online/',
      og_image: 'https://mrtextile.online/images/sarees/degital-sarees/saree_1.jpeg',
    },
    {
      page_key: 'contact',
      title: 'Contact M.R. Textile | Wholesale Saree Inquiry Surat',
      description: 'Contact M.R. Textile for wholesale saree inquiry. Located at Manish Market, Ring Road, Surat. Call +91 9428393320.',
      canonical: 'https://mrtextile.online/contact.html',
      og_image: 'https://mrtextile.online/images/sarees/degital-sarees/saree_1.jpeg',
    },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO page_seo (page_key, title, description, canonical, og_image, updated_at)
    VALUES (@page_key, @title, @description, @canonical, @og_image, @now)
  `);

  const insert = db.transaction((pages) => {
    for (const p of pages) stmt.run({ ...p, now });
  });

  insert(pages);
}

module.exports = { runMigrations };
