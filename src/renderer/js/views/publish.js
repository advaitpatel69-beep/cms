/**
 * views/publish.js — Publish Website View
 */

export async function renderPublish(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title-group">
        <h1 class="page-title">Publish Website</h1>
        <p class="page-subtitle">Generate static files and deploy to GitHub Pages</p>
      </div>
    </div>

    <div class="page-content" style="max-width:800px;">

      <!-- Steps -->
      <div class="card mb-3">
        <div class="card-body">
          <p style="font-size:.85rem;color:var(--clr-text-2);margin-bottom:18px;">
            Clicking <strong>Publish Website</strong> will perform these steps automatically:
          </p>
          <div style="display:grid;gap:10px;">
            ${[
              ['Validate', 'Check all products, images, and links'],
              ['Generate', 'Regenerate all category HTML pages from database'],
              ['Data', 'Write products.json, categories.json, gallery.json'],
              ['Sitemap', 'Regenerate sitemap.xml with all pages'],
              ['Git Add', 'Stage all changed files'],
              ['Git Commit', 'Commit with timestamp message'],
              ['Git Push', 'Push to GitHub Pages — live in ~1 minute'],
            ].map(([step, desc], i) => `
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:24px;height:24px;border-radius:50%;background:var(--clr-surface-3);border:1px solid var(--clr-border);display:flex;align-items:center;justify-content:center;font-size:.72rem;color:var(--clr-text-3);flex-shrink:0;">${i+1}</div>
                <div>
                  <strong style="font-size:.83rem;color:var(--clr-text);">${step}</strong>
                  <span style="font-size:.8rem;color:var(--clr-text-3);margin-left:8px;">${desc}</span>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Convert existing images option -->
      <div class="card mb-3">
        <div class="card-header"><span class="card-title">Image Optimization</span></div>
        <div class="card-body">
          <label class="form-toggle">
            <input type="checkbox" id="convert-existing" />
            <span class="toggle-track"></span>
            <span class="toggle-label">Also convert all existing images to WebP / AVIF (first run — may take several minutes)</span>
          </label>
          <p class="form-hint mt-1">This only needs to run once. Subsequent publishes will be fast.</p>
        </div>
      </div>

      <!-- Publish Button -->
      <button id="publish-btn" class="publish-btn-big">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
        Publish Website
      </button>

      <!-- Progress -->
      <div id="publish-progress" class="hidden mt-3">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Publishing...</span>
            <span id="pub-percent" style="font-size:.82rem;color:var(--clr-text-3);">0%</span>
          </div>
          <div class="card-body" style="padding-bottom:0;">
            <div class="progress-wrap mb-3">
              <div class="progress-bar" id="pub-bar" style="width:0%"></div>
            </div>
            <div class="publish-console" id="pub-console">
              <div class="log-line info">[CMS] Starting publish pipeline...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Result -->
      <div id="publish-result" class="hidden mt-3">
        <div class="card" id="result-card">
          <div class="card-body" id="result-body"></div>
        </div>
      </div>
    </div>
  `;

  const publishBtn   = container.querySelector('#publish-btn');
  const progressDiv  = container.querySelector('#publish-progress');
  const resultDiv    = container.querySelector('#publish-result');
  const console_el   = container.querySelector('#pub-console');
  const barEl        = container.querySelector('#pub-bar');
  const percentEl    = container.querySelector('#pub-percent');

  function log(message, type = '') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    console_el.appendChild(line);
    console_el.scrollTop = console_el.scrollHeight;
  }

  function setProgress(percent, message) {
    if (percent !== null) {
      barEl.style.width    = `${percent}%`;
      percentEl.textContent = `${percent}%`;
    }
    if (message) log(message);
  }

  // Listen for progress events
  const progressHandler = (e) => {
    const d = e.detail;
    if (d.type === 'publish' || d.type === 'generate' || d.type === 'git') {
      setProgress(d.percent || null, d.message || '');
    }
    if (d.type === 'image_convert') {
      log(`Converting images: ${d.current}/${d.total} — ${d.file}`);
    }
  };
  window.addEventListener('cms-progress', progressHandler);

  publishBtn.onclick = async () => {
    publishBtn.disabled  = true;
    progressDiv.classList.remove('hidden');
    resultDiv.classList.add('hidden');
    console_el.innerHTML = '<div class="log-line info">[CMS] Starting publish pipeline...</div>';
    barEl.style.width    = '0%';

    try {
      // Optional: convert existing images first
      const convertExisting = container.querySelector('#convert-existing').checked;
      if (convertExisting) {
        log('Converting all existing images to WebP/AVIF...');
        const convRes = await window.cms.publish.convertExistingImages();
        if (convRes.ok) {
          log(`Image conversion complete: ${convRes.data.converted} converted, ${convRes.data.failed} failed`);
        }
      }

      log('Running publish pipeline...');
      const res = await window.cms.publish.run();

      window.removeEventListener('cms-progress', progressHandler);

      if (res.ok && res.data?.success) {
        setProgress(100, 'Publish complete!');
        const errors = res.data.errors || [];
        container.querySelector('#result-body').innerHTML = `
          <div style="text-align:center;padding:10px 0;">
            <div style="font-size:2rem;margin-bottom:8px;">🚀</div>
            <h3 style="color:var(--clr-success);font-size:1.1rem;margin-bottom:6px;">Published Successfully!</h3>
            <p style="font-size:.85rem;color:var(--clr-text-2);">${res.data.data?.summary || ''}</p>
            ${errors.length ? `<div style="margin-top:12px;font-size:.78rem;color:var(--clr-warning);">${errors.slice(0,5).map(e => `<div>⚠ ${e}</div>`).join('')}</div>` : ''}
            <p style="margin-top:14px;font-size:.78rem;color:var(--clr-text-3);">Your website will be live on GitHub Pages within ~60 seconds.</p>
          </div>
        `;
        resultDiv.classList.remove('hidden');
        window.Toast.success('Website published successfully!');
      } else {
        const errMsg = res.error || res.data?.summary || 'Unknown error';
        setProgress(100, `ERROR: ${errMsg}`);
        container.querySelector('#result-body').innerHTML = `
          <div style="color:var(--clr-error);">
            <strong>Publish failed:</strong> ${errMsg}
          </div>
        `;
        resultDiv.classList.remove('hidden');
        window.Toast.error(`Publish failed: ${errMsg}`);
      }
    } catch (err) {
      log(`Fatal error: ${err.message}`, 'error');
      window.Toast.error(`Publish error: ${err.message}`);
    }

    publishBtn.disabled = false;
  };
}
