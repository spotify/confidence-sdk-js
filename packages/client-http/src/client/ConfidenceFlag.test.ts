import { ConfidenceFlag, ResolvedFlag } from './ConfidenceFlag';
import { Configuration } from './Configuration';
import ResolveReason = Configuration.ResolveReason;

const resolvedFlag: ResolvedFlag = {
  flag: 'test',
  value: {
    str: 'testVal',
  },
  variant: 'treatment',
  reason: ResolveReason.Match,
  flagSchema: {
    schema: {
      str: {
        stringSchema: {},
      },
    },
  },
};

describe('ConfidenceFlag', () => {
  it('should construct correctly', () => {
    const flag = new ConfidenceFlag(resolvedFlag);

    expect(flag.value).toEqual(resolvedFlag.value);
    expect(flag.reason).toEqual(resolvedFlag.reason);
    expect(flag.variant).toEqual(resolvedFlag.variant);
    expect(flag.flagName).toEqual(resolvedFlag.flag);
    expect(flag.schema).toEqual({ str: 'string' });
  });

  describe('parsing schema', () => {
    it('should parse', () => {
      const flag = new ConfidenceFlag({
        flag: 'test',
        variant: 'treatment',
        reason: ResolveReason.Match,
        flagSchema: {
          schema: {
            str: {
              stringSchema: {},
            },
            struct: {
              structSchema: {
                schema: {
                  str: {
                    stringSchema: {},
                  },
                  int: {
                    intSchema: {},
                  },
                  double: {
                    doubleSchema: {},
                  },
                  bool: {
                    boolSchema: {},
                  },
                  structStruct: {
                    structSchema: {
                      schema: {
                        bool: {
                          boolSchema: {},
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      expect(flag.schema).toEqual({
        str: 'string',
        struct: {
          str: 'string',
          int: 'number',
          double: 'number',
          bool: 'boolean',
          structStruct: {
            bool: 'boolean',
          },
        },
      });
    });
  });

  describe('getValue', () => {
    it('should return null value if the flag is not a match', () => {
      const flag = new ConfidenceFlag({ ...resolvedFlag, reason: ResolveReason.Archived });

      const val = flag.getValue('str');

      expect(val!.value).toBeNull();
      expect(val!.match('')).toBeFalsy();
    });

    it('should return null value if the flag no schema', () => {
      const flag = new ConfidenceFlag({ ...resolvedFlag, flagSchema: undefined });

      const val = flag.getValue('str');

      expect(val).toBeNull();
    });

    it('should return null value if the flag path is not found in the flag', () => {
      const flag = new ConfidenceFlag({ ...resolvedFlag, flagSchema: undefined });

      const val = flag.getValue('unknown');

      expect(val).toBeNull();
    });

    it('should return the correct value', () => {
      const flag = new ConfidenceFlag(resolvedFlag);

      const val = flag.getValue('str');

      expect(val!.value).toEqual('testVal');
      expect(val!.match('asdf')).toBeTruthy();
    });

    it('should only match against the correct type', () => {
      const flag = new ConfidenceFlag(resolvedFlag);

      const val = flag.getValue('str');

      expect(val!.match('asdf')).toBeTruthy();
      expect(val!.match(false)).toBeFalsy();
      expect(val!.match(0)).toBeFalsy();
      expect(val!.match(null)).toBeFalsy();
      expect(val!.match(undefined)).toBeFalsy();
      expect(val!.match({})).toBeFalsy();
    });
  });
});
