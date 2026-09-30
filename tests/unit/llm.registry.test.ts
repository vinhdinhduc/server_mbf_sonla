import { providers, resolveEndpoint } from '../../src/services/llm/registry/providers';
import { isPublicAddress, validateBaseUrl } from '../../src/services/llm/safeHttp';
import { aiProfileSchema } from '../../src/validators/ai.validator';

describe('Provider registry and endpoint boundaries', () => {
  test('23 providers plus custom, unique IDs and complete metadata', () => {
    expect(providers).toHaveLength(24);
    expect(new Set(providers.map((p) => p.id)).size).toBe(24);
    for (const p of providers) {
      expect(p.name && p.tagline && p.adapter && p.category && p.checkedAt).toBeTruthy();
      expect(p.sources.length).toBeGreaterThan(0);
      expect(new URL(p.keyHelp.url).protocol).toBe('https:');
      expect(new Set(p.endpoints.map((e) => e.id)).size).toBe(p.endpoints.length);
      if (p.id !== 'custom') expect(p.endpoints.some((e) => e.id === p.defaultEndpoint && !e.disabled)).toBe(true);
      for (const endpoint of p.endpoints) expect(validateBaseUrl(endpoint.baseUrl)).toBeInstanceOf(URL);
      for (const m of p.models) {
        expect(m.id && m.label && m.group).toBeTruthy();
        if (!m.verified) { expect(m.priceInPer1M).toBeNull(); expect(m.priceOutPer1M).toBeNull(); }
      }
    }
  });
  test('Llama resolves selected host and rejects unavailable direct API', () => {
    expect(resolveEndpoint('llama', 'groq').definition.id).toBe('groq');
    expect(() => resolveEndpoint('llama', 'meta')).toThrow();
    expect(() => resolveEndpoint('openai', 'https://evil.example')).toThrow();
  });
  test.each(['http://example.com', 'https://localhost', 'https://127.1', 'https://2130706433', 'https://169.254.169.254/latest/meta-data', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://user:password@example.com', 'https://example.com:8080', 'https://example.com?key=secret', 'https://a.internal'])('rejects unsafe custom endpoint %s', (url) => expect(() => validateBaseUrl(url)).toThrow());
  test.each(['10.0.0.1', '172.16.0.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', 'fc00::1', 'fe80::1', '::ffff:10.0.0.1', '2002:7f00:1::'])('rejects non-public DNS result %s', (address) => expect(isPublicAddress(address)).toBe(false));
  test('accepts public targets and validates profile endpoint', () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
    expect(aiProfileSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001', name: 'x', provider: 'custom', model: 'new-model', base_url: 'https://127.0.0.1', enabled: true, temperature: .2, max_tokens: 1024, top_p: 1 }).success).toBe(false);
  });
});
