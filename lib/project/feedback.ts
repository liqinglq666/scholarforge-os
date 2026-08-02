const ITEM_PREFIX = /^(?:[-*•·]|(?:\d{1,3}|[一二三四五六七八九十]{1,3})[.、)]|[（(]\d{1,3}[)）])\s*/;

function cleanFeedbackItem(value: string) {
  return value
    .replace(ITEM_PREFIX, '')
    .replace(/^导师(?:意见|建议)?\s*[：:]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3_000);
}

export function splitSupervisorFeedback(input: string) {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const items: string[] = [];
  let current: string[] = [];

  function flush() {
    const item = cleanFeedbackItem(current.join(' '));
    if (item) items.push(item);
    current = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    if (ITEM_PREFIX.test(line) && current.length) flush();
    current.push(line);
  }
  flush();

  if (items.length <= 1) {
    const paragraphs = input
      .replace(/\r\n?/g, '\n')
      .split(/\n\s*\n+/)
      .map(cleanFeedbackItem)
      .filter(Boolean);
    if (paragraphs.length > items.length) return paragraphs.slice(0, 120);
  }

  return items.slice(0, 120);
}
