import { Value } from './Value';

/**
 * Interface that describes a Contextual
 * @public
 */
export interface Contextual<Self extends Contextual<Self>> {
  /** Returns context of the current Confidence instance */
  getContext(): Context;
  /** Set Confidence context */
  setContext(context: Context): void;
  /**
   * Creates a new Confidence instance with context
   * @param context - Confidence context
   * @returns Confidence instance
   */
  withContext(context: Context): Self;
  /** Clears context of current Confidence instance */
  clearContext(): void;
}

/**
 * Confidence context
 * @public
 */
export interface Context extends Value.Struct {
  /** Visitor id */
  visitor_id?: string;
  /** Targeting key */
  targeting_key?: string;
  /** Page metadata */
  page?: {
    path: string;
    referrer: string;
    search: string;
    title: string;
    url: string;
  };
}
