import type { CustomEventData } from './events';

export type UserActionCustomEventTag = Extract<
  CustomEventData['tag'],
  'csr:click' | 'csr:deadClick' | 'csr:rageClick' | 'csr:input' | 'csr:formFieldReEdit' | 'csr:scrollBack'
>;

export const USER_ACTION_CUSTOM_EVENT_TAGS: readonly UserActionCustomEventTag[] = [
  'csr:click',
  'csr:deadClick',
  'csr:rageClick',
  'csr:input',
  'csr:formFieldReEdit',
  'csr:scrollBack',
];

export type UserActivityCustomEventTag =
  | UserActionCustomEventTag
  | Extract<CustomEventData['tag'], 'csr:routeChange' | 'csr:tabRefocus'>;

export const USER_ACTIVITY_CUSTOM_EVENT_TAGS: readonly UserActivityCustomEventTag[] = [
  ...USER_ACTION_CUSTOM_EVENT_TAGS,
  'csr:routeChange',
  'csr:tabRefocus',
];

const userActionCustomEventTags: ReadonlySet<string> = new Set(USER_ACTION_CUSTOM_EVENT_TAGS);
const userActivityCustomEventTags: ReadonlySet<string> = new Set(USER_ACTIVITY_CUSTOM_EVENT_TAGS);

export function isUserActionCustomEventTag(tag: string): tag is UserActionCustomEventTag {
  return userActionCustomEventTags.has(tag);
}

export function isUserActivityCustomEventTag(tag: string): tag is UserActivityCustomEventTag {
  return userActivityCustomEventTags.has(tag);
}
