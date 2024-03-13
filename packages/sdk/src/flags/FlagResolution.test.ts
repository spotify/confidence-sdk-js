import { FlagResolution } from './FlagResolution';

describe('FlagResolution', () => {
  describe('FlagResolution.Flag.getFlagDetails', () => {
    it('should get the value and the schema', () => {
      const result: FlagResolution.FlagValue<string> = FlagResolution.FlagValue.traverse(
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
        FlagResolution.FlagValue.traverse(
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

  describe('FlagResolution.FlagValue.matches', () => {
    it('should match undefined value to "undefined" schema', () => {
      expect(FlagResolution.FlagValue.matches({ schema: 'undefined', value: undefined }, undefined)).toEqual(true);
    });

    it('should not match a string value to "undefined" schema', () => {
      expect(FlagResolution.FlagValue.matches({ schema: 'undefined', value: undefined }, 'hello world')).toEqual(false);
    });
  });
});
