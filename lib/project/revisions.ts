import type { RevisionChange, RevisionChangeKind } from '@/lib/types';

interface DiffOperation {
  type: 'equal' | 'removed' | 'added';
  text: string;
}

function normalizeUnit(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function splitRevisionUnits(text: string) {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n\s*\n+/);
  const units = paragraphs.flatMap((paragraph) => {
    const matches = paragraph.match(/[^.!?。！？\n]+(?:[.!?。！？]+|$)/g) || [paragraph];
    return matches.map((item) => item.trim()).filter(Boolean);
  });
  return units.slice(0, 400);
}

function buildOperations(baseUnits: string[], revisedUnits: string[]) {
  const rows = baseUnits.length + 1;
  const columns = revisedUnits.length + 1;
  const table = Array.from({ length: rows }, () => new Uint16Array(columns));

  for (let i = baseUnits.length - 1; i >= 0; i -= 1) {
    for (let j = revisedUnits.length - 1; j >= 0; j -= 1) {
      table[i][j] = normalizeUnit(baseUnits[i]) === normalizeUnit(revisedUnits[j])
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const operations: DiffOperation[] = [];
  let i = 0;
  let j = 0;
  while (i < baseUnits.length && j < revisedUnits.length) {
    if (normalizeUnit(baseUnits[i]) === normalizeUnit(revisedUnits[j])) {
      operations.push({ type: 'equal', text: revisedUnits[j] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      operations.push({ type: 'removed', text: baseUnits[i] });
      i += 1;
    } else {
      operations.push({ type: 'added', text: revisedUnits[j] });
      j += 1;
    }
  }
  while (i < baseUnits.length) operations.push({ type: 'removed', text: baseUnits[i++] });
  while (j < revisedUnits.length) operations.push({ type: 'added', text: revisedUnits[j++] });
  return operations;
}

function createChange(index: number, kind: RevisionChangeKind, before = '', after = ''): RevisionChange {
  return {
    id: `revision-change-${index + 1}`,
    kind,
    before,
    after,
    source: 'unknown',
    reason: '',
  };
}

export function compareRevisionTexts(baseText: string, revisedText: string) {
  const baseUnits = splitRevisionUnits(baseText);
  const revisedUnits = splitRevisionUnits(revisedText);
  const operations = buildOperations(baseUnits, revisedUnits);
  const changes: RevisionChange[] = [];
  let cursor = 0;

  while (cursor < operations.length) {
    if (operations[cursor].type === 'equal') {
      cursor += 1;
      continue;
    }

    const removed: string[] = [];
    const added: string[] = [];
    while (cursor < operations.length && operations[cursor].type !== 'equal') {
      if (operations[cursor].type === 'removed') removed.push(operations[cursor].text);
      if (operations[cursor].type === 'added') added.push(operations[cursor].text);
      cursor += 1;
    }

    const paired = Math.min(removed.length, added.length);
    for (let index = 0; index < paired; index += 1) {
      changes.push(createChange(changes.length, 'modified', removed[index], added[index]));
    }
    for (let index = paired; index < removed.length; index += 1) {
      changes.push(createChange(changes.length, 'removed', removed[index], ''));
    }
    for (let index = paired; index < added.length; index += 1) {
      changes.push(createChange(changes.length, 'added', '', added[index]));
    }
  }

  return changes.slice(0, 300);
}

export function revisionChangeCounts(changes: RevisionChange[]) {
  return changes.reduce((counts, change) => {
    counts[change.kind] += 1;
    return counts;
  }, { added: 0, removed: 0, modified: 0 });
}
