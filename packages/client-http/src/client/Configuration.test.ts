import { Configuration } from './Configuration';

describe('Configuration', () => {
  describe('Configuration.Flag.getFlagDetails', () => {
    it('should get the value and the schema', () => {
      const result = Configuration.Flag.getFlagDetails(
        {
          flagName: 'test',
          schema: {
            a: {
              b: 'string',
            },
          },
          reason: Configuration.ResolveReason.Match,
          value: {
            a: {
              b: 'hello world',
            },
          },
          variant: 'control',
        },
        'a',
        'b',
      );

      expect(result.value).toEqual('hello world');
      expect(result.schema).toEqual('string');
    });

    it('should throw an error when the path not traversable for the value and schema', () => {
      expect(() =>
        Configuration.Flag.getFlagDetails(
          {
            flagName: 'test',
            schema: {
              a: {
                b: 'string',
              },
            },
            reason: Configuration.ResolveReason.Match,
            value: {
              a: {
                b: 'hello world',
              },
            },
            variant: 'control',
          },
          'a',
          'b',
          'c',
        ),
      ).toThrowError();
    });
  });
});
