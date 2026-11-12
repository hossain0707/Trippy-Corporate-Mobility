/**
 * Login provider allowlist. Google is the default for the hosted TRIPPY app;
 * an explicitly empty VITE_SOCIAL_PROVIDERS disables every social button.
 * Other providers remain opt-in until their own credentials are configured.
 */
export const supportedProviders = Object.freeze([
  ['google', 'Continue with Google'],
  ['facebook', 'Continue with Facebook'],
  ['azure', 'Continue with Microsoft'],
  ['apple', 'Continue with Apple'],
]);

export function enabledSocialProviders(configuredProviders) {
  const value = configuredProviders === undefined ? 'google' : String(configuredProviders);
  const enabled = new Set(value.split(',').map(provider => provider.trim().toLowerCase()).filter(Boolean));
  return supportedProviders.filter(([provider]) => enabled.has(provider));
}
