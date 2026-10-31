import { createRequire } from 'module';

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
const noProxy = (process.env.NO_PROXY || process.env.no_proxy || 'localhost,127.0.0.1,10.3.78.2').split(',').map((x) => x.trim()).filter(Boolean);
if (proxy) {
  try {
    const require = createRequire(`${process.cwd()}/package.json`);
    const { ProxyAgent, setGlobalDispatcher } = require('undici');
    const dispatcher = new ProxyAgent({ uri: proxy });
    setGlobalDispatcher(dispatcher);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      const bypass = noProxy.some((host) => url.hostname === host || (host.startsWith('.') && url.hostname.endsWith(host)));
      return originalFetch(input, { ...init, ...(bypass ? { dispatcher: undefined } : { dispatcher }) } as RequestInit);
    }) as typeof fetch;
    console.info('[proxy] Configured outbound HTTP proxy; NO_PROXY:', noProxy.join(','));
  } catch (error) {
    console.error('[proxy] HTTPS_PROXY is set but undici ProxyAgent is unavailable:', error instanceof Error ? error.message : error);
  }
}
