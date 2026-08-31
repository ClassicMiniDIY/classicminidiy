/**
 * Types for the CMDIY Assistant UI.
 *
 * Almost everything that used to live here — `Message`, `Thread`, `ToolCall`,
 * `Configuration`, `UseStreamContextProvider`, the per-component prop
 * interfaces — described the LangGraph SDK's wire format and the hand-rolled
 * stream session built on top of it. Both are gone: the agent runs in this
 * Worker and the AI SDK owns the message shape, so components take `UIMessage`
 * from `ai` directly rather than a local restatement of it that could drift.
 *
 * What remains is the one type that is genuinely ours.
 */

export interface MarkdownTextProps {
  content: string;
  showCursor?: boolean;
}
