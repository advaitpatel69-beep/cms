/**
 * database/db.js — SQLite Connection Singleton
 * M.R. Textile CMS
 */

'use strict';

const Database = require('better-sqlite3');

let _db = null;

/**
 * Initialize (or return existing) database connection.
 * @param {string} dbPath - Absolute path to the .db file
 * @returns {Database.Database}
 */
function initDatabase(dbPath) {
  if (_db) return _db;

  _db = new Database(dbPath, {
    // verbose: console.log,  // Uncomment for query debugging
  });

  // Performance pragmas
  _db.pragma('journal_mode = WAL');   // Write-Ahead Logging for concurrency
  _db.pragma('foreign_keys = ON');    // Enforce FK constraints
  _db.pragma('synchronous = NORMAL'); // Balance safety and speed

  return _db;
}

/**
 * Get the existing db connection (must call initDatabase first).
 * @returns {Database.Database}
 */
function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

module.exports = { initDatabase, getDb };
