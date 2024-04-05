/* eslint-disable */

export const protobufPackage = 'confidence.flags.resolver.v1';

export enum ResolveReason {
  /** RESOLVE_REASON_UNSPECIFIED - Unspecified enum. */
  RESOLVE_REASON_UNSPECIFIED = 'RESOLVE_REASON_UNSPECIFIED',
  /** RESOLVE_REASON_MATCH - The flag was successfully resolved because one rule matched. */
  RESOLVE_REASON_MATCH = 'RESOLVE_REASON_MATCH',
  /** RESOLVE_REASON_NO_SEGMENT_MATCH - The flag could not be resolved because no rule matched. */
  RESOLVE_REASON_NO_SEGMENT_MATCH = 'RESOLVE_REASON_NO_SEGMENT_MATCH',
  /**
   * RESOLVE_REASON_NO_TREATMENT_MATCH - The flag could not be resolved because the matching rule had no variant
   * that could be assigned.
   *
   * @deprecated
   */
  RESOLVE_REASON_NO_TREATMENT_MATCH = 'RESOLVE_REASON_NO_TREATMENT_MATCH',
  /** RESOLVE_REASON_FLAG_ARCHIVED - The flag could not be resolved because it was archived. */
  RESOLVE_REASON_FLAG_ARCHIVED = 'RESOLVE_REASON_FLAG_ARCHIVED',
  /** RESOLVE_REASON_TARGETING_KEY_ERROR - The flag could not be resolved because the targeting key field was invalid */
  RESOLVE_REASON_TARGETING_KEY_ERROR = 'RESOLVE_REASON_TARGETING_KEY_ERROR',
  /** RESOLVE_REASON_ERROR - Unknown error occurred during the resolve */
  RESOLVE_REASON_ERROR = 'RESOLVE_REASON_ERROR',
  UNRECOGNIZED = 'UNRECOGNIZED',
}

export enum SdkId {
  /** SDK_ID_UNSPECIFIED - Unspecified enum. */
  SDK_ID_UNSPECIFIED = 'SDK_ID_UNSPECIFIED',
  /** SDK_ID_JAVA_PROVIDER - Confidence OpenFeature Java Provider. */
  SDK_ID_JAVA_PROVIDER = 'SDK_ID_JAVA_PROVIDER',
  /** SDK_ID_KOTLIN_PROVIDER - Confidence OpenFeature Kotlin Provider. */
  SDK_ID_KOTLIN_PROVIDER = 'SDK_ID_KOTLIN_PROVIDER',
  /** SDK_ID_SWIFT_PROVIDER - Confidence OpenFeature Swift Provider. */
  SDK_ID_SWIFT_PROVIDER = 'SDK_ID_SWIFT_PROVIDER',
  /** SDK_ID_JS_WEB_PROVIDER - Confidence OpenFeature JavaScript Provider for Web (client). */
  SDK_ID_JS_WEB_PROVIDER = 'SDK_ID_JS_WEB_PROVIDER',
  /** SDK_ID_JS_SERVER_PROVIDER - Confidence OpenFeature JavaScript Provider for server. */
  SDK_ID_JS_SERVER_PROVIDER = 'SDK_ID_JS_SERVER_PROVIDER',
  /** SDK_ID_PYTHON_PROVIDER - Confidence OpenFeature Python Provider. */
  SDK_ID_PYTHON_PROVIDER = 'SDK_ID_PYTHON_PROVIDER',
  /** SDK_ID_GO_PROVIDER - Confidence OpenFeature GO Provider. */
  SDK_ID_GO_PROVIDER = 'SDK_ID_GO_PROVIDER',
  /** SDK_ID_RUBY_PROVIDER - Confidence OpenFeature Ruby Provider. */
  SDK_ID_RUBY_PROVIDER = 'SDK_ID_RUBY_PROVIDER',
  /** SDK_ID_RUST_PROVIDER - Confidence OpenFeature Rust Provider. */
  SDK_ID_RUST_PROVIDER = 'SDK_ID_RUST_PROVIDER',
  /** SDK_ID_JAVA_CONFIDENCE - Confidence Java SDK. */
  SDK_ID_JAVA_CONFIDENCE = 'SDK_ID_JAVA_CONFIDENCE',
  /** SDK_ID_KOTLIN_CONFIDENCE - Confidence Kotlin SDK. */
  SDK_ID_KOTLIN_CONFIDENCE = 'SDK_ID_KOTLIN_CONFIDENCE',
  /** SDK_ID_SWIFT_CONFIDENCE - Confidence Swift SDK. */
  SDK_ID_SWIFT_CONFIDENCE = 'SDK_ID_SWIFT_CONFIDENCE',
  /** SDK_ID_JS_CONFIDENCE - Confidence JavaScript SDK. */
  SDK_ID_JS_CONFIDENCE = 'SDK_ID_JS_CONFIDENCE',
  /** SDK_ID_PYTHON_CONFIDENCE - Confidence Python SDK. */
  SDK_ID_PYTHON_CONFIDENCE = 'SDK_ID_PYTHON_CONFIDENCE',
  /** SDK_ID_GO_CONFIDENCE - Confidence GO SDK. */
  SDK_ID_GO_CONFIDENCE = 'SDK_ID_GO_CONFIDENCE',
  UNRECOGNIZED = 'UNRECOGNIZED',
}

export interface Sdk {
  /** Name of a Confidence SDKs. */
  id?: SdkId | undefined;
  /** Custom name for non-Confidence SDKs. */
  customId?: string | undefined;
  /** Version of the SDK. */
  version: string;
}
