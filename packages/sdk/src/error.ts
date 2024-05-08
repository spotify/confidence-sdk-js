type Step = string | number;
export class TypeMismatchError {
  constructor(
    readonly expected: string,
    readonly actual: string | undefined = undefined,
    private readonly steps: Array<Step> = [],
  ) {}

  get path(): string {
    return this.steps.reduce<string>((path, step) => {
      if (typeof step === 'string') {
        if (path) {
          return `${path}.${step}`;
        }
        return step;
      }
      return `${path}[${step}]`;
    }, '');
  }
  get message(): string {
    let message: string;
    if (this.expected) {
      message = `Expected ${this.expected}`;
      if (this.actual) {
        message += `, but found ${this.actual}`;
      }
    } else {
      message = `Unexpected ${this.actual}`;
    }
    if (this.steps.length) {
      message += `, at path '${this.path}'`;
    }
    return message;
  }

  /**
   * @internal
   *
   * @param step
   * @param fn
   * @returns
   */
  static hoist<T>(step: Step | Step[], fn: () => T): T {
    if (!Array.isArray(step)) {
      // eslint-disable-next-line no-param-reassign
      step = [step];
    }
    try {
      return fn();
    } catch (err) {
      if (err instanceof TypeMismatchError) {
        // eslint-disable-next-line no-ex-assign
        err = new TypeMismatchError(err.expected, err.actual, [...step, ...err.steps]);
      }
      throw err;
    }
  }
}
