import { describe, expect, it } from 'vitest';
import {
  inspectDocxArchive,
  MAX_DOCX_ARCHIVE_ENTRIES,
  MAX_DOCX_UNCOMPRESSED_BYTES,
} from '@/lib/documents/docx-archive';

interface EntrySpec {
  name: string;
  uncompressedSize: number;
  flags?: number;
}

function concat(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function centralEntry(spec: EntrySpec) {
  const name = new TextEncoder().encode(spec.name);
  const bytes = new Uint8Array(46 + name.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, spec.flags || 0, true);
  view.setUint16(10, 8, true);
  view.setUint32(20, Math.min(spec.uncompressedSize, 1024), true);
  view.setUint32(24, spec.uncompressedSize, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint32(42, 0, true);
  bytes.set(name, 46);
  return bytes;
}

function fakeArchive(entries: EntrySpec[], totalEntriesOverride?: number) {
  const centralDirectory = concat(entries.map(centralEntry));
  const totalEntries = totalEntriesOverride ?? entries.length;
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, totalEntries, true);
  view.setUint16(10, totalEntries, true);
  view.setUint32(12, centralDirectory.length, true);
  view.setUint32(16, 0, true);
  view.setUint16(20, 0, true);
  return concat([centralDirectory, eocd]).buffer;
}

const coreEntries: EntrySpec[] = [
  { name: '[Content_Types].xml', uncompressedSize: 1_024 },
  { name: 'word/document.xml', uncompressedSize: 8_192 },
];

describe('DOCX ZIP archive preflight', () => {
  it('accepts a bounded archive with the required DOCX core entries', () => {
    const result = inspectDocxArchive(fakeArchive(coreEntries));

    expect(result.entryCount).toBe(2);
    expect(result.declaredUncompressedBytes).toBe(9_216);
  });

  it('rejects archives whose declared uncompressed content exceeds the safety limit', () => {
    const archive = fakeArchive([
      { name: '[Content_Types].xml', uncompressedSize: 1_024 },
      { name: 'word/document.xml', uncompressedSize: MAX_DOCX_UNCOMPRESSED_BYTES },
    ]);

    expect(() => inspectDocxArchive(archive)).toThrow(/解压后的声明内容超过/);
  });

  it('rejects files that are ZIP-shaped but do not contain the required DOCX structure', () => {
    const archive = fakeArchive([
      { name: '[Content_Types].xml', uncompressedSize: 1_024 },
      { name: 'word/styles.xml', uncompressedSize: 2_048 },
    ]);

    expect(() => inspectDocxArchive(archive)).toThrow(/缺少标准 DOCX 核心结构/);
  });

  it('rejects encrypted archive entries before decompression', () => {
    const archive = fakeArchive([
      coreEntries[0],
      { ...coreEntries[1], flags: 0x0001 },
    ]);

    expect(() => inspectDocxArchive(archive)).toThrow(/加密|密码保护/);
  });

  it('rejects an excessive entry count before walking the central directory', () => {
    const archive = fakeArchive(coreEntries, MAX_DOCX_ARCHIVE_ENTRIES + 1);

    expect(() => inspectDocxArchive(archive)).toThrow(/内部文件数量超过/);
  });
});
