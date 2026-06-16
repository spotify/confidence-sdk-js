import { describe, it, expect } from 'vitest';
import { defaultParameterizeRoute } from './route-parameterizer';

describe('defaultParameterizeRoute', () => {
  it('leaves static routes unchanged', () => {
    expect(defaultParameterizeRoute('/users/settings')).toBe('/users/settings');
  });

  it('replaces numeric IDs', () => {
    expect(defaultParameterizeRoute('/users/123')).toBe('/users/:id');
    expect(defaultParameterizeRoute('/users/123/posts/456')).toBe('/users/:id/posts/:id');
  });

  it('replaces UUIDs', () => {
    expect(defaultParameterizeRoute('/users/550e8400-e29b-41d4-a716-446655440000')).toBe('/users/:uuid');
  });

  it('replaces uppercase UUIDs', () => {
    expect(defaultParameterizeRoute('/users/550E8400-E29B-41D4-A716-446655440000')).toBe('/users/:uuid');
  });

  it('replaces long hex strings (MongoDB ObjectIDs)', () => {
    expect(defaultParameterizeRoute('/items/507f1f77bcf86cd799439011')).toBe('/items/:id');
  });

  it('handles mixed segments', () => {
    expect(defaultParameterizeRoute('/org/550e8400-e29b-41d4-a716-446655440000/users/42/profile')).toBe(
      '/org/:uuid/users/:id/profile',
    );
  });

  it('preserves root path', () => {
    expect(defaultParameterizeRoute('/')).toBe('/');
  });

  it('preserves empty string', () => {
    expect(defaultParameterizeRoute('')).toBe('');
  });

  it('does not replace short hex strings', () => {
    expect(defaultParameterizeRoute('/features/abcdef')).toBe('/features/abcdef');
  });

  it('does not replace words that look vaguely hex-ish', () => {
    expect(defaultParameterizeRoute('/dashboard/feed')).toBe('/dashboard/feed');
  });

  it('handles trailing slash', () => {
    expect(defaultParameterizeRoute('/users/123/')).toBe('/users/:id/');
  });

  it('replaces AIP-122 generated IDs', () => {
    expect(defaultParameterizeRoute('/workflows/abtest/instances/cmvkznnjmbkc9rw2oxws/report')).toBe(
      '/workflows/abtest/instances/:id/report',
    );
  });

  it('replaces multiple AIP-122 IDs', () => {
    expect(defaultParameterizeRoute('/admin/workflows/a0smva5nxuhv4yts6pax/instances/cmvkznnjmbkc9rw2oxws')).toBe(
      '/admin/workflows/:id/instances/:id',
    );
  });

  it('does not replace short lowercase strings as AIP-122', () => {
    expect(defaultParameterizeRoute('/workflows/abtest')).toBe('/workflows/abtest');
  });

  it('replaces segments containing embedded hex IDs', () => {
    expect(defaultParameterizeRoute('/items/prefix507f1f77bcf86cd799439011suffix')).toBe('/items/:id');
  });

  it('replaces MD5 hashes', () => {
    expect(defaultParameterizeRoute('/cache/d41d8cd98f00b204e9800998ecf8427e')).toBe('/cache/:id');
  });
});
