/**
 * @jest-environment jsdom
 */
import { visitorIdentity } from './visitorId';
import { Cookie } from '../utils';
import { Trackable } from '../Trackable';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function mockController(): Trackable.Controller {
  return {
    setContext: jest.fn().mockReturnValue(true),
    track: jest.fn() as any,
    config: {} as any,
  };
}

function mockCookieStore(cookies: Array<{ name: string; value: string; domain: string }>) {
  const store = {
    getAll: jest.fn(async (name: string) => cookies.filter(c => c.name === name)),
    delete: jest.fn(async ({ name, domain }: { name: string; domain: string }) => {
      const idx = cookies.findIndex(c => c.name === name && c.domain === domain);
      if (idx >= 0) cookies.splice(idx, 1);
    }),
  };
  (globalThis as any).cookieStore = store;
  return store;
}

beforeEach(() => {
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });
  delete (globalThis as any).cookieStore;
});

describe('visitorIdentity', () => {
  describe('without domain', () => {
    it('generates a new visitor id when no cookie exists', () => {
      const controller = mockController();
      visitorIdentity()(controller);

      expect(controller.setContext).toHaveBeenCalledWith({
        visitor_id: expect.stringMatching(UUID_PATTERN),
      });
      expect(Cookie.get('cnfdVisitorId')).toBeDefined();
    });

    it('reuses existing cookie value', () => {
      Cookie.set('cnfdVisitorId', 'existing-id', { maxAge: 1000 });
      const controller = mockController();
      visitorIdentity()(controller);

      expect(controller.setContext).toHaveBeenCalledWith({ visitor_id: 'existing-id' });
    });
  });

  describe('with domain, no CookieStore', () => {
    it('sets a domain-scoped cookie', () => {
      const controller = mockController();
      const setSpy = jest.spyOn(Cookie, 'set');
      visitorIdentity({ domain: '.example.com' })(controller);

      expect(controller.setContext).toHaveBeenCalledWith({
        visitor_id: expect.stringMatching(UUID_PATTERN),
      });
      expect(setSpy).toHaveBeenCalledWith('cnfdVisitorId', expect.any(String), {
        maxAge: expect.any(Number),
        domain: '.example.com',
      });
      setSpy.mockRestore();
    });
  });

  describe('with domain and CookieStore', () => {
    it('sets domain cookie when no cookies exist', async () => {
      const store = mockCookieStore([]);
      const setSpy = jest.spyOn(Cookie, 'set');
      const controller = mockController();

      visitorIdentity({ domain: 'example.com' })(controller);
      await flushPromises();

      expect(store.getAll).toHaveBeenCalledWith('cnfdVisitorId');
      expect(setSpy).toHaveBeenCalledWith(
        'cnfdVisitorId',
        expect.stringMatching(UUID_PATTERN),
        expect.objectContaining({ domain: 'example.com' }),
      );
      setSpy.mockRestore();
    });

    it('migrates host cookie to domain cookie', async () => {
      const cookies = [{ name: 'cnfdVisitorId', value: 'host-value', domain: 'app.example.com' }];
      const store = mockCookieStore(cookies);
      Cookie.set('cnfdVisitorId', 'host-value', { maxAge: 1000 });

      const setSpy = jest.spyOn(Cookie, 'set');
      const controller = mockController();

      visitorIdentity({ domain: 'example.com' })(controller);
      await flushPromises();

      expect(store.delete).toHaveBeenCalledWith({ name: 'cnfdVisitorId', domain: 'app.example.com' });
      expect(setSpy).toHaveBeenCalledWith(
        'cnfdVisitorId',
        'host-value',
        expect.objectContaining({ domain: 'example.com' }),
      );
      setSpy.mockRestore();
    });

    it('preserves existing domain cookie and deletes host cookie', async () => {
      const cookies = [
        { name: 'cnfdVisitorId', value: 'host-value', domain: 'app.example.com' },
        { name: 'cnfdVisitorId', value: 'domain-value', domain: 'example.com' },
      ];
      const store = mockCookieStore(cookies);
      Cookie.set('cnfdVisitorId', 'host-value', { maxAge: 1000 });

      const setSpy = jest.spyOn(Cookie, 'set');
      const controller = mockController();

      visitorIdentity({ domain: 'example.com' })(controller);

      // Sync: context set with host value (most specific)
      expect(controller.setContext).toHaveBeenCalledWith({ visitor_id: 'host-value' });

      await flushPromises();

      // Async: host cookie deleted, domain cookie preserved, context updated
      expect(store.delete).toHaveBeenCalledWith({ name: 'cnfdVisitorId', domain: 'app.example.com' });
      expect(store.delete).not.toHaveBeenCalledWith(expect.objectContaining({ domain: 'example.com' }));
      expect(controller.setContext).toHaveBeenCalledWith({ visitor_id: 'domain-value' });
      setSpy.mockRestore();
    });

    it('normalizes domain with leading dot', async () => {
      Cookie.set('cnfdVisitorId', 'domain-value', { maxAge: 1000 });
      const cookies = [{ name: 'cnfdVisitorId', value: 'domain-value', domain: '.example.com' }];
      mockCookieStore(cookies);

      const controller = mockController();
      visitorIdentity({ domain: 'example.com' })(controller);
      await flushPromises();

      // Domain cookie matched despite leading dot — no duplicate setContext
      expect(controller.setContext).toHaveBeenCalledTimes(1);
      expect(controller.setContext).toHaveBeenCalledWith({ visitor_id: 'domain-value' });
    });

    it('falls back to simple set when CookieStore throws', async () => {
      (globalThis as any).cookieStore = {
        getAll: jest.fn().mockRejectedValue(new Error('not allowed')),
        delete: jest.fn(),
      };
      const setSpy = jest.spyOn(Cookie, 'set');
      const controller = mockController();

      visitorIdentity({ domain: 'example.com' })(controller);
      await flushPromises();

      expect(setSpy).toHaveBeenCalledWith(
        'cnfdVisitorId',
        expect.any(String),
        expect.objectContaining({ domain: 'example.com' }),
      );
      setSpy.mockRestore();
    });
  });

  describe('SSR', () => {
    it('does nothing when document is undefined', () => {
      const originalDocument = globalThis.document;
      // @ts-expect-error - testing SSR
      delete globalThis.document;
      try {
        const controller = mockController();
        visitorIdentity()(controller);
        expect(controller.setContext).not.toHaveBeenCalled();
      } finally {
        globalThis.document = originalDocument;
      }
    });
  });
});

function flushPromises(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}
