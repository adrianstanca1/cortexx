/**
 * Feature flag middleware and helper
 * Gates routes behind environment-variable feature flags.
 * Flags default to true when unset — explicit "false" disables the feature.
 *
 * Usage:
 *   const { requireFeature, isFeatureEnabled } = require('../middleware/featureFlag');
 *   app.use('/api/ai', requireFeature('FEATURE_AI_AGENTS'), aiRoutes);
 *   if (isFeatureEnabled('FEATURE_WEBSOCKET')) { ... }
 *
 * Falsy values: "false", "0", "no" (case-insensitive)
 * Everything else (including unset) is treated as enabled for safety.
 */

/**
 * Check whether a feature flag is enabled.
 * Shared logic — use this anywhere you need a boolean, not just in middleware.
 */
function isFeatureEnabled(flagName) {
  const value = (process.env[flagName] || '').toLowerCase();
  return !(value === 'false' || value === '0' || value === 'no');
}

/**
 * Express middleware that blocks requests when a feature flag is disabled.
 * Returns a structured 403 with a FEATURE_DISABLED code so the frontend
 * can distinguish this from authorization 403s.
 */
function requireFeature(flagName) {
  return function featureFlagMiddleware(req, res, next) {
    if (!isFeatureEnabled(flagName)) {
      return res.status(403).json({
        message: 'This feature is currently disabled',
        code: 'FEATURE_DISABLED',
        feature: flagName,
      });
    }
    next();
  };
}

module.exports = { requireFeature, isFeatureEnabled };