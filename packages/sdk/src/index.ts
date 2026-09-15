// Named explicitly rather than `export *`, so this surface stays deliberate.
// ConfidenceClient carries its Options, Event and WriteResult types in a merged namespace.
export { ConfidenceClient, EvaluationContext } from './ConfidenceClient';
export { FlagBundle } from './FlagBundle';
export type { Logger } from './logger';
export { publishFlagEvaluation } from './flag-evaluation-global';
