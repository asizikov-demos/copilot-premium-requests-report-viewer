import { getBasePath, GITHUB_PAGES_BASE_PATH } from '@/constants/deployment';

describe('deployment configuration', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    // Restore original NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true,
    });
  });

  describe('getBasePath', () => {
    it('should return empty string in development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      expect(getBasePath()).toBe('');
    });

    it('should return empty string in test', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'test',
        writable: true,
        configurable: true,
      });
      expect(getBasePath()).toBe('');
    });

    it('should return configured base path in production', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });
      expect(getBasePath()).toBe(GITHUB_PAGES_BASE_PATH);
    });

    it('should return base path with leading slash and no trailing slash', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });
      const basePath = getBasePath();
      
      // Should not be empty in production
      expect(basePath).not.toBe('');
      
      // Should start with slash
      expect(basePath).toMatch(/^\//);
      
      // Should not end with slash
      expect(basePath).not.toMatch(/\/$/);
    });
  });

  describe('GITHUB_PAGES_BASE_PATH constant', () => {
    it('should be a valid path format', () => {
      // Should start with slash
      expect(GITHUB_PAGES_BASE_PATH).toMatch(/^\//);
      
      // Should not end with slash
      expect(GITHUB_PAGES_BASE_PATH).not.toMatch(/\/$/);
      
      // Should not be a full URL
      expect(GITHUB_PAGES_BASE_PATH).not.toMatch(/^https?:\/\//);
      
      // Should not be just "/"
      expect(GITHUB_PAGES_BASE_PATH).not.toBe('/');
    });
  });
});
