import { describe, expect, it } from 'vitest';
import { inferSectionType, validateDocxFile } from '@/lib/documents/docx';

describe('DOCX import boundaries', () => {
  it('recognizes common scientific section headings', () => {
    expect(inferSectionType('2. Materials and Methods')).toBe('methods');
    expect(inferSectionType('结论')).toBe('conclusion');
    expect(inferSectionType('Custom note')).toBe('general');
  });

  it('rejects unsupported files', () => {
    expect(() => validateDocxFile(new File(['x'], 'paper.pdf', { type: 'application/pdf' }))).toThrow(/仅支持/);
    expect(() => validateDocxFile(new File([], 'paper.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))).toThrow(/为空/);
  });
});
