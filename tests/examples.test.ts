import { describe, expect, it } from 'vitest';
import { RESEARCH_EXAMPLES, findResearchExample } from '@/lib/examples';

const taskTypes = new Set(RESEARCH_EXAMPLES.map((example) => example.taskType));

describe('research examples', () => {
  it('covers every supported task with multiple disciplines', () => {
    expect(taskTypes).toEqual(new Set(['translate', 'polish', 'precheck']));
    expect(new Set(RESEARCH_EXAMPLES.map((example) => example.discipline)).size).toBeGreaterThanOrEqual(6);
  });

  it('uses unique ids and analysis-ready source text', () => {
    const ids = RESEARCH_EXAMPLES.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const example of RESEARCH_EXAMPLES) {
      expect(example.sourceText.length).toBeGreaterThanOrEqual(40);
      expect(example.projectName).toBeTruthy();
      expect(example.focus).toBeTruthy();
      expect(example.suggestion).toBeTruthy();
      expect(findResearchExample(example.id)).toEqual(example);
    }
  });

  it('returns null for unknown examples', () => {
    expect(findResearchExample('unknown-example')).toBeNull();
    expect(findResearchExample(null)).toBeNull();
  });
});
