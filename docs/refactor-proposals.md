# Refactor Proposals

This document lists follow-up refactors that were intentionally not implemented in the current pass.

## D7: Chunk Boundary Byte Accounting

Current parsers compare JavaScript string length with protocol byte counts in a few paths. This can be wrong for non-ASCII text because UTF-16 code units are not bytes.

Proposed approach:

1. Capture real NotebookLM chunked and streaming responses that contain Japanese text and emoji.
2. Store sanitized fixtures with auth tokens, cookies, notebook IDs, and user text removed.
3. Add characterization tests for current parser output on those fixtures.
4. Replace string-length boundary checks with `TextEncoder` byte counts or byte-buffer parsing.
5. Verify the same fixtures still parse to the expected structures.

Required sample data:

- A chunked batchexecute response containing Japanese text.
- A streaming chat response split across chunks with Japanese text.
- A response containing emoji near a frame boundary.

## D12: Parser Consolidation And Typed Wire Access

The codebase currently has multiple parser paths for related batchexecute and streaming formats. They should not be merged without a response corpus.

Proposed staged design:

1. Build a sanitized fixture corpus per RPC method.
2. Add a shared low-level frame decoder that only handles transport framing.
3. Keep method-specific response extraction separate at first.
4. Introduce typed accessor helpers for positional arrays, such as `readStringAt`, `readArrayAt`, and `readNullableAt`.
5. Move payload construction into small per-RPC builder functions after payload equivalence tests exist.
6. Only then consider replacing older parser implementations.

Non-goals for the current package line:

- Changing RPC payload shapes.
- Changing accepted response forms without fixture proof.
- Removing legacy exports from `src/index.ts`.

## D8: OpenStax Notebook Filter

`notebooks.list()` previously contained a hard-coded filter for notebooks whose title includes `OpenStax's Biology`.

Resolution:

- Removed the filter after Q1 approval in `f1e21e4`.
- Mention the observable behavior change in release notes.

Current status:

- Implemented. Keep this behavior covered by the notebook list characterization tests.

## credentials.json Storage Location

The current credential path is `credentials.json` in the caller's current working directory. This is preserved for compatibility.

Proposed migration:

1. Keep reading the current cwd file first for one major version.
2. Add an opt-in config path and an OS user-config default.
3. When saving, prefer the configured or OS path for new users.
4. Emit a deprecation warning only when reading from cwd.
5. Remove cwd writes in a future major version, while keeping a documented import/migration command.

## Logger Injection

Logging currently uses direct `console.*` calls with several debug-gate conventions.

Proposed approach:

1. Define a small internal logger interface with `debug`, `info`, `warn`, and `error`.
2. Add a client-level optional logger while preserving current console behavior by default.
3. Convert service files incrementally, starting with auth, refresh, generation, and artifacts.
4. Keep `NOTEBOOKLM_DEBUG` semantics unchanged unless a major version explicitly changes them.

## Fetch AbortSignal And Timeouts

Several fetch and streaming paths do not have explicit abort handling.

Proposed approach:

1. Add timeout options to internal config with current behavior preserved by default.
2. Use `AbortController` in `BatchExecuteClient` and streaming chat.
3. Add tests with stubbed fetch promises to prove timeout cancellation.
4. Document which operations are safe to retry after timeout.

## Legacy Export Deprecation Plan

The package has legacy exports that are still public API.

Proposed approach:

1. Keep all current exports in the v2 line.
2. Add JSDoc `@deprecated` notices where replacements are already stable.
3. Publish a migration table in release notes.
4. Remove legacy exports only in the next major version.
