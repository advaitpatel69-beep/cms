/**
 * components/modal.js — Modal Dialog Component
 */

export const Modal = {
  show({ title, body, footer, size = 'md', onClose } = {}) {
    const overlay  = document.getElementById('modal-overlay');
    const box      = document.getElementById('modal-box');
    const titleEl  = document.getElementById('modal-title');
    const bodyEl   = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');
    const closeBtn = document.getElementById('modal-close-btn');

    titleEl.textContent = title || '';
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body instanceof Node) { bodyEl.innerHTML = ''; bodyEl.appendChild(body); }
    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else if (footer instanceof Node) { footerEl.innerHTML = ''; footerEl.appendChild(footer); }
    else footerEl.innerHTML = '';

    box.style.maxWidth = size === 'lg' ? '800px' : size === 'sm' ? '420px' : '600px';

    overlay.hidden = false;

    const close = () => {
      overlay.hidden = true;
      if (onClose) onClose();
    };

    closeBtn.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.onkeydown = (e) => { if (e.key === 'Escape') close(); };

    return { close };
  },

  confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const footer = document.createElement('div');
      footer.className = 'flex flex-gap';
      footer.innerHTML = `
        <button class="btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn-danger"    id="modal-confirm">Confirm</button>
      `;

      const { close } = Modal.show({ title, body: `<p>${message}</p>`, footer, size: 'sm' });

      footer.querySelector('#modal-cancel').onclick  = () => { close(); resolve(false); };
      footer.querySelector('#modal-confirm').onclick = () => { close(); resolve(true);  };
    });
  },
};
