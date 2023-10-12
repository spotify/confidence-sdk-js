import { Configuration } from './Configuration';

describe('Configuration', () => {
  describe('Configuration.Flag.getFlagDetails', () => {
    it('should get the value and the schema', () => {
      const result: Configuration.FlagValue<string> = Configuration.FlagValue.traverse(
        {
          schema: {
            a: {
              b: 'string',
            },
          },
          value: {
            a: {
              b: 'hello world',
            },
          },
        },
        'a.b',
      );

      expect(result.value).toEqual('hello world');
      expect(result.schema).toEqual('string');
    });

    it('should throw an error when the path not traversable for the value and schema', () => {
      expect(() =>
        Configuration.FlagValue.traverse(
          {
            schema: {
              a: {
                b: 'string',
              },
            },
            value: {
              a: {
                b: 'hello world',
              },
            },
          },
          'a.b.c',
        ),
      ).toThrowError();
    });
  });
});
