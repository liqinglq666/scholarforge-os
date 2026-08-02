import { describe, expect, it } from 'vitest';
import { compareRevisionTexts, revisionChangeCounts } from '@/lib/project/revisions';

describe('compareRevisionTexts', () => {
  it('ignores whitespace-only changes', () => {
    expect(compareRevisionTexts('The sample included 42 participants.', '  The sample   included 42 participants.  ')).toEqual([]);
  });

  it('detects modified and added sentences', () => {
    const changes = compareRevisionTexts(
      'The sample included 42 participants. The results prove the hypothesis.',
      'The sample included 42 participants. The results support the hypothesis. A limitation was added.',
    );
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({ kind: 'modified', before: 'The results prove the hypothesis.', after: 'The results support the hypothesis.' });
    expect(changes[1]).toMatchObject({ kind: 'added', after: 'A limitation was added.' });
    expect(revisionChangeCounts(changes)).toEqual({ added: 1, removed: 0, modified: 1 });
  });

  it('detects removed content', () => {
    const changes = compareRevisionTexts('Sentence one. Sentence two.', 'Sentence one.');
    expect(changes).toEqual([expect.objectContaining({ kind: 'removed', before: 'Sentence two.', after: '' })]);
  });
});
