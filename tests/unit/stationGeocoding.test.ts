const originalEnvironment = { ...process.env };

describe('BTS geocoding provider', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.GEOCODING_USER_AGENT = 'BTS-test/1.0 (test@example.com)';
    process.env.NODE_ENV = 'test';
    delete process.env.GEOCODING_SEARCH_URL;
  });
  afterEach(() => {
    process.env = { ...originalEnvironment };
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('requires an explicit production provider and accepts a configured endpoint', async () => {
    process.env.NODE_ENV = 'production';
    const { nominatimProvider } = await import('../../src/services/geocoding.service');
    await expect(nominatimProvider.search('Sơn La')).rejects.toMatchObject({ statusCode: 503 });
    process.env.GEOCODING_SEARCH_URL = 'https://geocoder.example.com/search';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('[]', { status: 200 }));
    expect(await nominatimProvider.search('Sơn La')).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://geocoder.example.com/search?');
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      'User-Agent': process.env.GEOCODING_USER_AGENT,
    });
  });

  it('caches repeated queries and spaces different requests at least one second apart', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify([{ lat: '21.3256', lon: '103.9188', display_name: 'Sơn La' }]),
            { status: 200 },
          ),
      );
    const { nominatimProvider } = await import('../../src/services/geocoding.service');
    expect(await nominatimProvider.search('Sơn La')).toMatchObject({ lat: 21.3256, lng: 103.9188 });
    await nominatimProvider.search('SƠN LA');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const second = nominatimProvider.search('Mộc Châu');
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(100);
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid geocoder coordinates', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify([{ lat: 'NaN', lon: '103.9', display_name: 'Invalid' }]), {
          status: 200,
        }),
      );
    const { nominatimProvider } = await import('../../src/services/geocoding.service');
    await expect(nominatimProvider.search('Sơn La')).rejects.toMatchObject({ statusCode: 502 });
  });
});
