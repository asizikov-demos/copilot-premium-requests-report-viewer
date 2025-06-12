import '@testing-library/jest-dom';

// Mock PapaParse properly
global.File = class File {
  constructor(chunks, filename, options = {}) {
    this.name = filename;
    this.type = options.type || 'text/plain';
    this.content = chunks.join('');
  }
};
