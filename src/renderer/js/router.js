/**
 * router.js — Client-side view router
 * M.R. Textile CMS
 */

export class Router {
  constructor(container, routes) {
    this.container = container;
    this.routes    = routes;
    this.current   = null;
  }

  navigate(view, ...args) {
    const handler = this.routes[view];
    if (!handler) { console.warn(`[Router] No view: ${view}`); return; }
    this.current = view;
    this.container.innerHTML = '';
    handler(this.container, ...args);
  }
}
