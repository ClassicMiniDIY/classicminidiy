# `/api/chat` stream fixtures

The parity contract between this Worker and the native Toolbox apps
(`toolbox-ios/docs/plans/2026-09-15-native-ai-chat.md`, §5.1, §6.2, §9).

Each app copies this directory verbatim into its test resources. Its SSE parser
is fed the `.sse` bytes and must produce the matching `.expected.json`, which is
the `UIMessage` the web's `useChat` stores after the same stream. Two parsers
that agree with these files agree with each other.

`tests/unit/server/fixtures/chatStreamFixtures.test.ts` re-parses every `.sse`
with the installed AI SDK, so an SDK upgrade that changes the wire format fails
here before either app finds out. Re-record after such an upgrade with:

```bash
bun run scripts/record-chat-stream-fixtures.ts
```

The recorder drives the real `streamText` → `toUIMessageStreamResponse()`
pipeline with a scripted model, so the bytes are deterministic and the two
failure cases can be produced on demand.

## Files

| File               | What it pins                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text-only`        | One step, one text part, `state: "done"`.                                                                                                           |
| `tool-call-video`  | `video-search` call, streamed input, output with three videos (two ≥ 0.4, one below), then a second step of text.                                   |
| `tool-input-error` | A tool call whose input fails the schema. Stored as `state: "output-error"` with `rawInput` (not `input`) and `errorText`; the turn still finishes. |
| `error-mid-stream` | Text, then the upstream fails. Partial text is kept with `state: "streaming"`.                                                                      |
| `quota-429.json`   | The production 429 body for an exhausted free-tier quota, with `data.{tier,used,limit,upgradeUrl}`.                                                 |

## Facts every parser must honour

- Events are `data: <json>\n\n`, terminated by `data: [DONE]\n\n`. Network
  chunks do not align with events; buffer until the blank line.
- `expected.json` has `"id": ""`. The route never supplies a message id; the
  app mints its own. Compare `role` and `parts`.
- `error` is **not** the last event. The SDK still emits `finish-step` and
  `finish` with `finishReason: "error"`. Mark the error, keep the partial text,
  and keep reading to `[DONE]`.
- `tool-input-error` is followed by a `tool-output-error` for the same
  `toolCallId`. Neither is fatal; the model is asked again and the reply
  continues in a new step.
- `finish` carries a `finishReason` string (`stop`, `error`, …). Ignore it.
- A part type not in the design doc's §6.2 subset is stored raw and never
  rendered.
