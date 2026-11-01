import '@testing-library/jest-dom';

// Mock PapaParse properly
global.File = class File {
  constructor(chunks, filename, options = {}) {
    this.name = filename;
    this.type = options.type || 'text/plain';
    this.content = chunks.join('');
  }
};

// Primer React responsive hooks rely on matchMedia, which JSDOM does not implement.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = () => {};
}
