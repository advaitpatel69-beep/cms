/**
 * generator/CategoryPageGenerator.js
 * M.R. Textile CMS — Static Site Generator
 *
 * Regenerates each category HTML page (silk.html, brasso.html, etc.)
 * from the existing page structure by replacing only the dynamic sections:
 *  - SEO <head> metadata
 *  - <title>, <meta description>, OG/Twitter tags
 *  - Schema.org JSON-LD (business info)
 *  - Category hero section
 *  - Category intro section
 *  - Product grid (.product-grid)
 *  - Gallery masonry (.masonry)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

class CategoryPageGenerator {
  /**
   * @param {string} websiteRoot
   * @param {string} siteUrl
   */
  constructor(websiteRoot, siteUrl) {
    this.websiteRoot = websiteRoot;
    this.siteUrl     = siteUrl.replace(/\/$/, '');
  }

  /**
   * Generate a single category page.
   *
   * @param {object} category    - Category row from DB
   * @param {object[]} products  - Products for this category
   * @param {object} businessInfo - Business info row
   * @param {object} pageSeo     - SEO row for this page
   * @param {boolean} isB2B      - Whether generating B2B version
   */
  generate(category, products, businessInfo, pageSeo, isB2B = false) {
    const htmlFile = isB2B ? category.b2b_html_file : category.html_file;
    if (!htmlFile) return;

    const filePath = path.join(this.websiteRoot, htmlFile);

    // Read existing file or generate from scratch
    let html = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf8')
      : this._buildSkeleton(category, isB2B);

    // 1. Update <title>
    html = this._replaceTag(html, 'title', pageSeo?.title || category.seo_title || category.name);

    // 2. Update meta description
    html = this._replaceMeta(html, 'description', pageSeo?.description || category.seo_description || '');

    // 3. Update canonical
    const canonicalUrl = `${this.siteUrl}/${htmlFile}`;
    html = this._replaceCanonical(html, canonicalUrl);

    // 4. Update OG tags
    const ogImage = pageSeo?.og_image || `${this.siteUrl}/${category.hero_image || ''}`;
    html = this._replaceOG(html, {
      title:       pageSeo?.title || category.seo_title || category.name,
      description: pageSeo?.description || category.seo_description || '',
      image:       ogImage,
      url:         canonicalUrl,
    });

    // 5. Update Twitter tags
    html = this._replaceTwitter(html, {
      title:       pageSeo?.title || category.seo_title || category.name,
      description: pageSeo?.description || category.seo_description || '',
      image:       ogImage,
    });

    // 6. Update Schema.org JSON-LD
    html = this._replaceSchema(html, businessInfo, canonicalUrl);

    // 7. Update category hero section
    html = this._replaceHero(html, category, isB2B);

    // 8. Update category intro
    html = this._replaceIntro(html, category);

    // 9. Regenerate product grid
    html = this._replaceProductGrid(html, products, category, isB2B);

    // 10. Regenerate gallery masonry
    html = this._replaceGallery(html, products, category);

    // Ensure output directory exists
    const outDir = path.dirname(filePath);
    fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(filePath, html, 'utf8');
    return filePath;
  }

  // ─── Replacement helpers ─────────────────────────────────────────────────────

  _replaceTag(html, tag, content) {
    return html.replace(
      new RegExp(`<${tag}>[^<]*</${tag}>`, 'i'),
      `<${tag}>${this._esc(content)}</${tag}>`
    );
  }

  _replaceMeta(html, name, content) {
    return html.replace(
      new RegExp(`<meta\\s+name="${name}"[^>]*>`, 'i'),
      `<meta name="${name}" content="${this._esc(content)}" />`
    );
  }

  _replaceCanonical(html, url) {
    return html.replace(
      /<link\s+rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${url}" />`
    );
  }

  _replaceOG(html, { title, description, image, url }) {
    html = html.replace(/<meta\s+property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${this._esc(title)}" />`);
    html = html.replace(/<meta\s+property="og:description"[^>]*>/i,
      `<meta property="og:description" content="${this._esc(description)}" />`);
    html = html.replace(/<meta\s+property="og:image"[^>]*>/i,
      `<meta property="og:image" content="${image}" />`);
    html = html.replace(/<meta\s+property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${url}" />`);
    return html;
  }

  _replaceTwitter(html, { title, description, image }) {
    html = html.replace(/<meta\s+name="twitter:title"[^>]*>/i,
      `<meta name="twitter:title" content="${this._esc(title)}" />`);
    html = html.replace(/<meta\s+name="twitter:description"[^>]*>/i,
      `<meta name="twitter:description" content="${this._esc(description)}" />`);
    html = html.replace(/<meta\s+name="twitter:image"[^>]*>/i,
      `<meta name="twitter:image" content="${image}" />`);
    return html;
  }

  _replaceSchema(html, biz, pageUrl) {
    if (!biz) return html;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'ClothingStore',
      name: biz.business_name || 'M.R. Textile / M.R. Sarees',
      description: 'Wholesale saree supplier based in Surat, Gujarat.',
      image: `${this.siteUrl}/images/sarees/degital-sarees/saree_1.jpeg`,
      telephone: [biz.phone_primary, biz.phone_secondary].filter(Boolean),
      priceRange: 'Wholesale enquiry',
      address: {
        '@type': 'PostalAddress',
        streetAddress:   biz.address_street  || '',
        addressLocality: biz.address_city    || 'Surat',
        addressRegion:   biz.address_state   || 'Gujarat',
        postalCode:      biz.address_postal  || '',
        addressCountry:  biz.address_country || 'IN',
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
          opens:  biz.hours_weekday_open  || '10:00',
          closes: biz.hours_weekday_close || '20:00',
        },
      ],
      url: this.siteUrl + '/',
    };

    const jsonStr = JSON.stringify(schema, null, 2);
    const scriptTag = `<script type="application/ld+json">\n  ${jsonStr}\n  </script>`;

    return html.replace(
      /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/,
      scriptTag
    );
  }

  _replaceHero(html, category, isB2B) {
    const heroImg = category.hero_image || '';
    const catName = category.name || '';
    const desc    = category.description || '';

    const heroPattern = /(<section[^>]*class="[^"]*category-hero[^"]*"[^>]*>)([\s\S]*?)(<\/section>)/;

    if (!heroPattern.test(html)) return html;

    const heroHtml = `
    <section class="category-hero" style="background-image: url('${heroImg}');" id="hero">
      <div class="category-hero__content" data-reveal="fade">
        <nav class="category-hero__breadcrumbs" aria-label="Breadcrumb">
          <a href="${isB2B ? '../' : ''}index.html">Home</a><span>&rarr;</span>
          <a href="${isB2B ? '../' : ''}index.html#collections">Collections</a><span>&rarr;</span>
          <span>${this._esc(catName)}</span>
        </nav>
        <h1 class="category-hero__title" data-reveal="rise">${this._esc(catName)} Collection</h1>
        <p class="category-hero__desc" data-reveal="fade" data-reveal-delay="100">${this._esc(desc)}</p>
      </div>
    </section>`;

    return html.replace(heroPattern, heroHtml);
  }

  _replaceIntro(html, category) {
    const headline = category.intro_headline || '';
    const body     = category.intro_text     || '';

    const introPattern = /(<section[^>]*class="[^"]*category-intro[^"]*"[^>]*>)([\s\S]*?)(<\/section>)/;
    if (!introPattern.test(html) || !headline) return html;

    const introHtml = `
    <section class="section category-intro" id="intro">
      <div class="container">
        <div class="category-intro__content" data-reveal="fade">
          <p class="eyebrow" style="justify-content:center;">About the Craft</p>
          <h2 class="category-intro__headline">${this._esc(headline)}</h2>
          <p class="category-intro__body">${this._esc(body)}</p>
        </div>
      </div>
    </section>`;

    return html.replace(introPattern, introHtml);
  }

  _replaceProductGrid(html, products, category, isB2B) {
    if (isB2B) {
      return this._replaceB2BGrid(html, products, category);
    }

    // Build search bar (retail only) + product cards
    const searchBar = this._buildSearchBar(products.length);
    const gridHtml  = this._buildProductGrid(products, category, false);

    // Replace content inside .product-grid (retail pages)
    const gridPattern = /(<div\s+class="product-grid">)([\s\S]*?)(<\/div>\s*<\/div>\s*<\/section>)/;

    if (gridPattern.test(html)) {
      return html.replace(
        gridPattern,
        `${searchBar}$1\n${gridHtml}\n        </div>\n      </div>\n    </section>`
      );
    }

    return html;
  }

  /**
   * B2B pages use <div class="grid grid--3"> inside <section id="catalog">.
   * Replace the entire contents of that grid div.
   */
  _replaceB2BGrid(html, products, category) {
    const gridHtml = this._buildB2BProductGrid(products, category);

    // Match <div class="grid grid--3"> ... </div> inside the catalog section
    const b2bPattern = /(<div\s+class="grid\s+grid--3">)([\s\S]*?)(<\/div>\s*\n?\s*<\/div>\s*\n?\s*<\/section>)/;

    if (b2bPattern.test(html)) {
      return html.replace(b2bPattern, `$1\n${gridHtml}\n        </div>\n      </div>\n    </section>`);
    }

    return html;
  }

  _buildProductGrid(products, category, isB2B) {
    if (!products || products.length === 0) {
      return `
          <div class="no-products">
            <p>No products currently available in this category.</p>
          </div>`;
    }

    const waBase = 'https://wa.me/919428393320?text=Hi%20M.R.%20Textile%2C%20I%20am%20a%20retailer%20and%20I%20want%20to%20inquire%20about%20bulk%20ordering%20from%20your%20collection.';

    // Emit variant chip styles once per page (only if any product actually has variants)
    const hasVariants = products.some(p =>
      Array.isArray(p.variants) && !(p.variants.length === 1 && p.variants[0].label === 'Default')
    );
    const variantStyles = hasVariants ? `
      <style>
        .variant-chip {
          display:inline-block;font-size:0.72rem;padding:3px 10px;margin:2px;
          border-radius:20px;border:1px solid rgba(255,255,255,0.18);
          background:rgba(255,255,255,0.06);color:inherit;cursor:pointer;
          transition:background 0.15s,border-color 0.15s;
        }
        .variant-chip--active,.variant-chip:hover:not(.variant-chip--oos) {
          background:rgba(201,168,76,0.18);border-color:rgba(201,168,76,0.6);
        }
        .product-card__variants { display:flex;flex-wrap:wrap;gap:2px;margin:6px 0; }
      </style>` : '';

    return variantStyles + products.map((product, i) => {
      const variants    = product.variant_images
        ? product.variant_images.split(',').filter(Boolean)
        : [];
      const allImages   = [product.main_image, ...variants].filter(Boolean);
      const imagesAttr  = allImages.join(',');
      const isOOS       = product.status === 'out_of_stock';
      const isFeatured  = product.featured === 1;

      const outOfStockBadge = isOOS
        ? `<div class="product-card__oos-badge">Out of Stock</div>`
        : '';
      const featuredBadge = isFeatured
        ? `<div class="product-card__featured-badge">Featured</div>`
        : '';

      // Use CMS-managed specs (remove old hardcoded Colors count)
      const specsHtml = this._buildSpecsHtml(product.specs);

      // Build variant chips (only if product has real variants beyond single Default)
      const variantsHtml = this._buildVariantChips(product, waBase);
      // Unique WA button ID for JS targeting
      const waBtnId = `wa-btn-${product.id}`;

      return `
          <div class="product-card" data-reveal="rise" data-reveal-group="products"
            data-product-title="${this._esc(product.name)}"
            data-product-desc="${this._esc(product.description || '')}"
            data-product-images="${imagesAttr}"
            data-product-colors="Multiple Options"
            data-product-fabric="Premium Fabric"
            data-product-occasions="Retail &amp; Wholesale">
            <div class="product-card__img-container" role="button" aria-label="View ${this._esc(category.name)} catalog gallery">
              ${outOfStockBadge}${featuredBadge}
              <img src="${product.main_image}"
                alt="${this._esc(product.name)}" loading="${i < 4 ? 'eager' : 'lazy'}" />
              <div class="product-card__overlay"><span class="btn btn--ghost btn--sm"
                  style="position: absolute; top:50%; left:50%; transform:translate(-50%,-50%);">Open Catalog</span>
              </div>
            </div>
            <div class="product-card__body">
              <h3 class="product-card__title">${this._esc(product.name)}</h3>
              <p class="product-card__desc">${this._esc(product.description || 'Premium wholesale saree.')}</p>
              ${specsHtml}
              ${variantsHtml}
              <a id="${waBtnId}" href="${waBase}" target="_blank" rel="noopener"
                class="btn btn--gold product-card__btn">Send Inquiry</a>
            </div>
          </div>`;
    }).join('\n');
  }

  /** Build B2B product cards matching the existing B2B page structure */
  _buildB2BProductGrid(products, category) {
    if (!products || products.length === 0) {
      return `<p style="text-align:center;padding:40px;">No products currently available.</p>`;
    }

    const catName = category.name || '';

    return products.map(product => {
      const waText = encodeURIComponent(
        `Hi M.R. Textile, I am a retailer and I want to inquire about wholesale rates for ${product.name}`
      );
      const waUrl = `https://wa.me/919428393320?text=${waText}`;

      const variants = product.variant_images
        ? product.variant_images.split(',').filter(Boolean)
        : [];

      const thumbsHtml = variants.slice(0, 4).map((img, idx) => `
              <button class="product-card__thumb" data-img="../${img}" aria-label="View variant ${idx + 1}">
                <img src="../${img}" alt="${this._esc(product.name)} variant ${idx + 1}" loading="lazy" />
              </button>`).join('');

      // Use CMS-managed specs
      const specsHtml = this._buildSpecsHtml(product.specs);

      return `
          <article class="product-card" data-product-card data-product-name="${this._esc(product.name)}">
            <div class="product-card__image">
              <img src="../${product.main_image}" alt="${this._esc(product.name)}" loading="lazy" width="800" height="1066" />
            </div>
            <div class="product-card__body">
              <span class="product-card__category">${this._esc(catName)}</span>
              <h3 class="product-card__title">${this._esc(product.name)}</h3>
              <p class="product-card__desc">${this._esc(product.description || 'Wholesale bundle pack with superior weave finish, direct from Surat manufacturing center.')}</p>
              ${specsHtml}
              ${thumbsHtml ? `<div class="product-card__thumbs">${thumbsHtml}</div>` : ''}
              <div class="product-card__footer">
                <span class="product-card__moq">Wholesale Pack</span>
                <a href="${waUrl}" target="_blank" rel="noopener" class="btn btn--sm btn--gold">Inquire Rates</a>
              </div>
            </div>
          </article>`;
    }).join('\n');
  }

  /**
   * Build the product-card__specs HTML from a specs array.
   * Handles both parsed arrays (from DB) and JSON strings (fallback).
   * If no specs, renders nothing (empty string).
   */
  _buildSpecsHtml(specs) {
    let arr = specs;
    if (typeof arr === 'string') {
      try { arr = JSON.parse(arr); } catch { arr = []; }
    }
    if (!Array.isArray(arr) || arr.length === 0) return '';

    const items = arr
      .filter(s => s && String(s.key || '').trim() && String(s.value || '').trim())
      .map(s => `
        <div style="display:table-row;">
          <strong style="display:table-cell;padding-right:14px;padding-bottom:3px;white-space:nowrap;font-weight:600;color:inherit;">${this._esc(s.key)}</strong>
          <span style="display:table-cell;padding-bottom:3px;">${this._esc(s.value)}</span>
        </div>`)
      .join('');

    return items
      ? `<div class="product-card__specs" style="display:table;border-spacing:0;margin:8px 0;font-size:0.85em;">${items}</div>`
      : '';
  }

  /**
   * Build an inline search/filter bar for retail category pages.
   * The bar is hidden by default (display:none) and revealed only by the
   * inline JS that follows — so with JS disabled it never appears and the
   * full product grid remains visible unchanged.
   */
  _buildSearchBar(total) {
    return `
    <!-- Product search bar: hidden until JS runs -->
    <div id="mr-search-wrap" style="display:none;margin:0 0 24px;">
      <div style="
        display:flex;align-items:center;gap:12px;flex-wrap:wrap;
        background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);
        border-radius:50px;padding:10px 20px;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" style="opacity:.5;flex-shrink:0">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input id="mr-search-input" type="search" placeholder="Search products…"
          aria-label="Search products in this collection"
          style="
            flex:1;min-width:180px;background:transparent;border:none;
            outline:none;font-size:1rem;color:inherit;font-family:inherit;
          " />
        <span id="mr-search-count" style="font-size:0.82rem;opacity:.55;white-space:nowrap">
          ${total} product${total !== 1 ? 's' : ''}
        </span>
      </div>
      <p id="mr-search-empty" style="
        display:none;text-align:center;padding:40px 0;opacity:.5;font-size:.95rem;
      ">No products matched your search.</p>
    </div>
    <script>
    (function(){
      var wrap  = document.getElementById('mr-search-wrap');
      var input = document.getElementById('mr-search-input');
      var count = document.getElementById('mr-search-count');
      var empty = document.getElementById('mr-search-empty');
      if (!wrap || !input) return;
      wrap.style.display = 'block'; // reveal — we know JS is running

      function getCards() {
        return Array.from(document.querySelectorAll('.product-grid .product-card'));
      }

      function filter() {
        var q    = input.value.trim().toLowerCase();
        var cards = getCards();
        var shown = 0;
        cards.forEach(function(card) {
          var title = (card.getAttribute('data-product-title') || '').toLowerCase();
          var desc  = (card.getAttribute('data-product-desc')  || '').toLowerCase();
          var match = !q || title.indexOf(q) !== -1 || desc.indexOf(q) !== -1;
          card.style.display = match ? '' : 'none';
          if (match) shown++;
        });
        count.textContent = shown + ' product' + (shown !== 1 ? 's' : '');
        empty.style.display = shown === 0 && q ? 'block' : 'none';
      }

      input.addEventListener('input', filter);
      // Place empty-message after grid when it exists
      var grid = document.querySelector('.product-grid');
      if (grid && grid.parentNode) grid.parentNode.insertBefore(empty, grid.nextSibling);
    })();
    <\/script>
`;
  }

  /**
   * Build variant chip buttons for a retail product card.
   * - If the product has only a single "Default" variant → returns '' (cards look unchanged)
   * - Active variants: clickable, update the WA link on click
   * - OOS variants: non-clickable button with title="Currently unavailable"
   * Includes a tiny inline IIFE to wire up the click handlers.
   */
  _buildVariantChips(product, waBase) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    // Skip rendering if it's a single Default variant
    const isDefaultOnly = variants.length === 0 ||
      (variants.length === 1 && variants[0].label === 'Default');
    if (isDefaultOnly) return '';

    const waBtnId = `wa-btn-${product.id}`;
    const productName = this._esc(product.name);

    const chips = variants.map((v, i) => {
      const label  = this._esc(v.label);
      const isOOS  = v.status !== 'active';
      const waText = encodeURIComponent(
        `Hi M.R. Textile, I am interested in ${product.name} (${v.label})`
      );
      const waHref = `https://wa.me/919428393320?text=${waText}`;

      if (isOOS) {
        // Non-clickable, greyed out, tooltip
        return `<button type="button" class="variant-chip variant-chip--oos"
          title="Currently unavailable" aria-disabled="true"
          style="cursor:not-allowed;opacity:0.45;">${label}</button>`;
      }
      return `<button type="button" class="variant-chip${i === 0 ? ' variant-chip--active' : ''}"
        data-wa="${waHref}" aria-pressed="${i === 0}">${label}</button>`;
    }).join('');

    // Set the initial WA link to the first active variant (or base if all OOS)
    const firstActive = variants.find(v => v.status === 'active');
    const initHref = firstActive
      ? `https://wa.me/919428393320?text=${encodeURIComponent(`Hi M.R. Textile, I am interested in ${product.name} (${firstActive.label})`)}`
      : waBase;

    return `
      <div class="product-card__variants">${chips}</div>
      <script>
      (function(){
        var wrap=document.currentScript.previousElementSibling;
        if(!wrap)return;
        var waBtn=document.getElementById('${waBtnId}');
        if(waBtn)waBtn.href='${initHref}';
        var chipEls=wrap.querySelectorAll('.variant-chip:not(.variant-chip--oos)');
        chipEls.forEach(function(c){
          c.addEventListener('click',function(){
            chipEls.forEach(function(x){x.classList.remove('variant-chip--active');x.setAttribute('aria-pressed','false');});
            c.classList.add('variant-chip--active');c.setAttribute('aria-pressed','true');
            if(waBtn)waBtn.href=c.getAttribute('data-wa');
          });
        });
      })();
      <\/script>`;
  }

  _replaceGallery(html, products, category) {
    const masonryPattern = /(<div\s+class="masonry"[^>]*>)([\s\S]*?)(<\/div>\s*\n?\s*<\/div>\s*\n?\s*<\/section>)/;
    if (!masonryPattern.test(html) || !products.length) return html;

    // Use all product main images as gallery items
    const galleryItems = products
      .filter(p => p.main_image)
      .slice(0, 12)
      .map(p => {
        const caption = this._esc(p.name);
        return `
          <button class="masonry__item" data-full="${p.main_image}"
            data-caption="${caption}" data-category="${category.slug}"
            aria-label="Open ${caption} image">
            <img src="${p.main_image}" alt="${caption}" loading="lazy" />
            <span class="masonry__overlay"><span class="masonry__caption">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>${caption}</span></span>
          </button>`;
      }).join('');

    return html.replace(
      masonryPattern,
      `$1\n${galleryItems}\n        </div>\n      </div>\n    </section>`
    );
  }

  _buildSkeleton(category, isB2B) {
    // Minimal HTML skeleton for new categories that don't have an existing file
    const prefix = isB2B ? '../' : '';
    return `<!DOCTYPE html>
<html lang="en-IN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${category.seo_title || category.name}</title>
  <meta name="description" content="${category.seo_description || ''}" />
  <meta name="robots" content="index, follow" />
  <meta name="author" content="M.R. Textile / M.R. Sarees" />
  <link rel="canonical" href="${this.siteUrl}/${category.html_file}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="M.R. Textile / M.R. Sarees" />
  <meta property="og:title" content="${category.seo_title || category.name}" />
  <meta property="og:description" content="${category.seo_description || ''}" />
  <meta property="og:image" content="${this.siteUrl}/${category.hero_image || ''}" />
  <meta property="og:url" content="${this.siteUrl}/${category.html_file}" />
  <meta property="og:locale" content="en_IN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${category.seo_title || category.name}" />
  <meta name="twitter:description" content="${category.seo_description || ''}" />
  <meta name="twitter:image" content="${this.siteUrl}/${category.hero_image || ''}" />
  <link rel="icon" href="${prefix}favicon.ico" sizes="any" />
  <link rel="stylesheet" href="${prefix}css/main.css" />
  <link rel="stylesheet" href="${prefix}css/subcategory.css" />
  <script type="application/ld+json">{}</script>
</head>
<body>
  <section class="category-hero" id="hero"></section>
  <section class="section category-intro" id="intro"></section>
  <section class="section product-showcase" id="showcase">
    <div class="container">
      <div class="section-head section-head--center">
        <p class="eyebrow" style="justify-content:center;">Product Showcase</p>
        <h2>Catalog Collection</h2>
      </div>
      <div class="product-grid"></div>
    </div>
  </section>
  <section class="section" id="gallery">
    <div class="container">
      <div class="masonry" data-gallery-grid data-reveal="fade"></div>
    </div>
  </section>
  <script type="module" src="${prefix}js/main.js"></script>
</body>
</html>`;
  }

  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

module.exports = CategoryPageGenerator;
