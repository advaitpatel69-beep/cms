/**
 * views/business-info.js — Business Information Editor
 */

import { escHtml } from './helpers.js';

export async function renderBusinessInfo(container) {
  const res  = await window.cms.businessInfo.get();
  const info = res.ok ? res.data : {};

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Business Information</h1>
      <p class="page-subtitle">This data is used across all website pages automatically</p>
    </div>
    <div class="page-content" style="max-width:760px;">
      <form id="biz-form">
        <div class="card mb-3">
          <div class="card-header"><span class="card-title">Business Details</span></div>
          <div class="card-body">
            <div class="form-group"><label class="form-label">Business Name</label>
              <input id="b-name" class="form-input" value="${escHtml(info.business_name || '')}" /></div>
            <div class="form-grid-2">
              <div class="form-group"><label class="form-label">Primary Phone</label>
                <input id="b-phone1" class="form-input" value="${escHtml(info.phone_primary || '')}" /></div>
              <div class="form-group"><label class="form-label">Secondary Phone</label>
                <input id="b-phone2" class="form-input" value="${escHtml(info.phone_secondary || '')}" /></div>
            </div>
            <div class="form-grid-2">
              <div class="form-group"><label class="form-label">WhatsApp Number (with country code, no +)</label>
                <input id="b-wa" class="form-input" placeholder="919428393320" value="${escHtml(info.whatsapp || '')}" /></div>
              <div class="form-group"><label class="form-label">Email</label>
                <input id="b-email" class="form-input" type="email" value="${escHtml(info.email || '')}" /></div>
            </div>
            <div class="form-group"><label class="form-label">GST Number</label>
              <input id="b-gst" class="form-input" value="${escHtml(info.gst || '')}" /></div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header"><span class="card-title">Address</span></div>
          <div class="card-body">
            <div class="form-group"><label class="form-label">Street Address</label>
              <input id="b-street" class="form-input" value="${escHtml(info.address_street || '')}" /></div>
            <div class="form-grid-3">
              <div class="form-group"><label class="form-label">City</label>
                <input id="b-city" class="form-input" value="${escHtml(info.address_city || 'Surat')}" /></div>
              <div class="form-group"><label class="form-label">State</label>
                <input id="b-state" class="form-input" value="${escHtml(info.address_state || 'Gujarat')}" /></div>
              <div class="form-group"><label class="form-label">Postal Code</label>
                <input id="b-postal" class="form-input" value="${escHtml(info.address_postal || '')}" /></div>
            </div>
            <div class="form-group"><label class="form-label">Google Maps Link</label>
              <input id="b-maps" class="form-input" type="url" value="${escHtml(info.maps_link || '')}" /></div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header"><span class="card-title">Business Hours</span></div>
          <div class="card-body">
            <div class="form-grid-2">
              <div class="form-group"><label class="form-label">Weekday Open</label>
                <input id="b-open" class="form-input" type="time" value="${escHtml(info.hours_weekday_open || '10:00')}" /></div>
              <div class="form-group"><label class="form-label">Weekday Close</label>
                <input id="b-close" class="form-input" type="time" value="${escHtml(info.hours_weekday_close || '20:00')}" /></div>
            </div>
            <div class="form-group"><label class="form-label">Closed Days</label>
              <input id="b-closed" class="form-input" placeholder="e.g. Sunday" value="${escHtml(info.hours_closed_days || 'Sunday')}" /></div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header"><span class="card-title">Social Media</span></div>
          <div class="card-body">
            <div class="form-group"><label class="form-label">Instagram URL</label>
              <input id="b-ig" class="form-input" type="url" value="${escHtml(info.instagram || '')}" /></div>
            <div class="form-group"><label class="form-label">Facebook URL</label>
              <input id="b-fb" class="form-input" type="url" value="${escHtml(info.facebook || '')}" /></div>
            <div class="form-group"><label class="form-label">YouTube URL</label>
              <input id="b-yt" class="form-input" type="url" value="${escHtml(info.youtube || '')}" /></div>
          </div>
        </div>

        <button type="submit" class="btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
          Save Business Information
        </button>
      </form>
    </div>
  `;

  container.querySelector('#biz-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const g = id => document.getElementById(id)?.value.trim() || '';
    const res = await window.cms.businessInfo.update({
      businessName:       g('b-name'),
      addressStreet:      g('b-street'),
      addressCity:        g('b-city'),
      addressState:       g('b-state'),
      addressPostal:      g('b-postal'),
      addressCountry:     'IN',
      phonePrimary:       g('b-phone1'),
      phoneSecondary:     g('b-phone2'),
      whatsapp:           g('b-wa'),
      email:              g('b-email'),
      gst:                g('b-gst'),
      mapsLink:           g('b-maps'),
      hoursWeekdayOpen:   g('b-open'),
      hoursWeekdayClose:  g('b-close'),
      hoursClosedDays:    g('b-closed'),
      instagram:          g('b-ig'),
      facebook:           g('b-fb'),
      youtube:            g('b-yt'),
    });
    if (res.ok) window.Toast.success('Business information saved!');
    else window.Toast.error(`Failed: ${res.error}`);
  });
}
