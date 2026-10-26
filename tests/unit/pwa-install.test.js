import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.attributes = {};
    this.children = [];
    this._classList = new Set();
    this.parentNode = null;
    this.innerHTML = '';
    this.textContent = '';
  }

  get classList() {
    return {
      add: (...cls) => cls.forEach(c => this._classList.add(c)),
      remove: (...cls) => cls.forEach(c => this._classList.delete(c)),
      contains: (c) => this._classList.has(c),
      toggle: (c) => (this._classList.has(c) ? this._classList.delete(c) : this._classList.add(c))
    };
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }

  getAttribute(k) {
    return this.attributes[k] || null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) this.parentNode.children.splice(idx, 1);
      this.parentNode = null;
    }
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      if (this.id === id) return this;
      for (const child of this.children) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }

  closest(selector) {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      if (this.classList.contains(cls)) return this;
      return this.parentNode ? this.parentNode.closest(selector) : null;
    }
    return null;
  }

  addEventListener(ev, fn) {
    this._listeners = this._listeners || {};
    this._listeners[ev] = this._listeners[ev] || [];
    this._listeners[ev].push(fn);
  }

  click() {
    if (this.onclick) this.onclick();
    if (this._listeners?.click) {
      this._listeners.click.forEach(fn => fn({ target: this }));
    }
  }

  focus() {}
}

describe('PWA Install and Detection Logic', () => {
  let pwaModule;
  let mockDoc;
  let mockWin;
  let mockNav;
  let elementsById;

  let originalNavDesc;

  beforeEach(async () => {
    originalNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    elementsById = new Map();

    const body = new MockElement('body');
    const aside = new MockElement('aside');
    aside.classList.add('app-sidebar');

    const header = new MockElement('div');
    header.id = 'sidebar-header';
    header.classList.add('sidebar-header');

    const btn = new MockElement('button');
    btn.id = 'btn-pwa-install';
    btn.style.display = 'none';

    header.appendChild(btn);
    aside.appendChild(header);
    body.appendChild(aside);

    elementsById.set('btn-pwa-install', btn);
    elementsById.set('sidebar-header', header);

    mockDoc = {
      body,
      createElement: (tag) => new MockElement(tag),
      getElementById: (id) => elementsById.get(id) || null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    };

    mockNav = {
      userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B)',
      maxTouchPoints: 5,
      standalone: false
    };

    mockWin = {
      navigator: mockNav,
      matchMedia: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })),
      addEventListener: vi.fn()
    };

    global.document = mockDoc;
    global.window = mockWin;
    Object.defineProperty(globalThis, 'navigator', {
      value: mockNav,
      configurable: true,
      writable: true
    });

    // Dynamically import module with fresh global context
    pwaModule = await import('../../src/ui/pwa-install.js');
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
    if (originalNavDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavDesc);
    }
    vi.restoreAllMocks();
  });

  describe('isStandalone', () => {
    it('returns false in normal browser tab', () => {
      mockWin.matchMedia.mockReturnValue({ matches: false, addEventListener: vi.fn() });
      mockNav.standalone = false;
      expect(pwaModule.isStandalone()).toBe(false);
    });

    it('returns true when display-mode: standalone matches', () => {
      mockWin.matchMedia.mockImplementation((query) => ({
        matches: query.includes('standalone'),
        media: query,
        addEventListener: vi.fn()
      }));
      expect(pwaModule.isStandalone()).toBe(true);
    });

    it('returns true when navigator.standalone is true (iOS standalone)', () => {
      mockWin.matchMedia.mockReturnValue({ matches: false, addEventListener: vi.fn() });
      mockNav.standalone = true;
      expect(pwaModule.isStandalone()).toBe(true);
    });
  });

  describe('getPlatformInfo', () => {
    it('detects iPhone / iOS', () => {
      mockNav.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)';
      mockNav.maxTouchPoints = 5;

      const info = pwaModule.getPlatformInfo();
      expect(info.platform).toBe('ios');
      expect(info.isMobile).toBe(true);
    });

    it('detects iPadOS (Macintosh userAgent with touch points)', () => {
      mockNav.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
      mockNav.maxTouchPoints = 5;

      const info = pwaModule.getPlatformInfo();
      expect(info.platform).toBe('ios');
      expect(info.isMobile).toBe(true);
    });

    it('detects Android', () => {
      mockNav.userAgent = 'Mozilla/5.0 (Linux; Android 13; SM-G991B)';
      mockNav.maxTouchPoints = 5;

      const info = pwaModule.getPlatformInfo();
      expect(info.platform).toBe('android');
      expect(info.isMobile).toBe(true);
    });

    it('detects Desktop Chrome/Safari/Firefox', () => {
      mockNav.userAgent = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36';
      mockNav.maxTouchPoints = 0;

      const info = pwaModule.getPlatformInfo();
      expect(info.platform).toBe('desktop');
      expect(info.isMobile).toBe(false);
    });
  });

  describe('initInstallButton', () => {
    it('hides the button and adds is-hidden class if already in standalone mode', () => {
      mockWin.matchMedia.mockReturnValue({ matches: true, addEventListener: vi.fn() });
      const btn = elementsById.get('btn-pwa-install');
      const header = elementsById.get('sidebar-header');

      pwaModule.initInstallButton(btn);

      expect(btn.style.display).toBe('none');
      expect(header.classList.contains('is-hidden')).toBe(true);
    });

    it('shows the button and removes is-hidden when NOT standalone', () => {
      mockWin.matchMedia.mockReturnValue({ matches: false, addEventListener: vi.fn() });
      const btn = elementsById.get('btn-pwa-install');
      const header = elementsById.get('sidebar-header');
      header.classList.add('is-hidden');

      pwaModule.initInstallButton(btn);

      expect(btn.style.display).toBe('flex');
      expect(header.classList.contains('is-hidden')).toBe(false);
      expect(btn.getAttribute('aria-label')).toBe('Instalar aplicativo');
    });

    it('handles button clicks and shows instructions modal if prompt is not deferred', () => {
      mockWin.matchMedia.mockReturnValue({ matches: false, addEventListener: vi.fn() });
      mockNav.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)';
      mockNav.maxTouchPoints = 5;

      const btn = elementsById.get('btn-pwa-install');
      pwaModule.initInstallButton(btn);

      btn.click();

      const modal = mockDoc.body.children.find((c) => c.id === 'pwa-install-modal');
      expect(modal).toBeDefined();
      expect(modal.innerHTML).toContain('iPhone / iPad');
      expect(modal.innerHTML).toContain('Compartilhar (⬆)');
    });
  });
});
