export { startPrivacyReviewRecording } from './recorder';
export type { PrivacyReviewOptions, PrivacyReviewPreviewResult, PrivacyReviewRecording } from './recorder';
import type { PrivacyReviewModule } from '../local-review';
import { mountPrivacyReviewControls } from './controls';

/** Pass as `review` to `initSessionRecorder` to review locally with that recorder's privacy options. */
export const privacyReview: PrivacyReviewModule = { mount: mountPrivacyReviewControls };

export { mountPrivacyReviewControls };
export { findPotentialPii, suggestMaskingConfig, isSpecificSelector } from './scanner';
export type { PiiFinding, PiiKind, SuggestedMaskingConfig } from './scanner';
export type { PrivacyReviewControls, PrivacyReviewControlsOptions } from './controls';
