export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function cleanSingleLine(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, maxLength)
    : '';
}

export function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim().slice(0, maxLength)
    : '';
}

export function hasDangerousPlaceholder(value: string) {
  return /\[(?:please\s+provide|insert|todo|tbd|author\s+to)[^\]]*\]/i.test(value)
    || /<\s*(?:insert|todo|tbd)[^>]*>/i.test(value);
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}
