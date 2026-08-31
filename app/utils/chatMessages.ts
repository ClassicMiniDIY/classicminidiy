import type { UIMessage } from 'ai';

/**
 * Read the visible text out of an AI SDK UI message.
 *
 * Messages are `{ id, role, parts[] }`, where parts carry text, tool calls,
 * reasoning and more. Only text parts are rendered as prose — a tool part's
 * payload is structured data that belongs in the links rail or a tool affordance,
 * never concatenated into the answer.
 *
 * Shared by both message components so "what counts as the text of a message"
 * has one definition. The copy button, the streaming-cursor check and the
 * history title all depend on it agreeing.
 */
export function messageText(message: Pick<UIMessage, 'parts'> | undefined | null): string {
  if (!message?.parts) return '';
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => (part as any)?.type === 'text')
    .map((part) => part.text)
    .join('\n');
}
