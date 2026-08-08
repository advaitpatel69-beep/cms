/**
 * main.js — Electron Main Process
 * M.R. Textile CMS
 *
 * Responsibilities:
 *  - Create and manage the browser window
 *  - Register all IPC handlers
 *  - Initialize the database
 *  - Run startup checks (auto-archive, git detection)
 */

'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Fix Electron cache errors on OneDrive ─────────────────────────────────────
// The CMS lives on OneDrive which causes "Access is denied" errors when Electron
// tries to write Chromium GPU/disk cache files. Redirect userData to a local path.
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
app.setPath('userData', path.join(localAppData, 'MRTextileCMS'));
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// ─── Path Constants ────────────────────────────────────────────────────────────
const IS_DEV = process.argv.includes('--dev');

// ── Data directory: dev vs packaged ──────────────────────────────────────────
// In dev (npm start), keep data/ next to the source files as before.
// When packaged, write to userData (AppData\Local\MRTextileCMS\data) so the
// database survives reinstalls and is not trapped inside a read-only install dir.
const DATA_DIR = app.isPackaged
  ? path.join(app.getPath('userData'), 'data')
  : path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'cms.db');

// Website root — the sibling github-pages folder (default fallback only).
// In production the user sets this via CMS Settings; this constant is only used
// as the initial seed value and as a dev-mode fallback.
const WEBSITE_ROOT = path.resolve(__dirname, '..', 'github-pages');

// Ensure data directory and backups subdir exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.join(DATA_DIR, 'backups'))) {
  fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
}

// ── Auto-migrate existing DB on first packaged launch ────────────────────────
// If running packaged and the userData DB doesn't exist yet, copy the dev DB
// (if present) so the user doesn't lose their data on first install.
if (app.isPackaged && !fs.existsSync(DB_PATH)) {
  const devDbPath = path.join(path.dirname(app.getAppPath()), 'data', 'cms.db');
  if (fs.existsSync(devDbPath)) {
    fs.copyFileSync(devDbPath, DB_PATH);
    console.log('[CMS] Migrated existing database from dev location to userData.');
  }
}

// ─── Module Imports (lazy, after path setup) ───────────────────────────────────
const { initDatabase }        = require('./src/main/database/db');
const { runMigrations }       = require('./src/main/database/schema');
const ProductModel            = require('./src/main/database/models/Product');
const CategoryModel           = require('./src/main/database/models/Category');
const BusinessInfoModel       = require('./src/main/database/models/BusinessInfo');
const GalleryModel            = require('./src/main/database/models/Gallery');
const PageSEOModel            = require('./src/main/database/models/PageSEO');
const SettingsModel           = require('./src/main/database/models/Settings');
const ActivityModel           = require('./src/main/database/models/Activity');
const ImageProcessor          = require('./src/main/image/ImageProcessor');
const ImageNaming             = require('./src/main/image/ImageNaming');
const SiteGenerator           = require('./src/main/generator/SiteGenerator');
const GitManager              = require('./src/main/git/GitManager');
const PublishService          = require('./src/main/services/PublishService');
const AutoArchiveService      = require('./src/main/services/AutoArchiveService');
const BackupService           = require('./src/main/services/BackupService');
const ImportService           = require('./src/main/services/ImportService');

// ─── State ─────────────────────────────────────────────────────────────────────
let mainWindow = null;
let db         = null;
let isLoggedIn = false;

// ─── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'M.R. Textile CMS',
    backgroundColor: '#0f0f13',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, 'src', 'renderer', 'assets', 'icon.png'),
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  // Pipe all renderer console messages to the terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const lvl = ['verbose', 'info', 'warning', 'error'][level] || 'info';
    const src = sourceId ? sourceId.split('/').pop() : '';
    console.log(`[RENDERER:${lvl.toUpperCase()}] ${message}${src ? ` (${src}:${line})` : ''}`);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    // 1. Init database
    db = initDatabase(DB_PATH);
    runMigrations(db);

    // 2. Seed default settings if first run
    // NOTE: seedDefaults only writes a value if the key doesn't already exist,
    // so this is safe to call on every launch — it won't overwrite user changes.
    const settings = new SettingsModel(db);
    settings.seedDefaults({
      websiteRoot:     WEBSITE_ROOT,          // user can override in Settings UI
      siteUrl:         'https://mrtextile.online',
      defaultPassword: '12345678',
    });

    // 3. Check auto-archive on startup
    const autoArchive = new AutoArchiveService(db);
    autoArchive.checkAndArchive();

    console.log('[CMS] Database initialized successfully at:', DB_PATH);
  } catch (err) {
    console.error('[CMS] STARTUP ERROR — database failed to initialize:', err);
    // Continue anyway — show window so user can see DevTools
  }

  // 4. Create window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC Helpers ───────────────────────────────────────────────────────────────
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      console.error(`[IPC:${channel}]`, err);
      return { ok: false, error: err.message };
    }
  });
}

function handleAuth(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isLoggedIn) return { ok: false, error: 'Not authenticated' };
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      console.error(`[IPC:${channel}]`, err);
      return { ok: false, error: err.message };
    }
  });
}

// ─── Auth Handlers ─────────────────────────────────────────────────────────────
handle('auth:login', (password) => {
  const settings = new SettingsModel(db);
  const stored = settings.get('adminPassword') || '12345678';
  if (password === stored) {
    isLoggedIn = true;
    const activity = new ActivityModel(db);
    activity.log('login', null, null, 'Administrator logged in');
    return { success: true };
  }
  return { success: false };
});

handle('auth:logout', () => {
  isLoggedIn = false;
  return true;
});

handle('auth:check', () => isLoggedIn);

// ─── Image path helper ────────────────────────────────────────────────────────
// Converts relative web paths (e.g. "images/sarees/...") to file:// absolute
// paths so they render correctly inside the Electron CMS renderer window.
function toFileUrl(relPath, websiteRoot) {
  if (!relPath || relPath.startsWith('file://')) return relPath || '';
  const root = (websiteRoot || WEBSITE_ROOT).replace(/\\/g, '/');
  return `file:///${root}/${relPath}`;
}

function prefixProductImages(product, websiteRoot) {
  if (!product) return product;
  return {
    ...product,
    main_image: toFileUrl(product.main_image, websiteRoot),
  };
}

// ─── Product Handlers ──────────────────────────────────────────────────────────
handleAuth('products:list', (filters = {}) => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const model       = new ProductModel(db);
  return model.list(filters).map(p => prefixProductImages(p, websiteRoot));
});

handleAuth('products:get', (id) => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const model       = new ProductModel(db);
  return prefixProductImages(model.getById(id), websiteRoot);
});

handleAuth('products:create', async (data) => {
  const settings = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const processor = new ImageProcessor(websiteRoot);
  const naming    = new ImageNaming(db, websiteRoot);
  const model     = new ProductModel(db);
  const activity  = new ActivityModel(db);

  // Auto-assign product code
  if (!data.productCode) {
    data.productCode = naming.nextCode(data.categoryId);
  }

  // Process main image
  if (data.mainImagePath) {
    const result = await processor.processProductImage(
      data.mainImagePath, data.categorySlug, data.productCode, 0
    );
    data.mainImage = result.webPath;
  }

  // Process variant images
  const variantPaths = [];
  if (data.variantImagePaths && data.variantImagePaths.length) {
    for (let i = 0; i < data.variantImagePaths.length; i++) {
      const result = await processor.processProductImage(
        data.variantImagePaths[i], data.categorySlug, data.productCode, i + 1
      );
      variantPaths.push(result.webPath);
    }
  }

  const product = model.create(data);
  // Save variant images
  if (variantPaths.length) {
    model.setImages(product.id, variantPaths);
  }

  // Save any new spec key names for autocomplete
  if (Array.isArray(data.specs)) {
    const insert = db.prepare('INSERT OR IGNORE INTO spec_keys (key) VALUES (?)');
    data.specs.filter(s => s && String(s.key || '').trim())
              .forEach(s => insert.run(String(s.key).trim()));
  }

  activity.log('product_created', 'product', product.id, `Created: ${data.name}`);
  return product;
});

handleAuth('products:update', async (id, data) => {
  const settings = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const processor = new ImageProcessor(websiteRoot);
  const model    = new ProductModel(db);
  const activity = new ActivityModel(db);

  // Process new main image if provided
  if (data.mainImagePath) {
    const existing = model.getById(id);
    const result = await processor.processProductImage(
      data.mainImagePath, data.categorySlug, existing.product_code, 0
    );
    data.mainImage = result.webPath;
  }

  // Process new variant images
  if (data.variantImagePaths && data.variantImagePaths.length) {
    const existing = model.getById(id);
    const variantPaths = [];
    for (let i = 0; i < data.variantImagePaths.length; i++) {
      const result = await processor.processProductImage(
        data.variantImagePaths[i], data.categorySlug, existing.product_code, i + 1
      );
      variantPaths.push(result.webPath);
    }
    model.setImages(id, variantPaths);
  }

  const product = model.update(id, data);

  // Save any new spec key names for autocomplete
  if (Array.isArray(data.specs)) {
    const insert = db.prepare('INSERT OR IGNORE INTO spec_keys (key) VALUES (?)');
    data.specs.filter(s => s && String(s.key || '').trim())
              .forEach(s => insert.run(String(s.key).trim()));
  }

  activity.log('product_updated', 'product', id, `Updated: ${data.name || id}`);
  return product;
});

handleAuth('products:delete', (id) => {
  const model    = new ProductModel(db);
  const activity = new ActivityModel(db);
  const product  = model.getById(id);
  model.delete(id);
  activity.log('product_deleted', 'product', id, `Deleted: ${product?.name}`);
  return true;
});

// Return all previously used spec key names (for autocomplete dropdown)
handleAuth('products:spec-keys', () => {
  try {
    return db.prepare('SELECT key FROM spec_keys ORDER BY key ASC').all().map(r => r.key);
  } catch {
    return []; // spec_keys table not yet created (pre-v2)
  }
});

handleAuth('products:bulk-status', (ids, status) => {
  const model    = new ProductModel(db);
  const activity = new ActivityModel(db);
  model.bulkUpdateStatus(ids, status);
  activity.log('bulk_status', 'product', null, `Set ${ids.length} products to: ${status}`);
  return true;
});

handleAuth('products:get-images', (id) => {
  const model = new ProductModel(db);
  return model.getImages(id);
});

handleAuth('products:import-existing', async () => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const importer    = new ImportService(db, websiteRoot);
  const activity    = new ActivityModel(db);
  const result      = await importer.importExisting();
  activity.log('import', null, null, `Imported ${result.imported} products`);
  return result;
});

// ─── Category Handlers ─────────────────────────────────────────────────────────
handleAuth('categories:list', () => {
  const model = new CategoryModel(db);
  return model.list();
});

handleAuth('categories:get', (id) => {
  const model = new CategoryModel(db);
  return model.getById(id);
});

handleAuth('categories:create', (data) => {
  const model    = new CategoryModel(db);
  const activity = new ActivityModel(db);
  const cat      = model.create(data);
  activity.log('category_created', 'category', cat.id, `Created: ${data.name}`);
  return cat;
});

handleAuth('categories:update', (id, data) => {
  const model    = new CategoryModel(db);
  const activity = new ActivityModel(db);
  const cat      = model.update(id, data);
  activity.log('category_updated', 'category', id, `Updated: ${data.name || id}`);
  return cat;
});

handleAuth('categories:delete', (id) => {
  const model    = new CategoryModel(db);
  const activity = new ActivityModel(db);
  model.delete(id);
  activity.log('category_deleted', 'category', id, `Deleted category ${id}`);
  return true;
});

// ─── Stock Handlers ────────────────────────────────────────────────────────────
handleAuth('stock:list', (categoryId) => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const model       = new ProductModel(db);
  const products    = model.listForStock(categoryId);

  // Prefix main_image with file:// so it renders in the Electron CMS window
  return products.map(p => ({
    ...p,
    main_image: p.main_image
      ? `file:///${websiteRoot.replace(/\\/g, '/')}/${p.main_image}`
      : '',
  }));
});


handleAuth('stock:bulk-update', (ids, status) => {
  const model    = new ProductModel(db);
  const activity = new ActivityModel(db);
  model.bulkUpdateStatus(ids, status);
  activity.log('stock_update', null, null, `${ids.length} products → ${status}`);
  return true;
});

// ─── Homepage Handlers ─────────────────────────────────────────────────────────
handleAuth('homepage:get', () => {
  const model = new SettingsModel(db);
  const raw   = model.get('homepageConfig');
  return raw ? JSON.parse(raw) : {};
});

handleAuth('homepage:update', (data) => {
  const model    = new SettingsModel(db);
  const activity = new ActivityModel(db);
  model.set('homepageConfig', JSON.stringify(data));
  activity.log('homepage_updated', null, null, 'Homepage config updated');
  return true;
});

// ─── Gallery Handlers ──────────────────────────────────────────────────────────
handleAuth('gallery:list', () => {
  const model = new GalleryModel(db);
  return model.list();
});

handleAuth('gallery:add', async (imagePath, caption, category, altText) => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const processor   = new ImageProcessor(websiteRoot);
  const model       = new GalleryModel(db);
  const activity    = new ActivityModel(db);

  const result = await processor.processGalleryImage(imagePath);
  const item   = model.add(result.webPath, caption, category, altText);
  activity.log('gallery_add', 'gallery', item.id, `Added gallery: ${caption}`);
  return item;
});

handleAuth('gallery:delete', (id) => {
  const model    = new GalleryModel(db);
  const activity = new ActivityModel(db);
  model.delete(id);
  activity.log('gallery_delete', 'gallery', id, 'Gallery item deleted');
  return true;
});

handleAuth('gallery:reorder', (orderedIds) => {
  const model = new GalleryModel(db);
  model.reorder(orderedIds);
  return true;
});

// ─── Business Info Handlers ────────────────────────────────────────────────────
handleAuth('business-info:get', () => {
  const model = new BusinessInfoModel(db);
  return model.get();
});

handleAuth('business-info:update', (data) => {
  const model    = new BusinessInfoModel(db);
  const activity = new ActivityModel(db);
  model.update(data);
  activity.log('business_info_updated', null, null, 'Business info updated');
  return true;
});

// ─── SEO Handlers ─────────────────────────────────────────────────────────────
handleAuth('seo:list', () => {
  const model = new PageSEOModel(db);
  return model.list();
});

handleAuth('seo:get', (pageKey) => {
  const model = new PageSEOModel(db);
  return model.getByKey(pageKey);
});

handleAuth('seo:update', (pageKey, data) => {
  const model    = new PageSEOModel(db);
  const activity = new ActivityModel(db);
  model.upsert(pageKey, data);
  activity.log('seo_updated', null, null, `SEO updated: ${pageKey}`);
  return true;
});

// ─── Media Handlers ────────────────────────────────────────────────────────────
handleAuth('media:list', (filter = {}) => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const imagesDir   = path.join(websiteRoot, 'images');
  const files = [];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        scanDir(full);
      } else if (/\.(jpg|jpeg|png|webp|avif)$/i.test(file)) {
        files.push({
          name: file,
          path: full,
          webPath: full.replace(websiteRoot, '').replace(/\\/g, '/'),
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
    });
  }

  scanDir(imagesDir);
  return files;
});

handleAuth('media:open-folder', (filePath) => {
  shell.showItemInFolder(filePath);
  return true;
});

handleAuth('media:delete', (webPath) => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const fullPath    = path.join(websiteRoot, webPath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  return true;
});

// ─── Publish Handlers ──────────────────────────────────────────────────────────
handleAuth('publish:run', async () => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const siteUrl     = settings.get('siteUrl') || 'https://mrtextile.online';
  const activity    = new ActivityModel(db);

  const publisher = new PublishService(db, websiteRoot, siteUrl, mainWindow);
  const result    = await publisher.run();

  settings.set('lastPublished', new Date().toISOString());
  activity.log('publish', null, null, `Site published: ${result.summary}`);
  return result;
});

handleAuth('publish:convert-existing-images', async () => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const processor   = new ImageProcessor(websiteRoot);
  return await processor.convertAllExistingImages(mainWindow);
});

// ─── Git Handlers ──────────────────────────────────────────────────────────────
handleAuth('git:status', () => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const git         = new GitManager(websiteRoot);
  return git.status();
});

handleAuth('git:push', async () => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const git         = new GitManager(websiteRoot, mainWindow);
  const activity    = new ActivityModel(db);
  const result      = await git.addCommitPush();
  activity.log('git_push', null, null, `Git push: ${result.success ? 'success' : result.error}`);
  return result;
});

handleAuth('git:check', () => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const git         = new GitManager(websiteRoot);
  return git.checkInstalled();
});

// ─── Backup Handlers ───────────────────────────────────────────────────────────
handleAuth('backup:create', async () => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const backup      = new BackupService(db, DATA_DIR, websiteRoot);
  const activity    = new ActivityModel(db);
  const result      = await backup.create();
  activity.log('backup', null, null, `Backup created: ${result.filename}`);
  return result;
});

handleAuth('backup:list', () => {
  // Use Settings-stored websiteRoot so this works correctly when packaged
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const backup      = new BackupService(db, DATA_DIR, websiteRoot);
  return backup.list();
});

handleAuth('backup:restore', async (filename) => {
  const settings    = new SettingsModel(db);
  const websiteRoot = settings.get('websiteRoot') || WEBSITE_ROOT;
  const backup      = new BackupService(db, DATA_DIR, websiteRoot);
  return await backup.restore(filename);
});

// ─── Settings Handlers ─────────────────────────────────────────────────────────
handleAuth('settings:get-all', () => {
  const model = new SettingsModel(db);
  return model.getAll();
});

handleAuth('settings:set', (key, value) => {
  const model = new SettingsModel(db);
  model.set(key, value);
  return true;
});

handleAuth('settings:change-password', (current, newPass) => {
  const model  = new SettingsModel(db);
  const stored = model.get('adminPassword') || '12345678';
  if (current !== stored) throw new Error('Current password incorrect');
  model.set('adminPassword', newPass);
  return true;
});

// ─── Activity Handlers ─────────────────────────────────────────────────────────
handleAuth('activity:recent', (limit = 20) => {
  const model = new ActivityModel(db);
  return model.recent(limit);
});

// ─── Dashboard Handler ─────────────────────────────────────────────────────────
handleAuth('dashboard:stats', () => {
  const products   = new ProductModel(db);
  const categories = new CategoryModel(db);
  const settings   = new SettingsModel(db);
  const activity   = new ActivityModel(db);
  const settings2  = new SettingsModel(db);

  return {
    totalProducts:    products.count({ status: 'active' }) + products.count({ status: 'out_of_stock' }),
    inStock:          products.count({ status: 'active' }),
    outOfStock:       products.count({ status: 'out_of_stock' }),
    archived:         products.count({ status: 'archived' }),
    totalCategories:  categories.count(),
    lastPublished:    settings2.get('lastPublished') || null,
    recentActivity:   activity.recent(5),
  };
});

// ─── File Dialog Handler ───────────────────────────────────────────────────────
handle('dialog:open-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Image',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    properties: ['openFile', 'multiSelections'],
  });
  return result.canceled ? [] : result.filePaths;
});

handle('dialog:open-backup', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Backup File',
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

handle('shell:open-url', (url) => {
  shell.openExternal(url);
  return true;
});

handle('app:get-paths', () => {
  // Return the live Settings value, not the compile-time constant, so the
  // renderer always shows the correct path after the user changes it in Settings.
  const settings    = new SettingsModel(db);
  const websiteRoot = (db ? settings.get('websiteRoot') : null) || WEBSITE_ROOT;
  return { websiteRoot, dataDir: DATA_DIR };
});
