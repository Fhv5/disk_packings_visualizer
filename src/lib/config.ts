/**
 * Feature Flags Configuration
 * 
 * Toggle application features on or off.
 */
export const FEATURE_FLAGS = {
  /**
   * Controls data export functionality (JSON export button and modal).
   * Export is available while running `next dev`, but is compiled out of
   * production builds (including the static build deployed to Cloudflare).
   */
  ENABLE_EXPORT: process.env.NODE_ENV === 'development',
};

export const DEFAULT_CRITICALITY_TOLERANCE = 1e-5;
