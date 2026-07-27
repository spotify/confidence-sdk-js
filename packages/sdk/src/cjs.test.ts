describe('CommonJS build output', () => {
  it('should be requirable via CommonJS', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sdk = require('../dist/index.cjs');
    expect(sdk).toBeDefined();
    expect(sdk.Confidence).toBeDefined();
    expect(sdk.Value).toBeDefined();
  });
});
