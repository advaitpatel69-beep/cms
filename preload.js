/**
 * preload.js — Secure IPC Bridge
 * M.R. Textile CMS
 *
 * Exposes a safe `window.cms` API to the renderer process.
 * The renderer never gets access to Node.js or Electron APIs directly.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Helper: invoke an IPC channel and unwrap the result.
 * Always returns { ok, data?, error? }
 */
function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args);
}

/**
 * Listen to progress events from the main process (for publish/git)
 */
function onProgress(callback) {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on('progress', handler);
  return () => ipcRenderer.removeListener('progress', handler);
}

contextBridge.exposeInMainWorld('cms', {
  // Auth
  auth: {
    login:  (password)         => invoke('auth:login', password),
    logout: ()                 => invoke('auth:logout'),
    check:  ()                 => invoke('auth:check'),
  },

  // Products
  products: {
    list:           (filters)          => invoke('products:list', filters),
    get:            (id)               => invoke('products:get', id),
    create:         (data)             => invoke('products:create', data),
    update:         (id, data)         => invoke('products:update', id, data),
    delete:         (id)               => invoke('products:delete', id),
    bulkStatus:     (ids, status)      => invoke('products:bulk-status', ids, status),
    getImages:      (id)               => invoke('products:get-images', id),
    importExisting: ()                 => invoke('products:import-existing'),
  },

  // Categories
  categories: {
    list:   ()          => invoke('categories:list'),
    get:    (id)        => invoke('categories:get', id),
    create: (data)      => invoke('categories:create', data),
    update: (id, data)  => invoke('categories:update', id, data),
    delete: (id)        => invoke('categories:delete', id),
  },

  // Stock Manager
  stock: {
    list:       (categoryId)      => invoke('stock:list', categoryId),
    bulkUpdate: (ids, status)     => invoke('stock:bulk-update', ids, status),
  },

  // Homepage
  homepage: {
    get:    ()      => invoke('homepage:get'),
    update: (data)  => invoke('homepage:update', data),
  },

  // Gallery
  gallery: {
    list:    ()                                  => invoke('gallery:list'),
    add:     (path, caption, category, alt)      => invoke('gallery:add', path, caption, category, alt),
    delete:  (id)                                => invoke('gallery:delete', id),
    reorder: (orderedIds)                        => invoke('gallery:reorder', orderedIds),
  },

  // Business Info
  businessInfo: {
    get:    ()      => invoke('business-info:get'),
    update: (data)  => invoke('business-info:update', data),
  },

  // SEO
  seo: {
    list:   ()               => invoke('seo:list'),
    get:    (pageKey)        => invoke('seo:get', pageKey),
    update: (pageKey, data)  => invoke('seo:update', pageKey, data),
  },

  // Media Library
  media: {
    list:       (filter)    => invoke('media:list', filter),
    openFolder: (filePath)  => invoke('media:open-folder', filePath),
    delete:     (webPath)   => invoke('media:delete', webPath),
  },

  // Publish
  publish: {
    run:                    ()    => invoke('publish:run'),
    convertExistingImages:  ()    => invoke('publish:convert-existing-images'),
  },

  // Git
  git: {
    status:  ()   => invoke('git:status'),
    push:    ()   => invoke('git:push'),
    check:   ()   => invoke('git:check'),
  },

  // Backup
  backup: {
    create:   ()          => invoke('backup:create'),
    list:     ()          => invoke('backup:list'),
    restore:  (filename)  => invoke('backup:restore', filename),
  },

  // Settings
  settings: {
    getAll:         ()                => invoke('settings:get-all'),
    set:            (key, value)      => invoke('settings:set', key, value),
    changePassword: (cur, next)       => invoke('settings:change-password', cur, next),
  },

  // Activity Log
  activity: {
    recent: (limit) => invoke('activity:recent', limit),
  },

  // Dashboard
  dashboard: {
    stats: () => invoke('dashboard:stats'),
  },

  // Native dialogs
  dialog: {
    openImage:  ()    => invoke('dialog:open-image'),
    openBackup: ()    => invoke('dialog:open-backup'),
  },

  // Shell
  shell: {
    openUrl: (url) => invoke('shell:open-url', url),
  },

  // App paths
  app: {
    getPaths: () => invoke('app:get-paths'),
  },

  // Progress event listener
  onProgress,
});
