import { describe, expect, it } from 'vitest';
import { analyzeProjectConsistency } from '@/lib/project/consistency';
import { createManuscriptChapter, createManuscriptProject } from '@/lib/workspace/schema';

describe('project consistency analysis', () => {
  it('reports sample-size and metric candidates across chapters', () => {
    const project = createManuscriptProject({
      chapters: [
        createManuscriptChapter({
          title: 'Methods',
          sectionType: 'methods',
          text: 'A total of 126 participants were included. The compressive strength was 42.5 MPa after 28 days.',
        }),
        createManuscriptChapter({
          title: 'Results',
          sectionType: 'results',
          text: 'The final analysis used n = 118. The compressive strength was 45.0 MPa after 28 days.',
        }),
      ],
    });

    const issues = analyzeProjectConsistency(project);
    expect(issues.some((issue) => issue.type === 'sample-size' && issue.severity === 'major')).toBe(true);
    expect(issues.some((issue) => issue.type === 'metric-value' && issue.title.includes('42.5'))).toBe(true);
  });

  it('reports conflicting and undefined abbreviations', () => {
    const project = createManuscriptProject({
      chapters: [
        createManuscriptChapter({ title: 'Methods', text: 'The convolutional neural network (CNN) was trained. CNN performance was recorded.' }),
        createManuscriptChapter({ title: 'Discussion', text: 'The clinical needs network (CNN) was discussed. XAI improved interpretation. XAI was used again.' }),
        createManuscriptChapter({ title: 'Conclusion', text: 'XAI may support future analysis.' }),
      ],
    });

    const issues = analyzeProjectConsistency(project);
    expect(issues.some((issue) => issue.title.includes('CNN') && issue.severity === 'major')).toBe(true);
    expect(issues.some((issue) => issue.title.includes('XAI') && issue.severity === 'suggestion')).toBe(true);
  });

  it('uses project terminology locks without changing chapter text', () => {
    const source = 'neural net';
    const project = createManuscriptProject({
      terminologyLocks: [{ id: 'term-1', source, preferred: 'neural network (NN)' }],
      chapters: [
        createManuscriptChapter({ title: 'Introduction', text: 'The neural net was evaluated on three public datasets and compared with a conventional baseline.' }),
      ],
    });

    const issues = analyzeProjectConsistency(project);
    expect(issues.some((issue) => issue.type === 'terminology' && issue.title.includes(source))).toBe(true);
    expect(project.chapters[0].text).toContain(source);
  });
});
