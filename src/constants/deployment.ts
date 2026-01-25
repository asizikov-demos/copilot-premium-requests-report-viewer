/**
 * Deployment configuration - single source of truth for base paths and URLs.
 * This ensures next.config.ts and client code always stay in sync.
 */

/**
 * The base path for GitHub Pages deployment.
 * 
 * REQUIREMENTS:
 * - Must start with "/" (e.g., "/repo-name")
 * - Must NOT end with "/" (no trailing slash)
 * - Must NOT be just "/" (use empty string for root deployments)
 * - Must be a path-only value, NOT a full URL
 * 
 * Set to empty string for root deployments or local development.
 */
export const GITHUB_PAGES_BASE_PATH = '/copilot-premium-requests-report-viewer';

/**
 * Get the base path based on the current environment.
 * Returns empty string for development, configured base path for production.
 */
export function getBasePath(): string {
  const isProd = process.env.NODE_ENV === 'production';
  return isProd ? GITHUB_PAGES_BASE_PATH : '';
}
