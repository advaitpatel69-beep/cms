/**
 * git/GitManager.js - Git Integration
 * M.R. Textile CMS
 */

'use strict';

const { execFile, spawn } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);

class GitManager {
  constructor(websiteRoot, window = null) {
    this.websiteRoot = websiteRoot;
    this.window      = window;
  }

  /** Check if Git is installed and accessible */
  async checkInstalled() {
    try {
      const { stdout } = await execFileAsync('git', ['--version']);
      return { installed: true, version: stdout.trim() };
    } catch {
      return { installed: false, version: null };
    }
  }

  /** Get current git status */
  async status() {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
        cwd: this.websiteRoot,
      });
      const changedFiles = stdout.trim().split('\n').filter(Boolean);
      const { stdout: branch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: this.websiteRoot,
      });
      return {
        clean:        changedFiles.length === 0,
        changedFiles: changedFiles.length,
        branch:       branch.trim(),
        details:      changedFiles,
      };
    } catch (err) {
      return { clean: false, changedFiles: 0, branch: 'unknown', error: err.message };
    }
  }

  /**
   * Full pipeline: git add -> git commit -> git push
   * Streams output to the renderer window.
   */
  async addCommitPush() {
    // Build a safe timestamp - no locale-dependent formatting
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const timestamp = `${pad(now.getDate())}-${months[now.getMonth()]}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const message = `CMS: Published ${timestamp}`;

    try {
      // 1. git add .
      this._sendProgress('git add .', 10);
      await this._exec('git', ['add', '.']);

      // 2. git commit - message is ONE element in the args array, never shell-split
      this._sendProgress('git commit...', 40);
      try {
        await this._exec('git', ['commit', '-m', message]);
      } catch (err) {
        if (!err.message.includes('nothing to commit')) throw err;
        this._sendProgress('Nothing new to commit - files unchanged', 60);
      }

      // 3. git push
      this._sendProgress('git push origin...', 70);
      await this._exec('git', ['push']);

      this._sendProgress('Pushed successfully!', 100);
      return { success: true, message };

    } catch (err) {
      const errMsg = err.message || String(err);
      this._sendProgress(`Git error: ${errMsg}`, 100);
      return { success: false, error: errMsg };
    }
  }

  // --- Private ------------------------------------------------------------------

  /**
   * Run a git command, streaming stdout/stderr to the progress panel.
   * IMPORTANT: shell:false so spaces in commit messages are NOT split into
   * separate arguments (shell:true on Windows causes this bug).
   */
  async _exec(cmd, args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        cwd:         this.websiteRoot,
        shell:       false,       // Must be false - shell:true splits spaces in args
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const line = data.toString();
        stdout += line;
        this._sendProgress(line.trim(), null);
      });

      proc.stderr.on('data', (data) => {
        const line = data.toString();
        stderr += line;
        // Git writes normal info (warnings, branch info) to stderr too
        this._sendProgress(line.trim(), null);
      });

      proc.on('close', (code) => {
        if (code === 0 || (code === 1 && stdout.includes('nothing to commit'))) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(stderr.trim() || stdout.trim() || `git exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        if (err.code === 'ENOENT') {
          reject(new Error('git not found. Install Git and ensure it is in your PATH.'));
        } else {
          reject(err);
        }
      });
    });
  }

  _sendProgress(message, percent) {
    if (!message) return;
    console.log(`[Git] ${message}`);
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('progress', {
        type:    'git',
        message: message.substring(0, 200),
        percent,
      });
    }
  }
}

module.exports = GitManager;
