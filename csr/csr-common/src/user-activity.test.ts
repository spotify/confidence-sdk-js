import { describe, expect, it } from 'vitest';
import {
  USER_ACTION_CUSTOM_EVENT_TAGS,
  USER_ACTIVITY_CUSTOM_EVENT_TAGS,
  isUserActionCustomEventTag,
  isUserActivityCustomEventTag,
} from './user-activity';

describe('custom event activity', () => {
  it('defines boundary activity as user actions plus navigation and refocus', () => {
    expect(USER_ACTIVITY_CUSTOM_EVENT_TAGS).toEqual([
      ...USER_ACTION_CUSTOM_EVENT_TAGS,
      'csr:routeChange',
      'csr:tabRefocus',
    ]);
  });

  it('distinguishes direct user actions from broader boundary activity', () => {
    expect(isUserActionCustomEventTag('csr:click')).toBe(true);
    expect(isUserActionCustomEventTag('csr:routeChange')).toBe(false);
    expect(isUserActivityCustomEventTag('csr:routeChange')).toBe(true);
    expect(isUserActivityCustomEventTag('csr:tabUnfocus')).toBe(false);
    expect(isUserActivityCustomEventTag('csr:errorMessage')).toBe(false);
  });
});
