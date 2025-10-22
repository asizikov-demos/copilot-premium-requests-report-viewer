/**
 * DEPRECATED AGGREGATE ANALYTICS MODULE
 * ------------------------------------
 * This file previously contained a large collection of analytics utilities coupling
 * quota, power-user scoring, coding agent adoption, transformations and filters.
 * It has been refactored into focused modules under `src/utils/analytics/`:
 *   - quota.ts
 *   - powerUsers.ts
 *   - codingAgent.ts
 *   - filters.ts
 *   - exhaustion.ts
 *
 * For backward compatibility existing imports from 'utils/dataAnalysis' will continue to work
 * temporarily. New code should import from the granular modules or the barrel export
 * at `utils/analytics`.
 */

export * from './analytics/quota';
export * from './analytics/filters';
export * from './analytics/powerUsers';
export * from './analytics/codingAgent';
export * from './analytics/exhaustion';
