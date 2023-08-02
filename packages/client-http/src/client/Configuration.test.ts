import { Configuration } from './Configuration';
import { ConfidenceFlag } from './ConfidenceFlag';

const fakeConfiguration: Configuration = {
  flags: {
    test: new ConfidenceFlag({
      flag: 'test',
      variant: 'test',
      value: {
        bool: true,
        str: 'base string',
        double: 1.1,
        int: 1,
        obj: {
          bool: true,
          str: 'obj string',
          double: 2.1,
          int: 2,
          obj: {
            bool: true,
            str: 'obj obj string',
            double: 3.1,
            int: 3,
          },
        },
      },
      flagSchema: {
        schema: {
          bool: {
            boolSchema: {},
          },
          str: {
            stringSchema: {},
          },
          double: {
            doubleSchema: {},
          },
          int: {
            intSchema: {},
          },
          obj: {
            structSchema: {
              schema: {
                bool: {
                  boolSchema: {},
                },
                str: {
                  stringSchema: {},
                },
                double: {
                  doubleSchema: {},
                },
                int: {
                  intSchema: {},
                },
                obj: {
                  structSchema: {
                    schema: {
                      bool: {
                        boolSchema: {},
                      },
                      str: {
                        stringSchema: {},
                      },
                      double: {
                        doubleSchema: {},
                      },
                      int: {
                        intSchema: {},
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      reason: Configuration.ResolveReason.Match,
    }),
    emptyFlag: new ConfidenceFlag({
      flag: 'emptyFlag',
      variant: '',
      reason: Configuration.ResolveReason.NoSegmentMatch,
    }),
  },
  resolveToken: 'test-token',
  context: {},
};

describe('Configuration', () => {
  it.each`
    path                        | expectedValue
    ${['bool']}                 | ${true}
    ${['str']}                  | ${'base string'}
    ${['double']}               | ${1.1}
    ${['int']}                  | ${1}
    ${['obj', 'bool']}          | ${true}
    ${['obj', 'str']}           | ${'obj string'}
    ${['obj', 'double']}        | ${2.1}
    ${['obj', 'int']}           | ${2}
    ${['obj', 'obj', 'bool']}   | ${true}
    ${['obj', 'obj', 'str']}    | ${'obj obj string'}
    ${['obj', 'obj', 'double']} | ${3.1}
    ${['obj', 'obj', 'int']}    | ${3}
    ${['obj', 'obj']}           | ${{ bool: true, str: 'obj obj string', double: 3.1, int: 3 }}
    ${['obj']}                  | ${{ bool: true, str: 'obj string', double: 2.1, int: 2, obj: { bool: true, str: 'obj obj string', double: 3.1, int: 3 } }}
  `('should get "$expectedValue" for path $path', ({ path, expectedValue }) => {
    expect(fakeConfiguration.flags.test.getValue(...path)?.value).toEqual(expectedValue);
  });

  describe('emptyFlag', () => {
    it('should return a value of null', () => {
      expect(fakeConfiguration.flags.emptyFlag.getValue('nothing')?.value).toEqual(null);
    });
  });

  describe('parseError', () => {
    it('should return null info', () => {
      expect(fakeConfiguration.flags.test.getValue('404')).toEqual(null);
    });
  });
});
