/**
 * Simple client-side hash router
 */
export class Router {
  constructor(routes, rootElement) {
    this.routes = routes;
    this.rootElement = rootElement;
    this.currentView = null;
    this.currentRoute = null;

    window.addEventListener('hashchange', () => this.handleRoute());
  }

  init() {
    this.handleRoute();
  }

  navigate(hash) {
    window.location.hash = hash;
  }

  async handleRoute() {
    const rawHash = window.location.hash.slice(1) || '/';
    const [path, queryString] = rawHash.split('?');
    const queryParams = new URLSearchParams(queryString || '');

    // Highlight sidebar nav links
    const allNavLinks = document.querySelectorAll('.nav-link, .nav-link-subtle');
    allNavLinks.forEach((link) => {
      const linkPath = link.getAttribute('data-route');
      const isMatch =
        linkPath === path ||
        (path === '/' && (linkPath === '/cards' || linkPath === '/')) ||
        (path.startsWith('/cards') && linkPath === '/cards') ||
        (path.startsWith('/settings') && linkPath === '/settings');
      if (isMatch) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    const routeHandler = this.routes[path] || this.routes['/'];
    if (routeHandler) {
      this.currentRoute = path;
      try {
        if (this.currentView && typeof this.currentView.destroy === 'function') {
          this.currentView.destroy();
        }
        this.currentView = await routeHandler(this.rootElement, queryParams, this);
      } catch (err) {
        console.error('Erro na renderização da rota:', err);
        this.rootElement.innerHTML = `
          <div class="empty-state">
            <h2 class="empty-title">Ocorreu um erro ao carregar a página</h2>
            <p class="empty-desc">${err.message || 'Erro inesperado'}</p>
            <button class="btn btn-primary" onclick="window.location.hash = '/'">Voltar ao Início</button>
          </div>
        `;
      }
    }
  }
}
