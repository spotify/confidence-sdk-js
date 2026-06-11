# csr-common

Shared types, event definitions, and utilities for the Confidence session recording SDK. This package is a foundation dependency — most consumers should use `@spotify-confidence/session-recording` directly.

## What's in here

- **Event types** — `RecordingEvent`, `RecordingEventType`, `IncrementalSource`, and custom event data types used across the recording pipeline.
- **Validation** — `validateKey`, `validateTagValue`, `validateMeasureValue` for custom tags and measurements.
- **Uploader** — `createUploader` factory and WebSocket transport for streaming recording frames to the Confidence backend. Available via the `csr-common/uploader` subpath export.
- **Client context** — `collectUserAgentContext` for auto-collecting browser/OS/screen metadata.

## License

Apache 2.0 — see [LICENSE](../../LICENSE).
