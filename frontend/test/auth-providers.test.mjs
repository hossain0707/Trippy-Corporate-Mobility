import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enabledSocialProviders} from '../src/features/auth/providers.js';

test('Google sign-in is visible when the optional deployment variable is missing', () => {
  assert.deepEqual(enabledSocialProviders(undefined).map(([id]) => id), ['google']);
});
test('a deliberately empty provider list disables social sign-in buttons', () => {
  assert.deepEqual(enabledSocialProviders(''), []);
});
test('only configured and supported provider names appear, without duplicates', () => {
  assert.deepEqual(
    enabledSocialProviders(' GOOGLE, facebook, google, unsupported ').map(([id]) => id),
    ['google', 'facebook'],
  );
});
test('other providers are opt-in', () => {
  assert.deepEqual(enabledSocialProviders('azure,apple').map(([id]) => id), ['azure', 'apple']);
});
