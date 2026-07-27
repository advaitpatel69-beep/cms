/**
 * services/PublishService.js — Full Publish Pipeline
 * M.R. Textile CMS
 */

'use strict';

const SiteGenerator  = require('../generator/SiteGenerator');
const ImageProcessor = require('../image/ImageProcessor');
const GitManager     = require('../git/GitManager');

class PublishService {
  constructor(db, websiteRoot, siteUrl, window = null) {
    this.db          = db;
    this.websiteRoot = websiteRoot;
    this.siteUrl     = siteUrl;
    this.window      = window;
  }

  async run() {
    const errors = [];

    // Step 1: Generate static files
    this._progress('Generating website files...', 5);
    const generator = new SiteGenerator(this.db, this.websiteRoot, this.siteUrl, this.window);
    const genResult = await generator.run();

    if (!genResult.success) {
      return { success: false, summary: genResult.summary, errors: genResult.errors };
    }
    errors.push(...(genResult.errors || []));

    // Step 2: Git add + commit + push
    this._progress('Pushing to GitHub Pages...', 85);
    const git       = new GitManager(this.websiteRoot, this.window);
    const gitResult = await git.addCommitPush();

    if (!gitResult.success) {
      errors.push(`Git push failed: ${gitResult.error}`);
      return {
        success: false,
        summary: `Generation succeeded but Git push failed: ${gitResult.error}`,
        errors,
      };
    }

    this._progress('Published!', 100);
    return {
      success: true,
      summary: genResult.summary,
      errors,
    };
  }

  _progress(message, percent) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('progress', {
        type: 'publish', message, percent,
      });
    }
  }
}

module.exports = PublishService;
