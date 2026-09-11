import { expectTypeOf } from 'vitest';
import type { CreateUploaderOptions } from './types';

type ForceRecordKey = Extract<keyof CreateUploaderOptions, 'forceRecord'>;

expectTypeOf<ForceRecordKey>().toEqualTypeOf<never>();
