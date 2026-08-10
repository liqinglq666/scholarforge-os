import { MAX_DOCX_BYTES } from '@/lib/config';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const EOCD_MIN_BYTES = 22;
const MAX_ZIP_COMMENT_BYTES = 0xffff;

export const MAX_DOCX_ARCHIVE_ENTRIES = 5_000;
export const MAX_DOCX_UNCOMPRESSED_BYTES = MAX_DOCX_BYTES * 8;

export interface DocxArchiveInspection {
  entryCount: number;
  declaredUncompressedBytes: number;
}

function invalidArchive(): never {
  throw new Error('DOCX 压缩包结构无效。请重新导出为标准 .docx 后重试。');
}

function unsupportedZip64(): never {
  throw new Error('当前不支持 ZIP64 格式的 DOCX。请重新另存为标准 .docx 后重试。');
}

function findEndOfCentralDirectory(view: DataView) {
  if (view.byteLength < EOCD_MIN_BYTES) invalidArchive();
  const earliest = Math.max(0, view.byteLength - EOCD_MIN_BYTES - MAX_ZIP_COMMENT_BYTES);
  for (let offset = view.byteLength - EOCD_MIN_BYTES; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) !== EOCD_SIGNATURE) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + EOCD_MIN_BYTES + commentLength === view.byteLength) return offset;
  }
  return invalidArchive();
}

function decodeEntryName(bytes: Uint8Array) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export function inspectDocxArchive(arrayBuffer: ArrayBuffer): DocxArchiveInspection {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(view);

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  if (
    totalEntries === 0xffff
    || entriesOnDisk === 0xffff
    || centralDirectorySize === 0xffffffff
    || centralDirectoryOffset === 0xffffffff
  ) unsupportedZip64();

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new Error('不支持多卷 DOCX 压缩包。请重新另存为单个标准 .docx 文件。');
  }
  if (totalEntries === 0) invalidArchive();
  if (totalEntries > MAX_DOCX_ARCHIVE_ENTRIES) {
    throw new Error(`DOCX 内部文件数量超过 ${MAX_DOCX_ARCHIVE_ENTRIES.toLocaleString()} 个安全限制。请移除异常嵌入内容后重试。`);
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (
    centralDirectoryOffset > eocdOffset
    || centralDirectoryEnd > eocdOffset
    || centralDirectoryEnd < centralDirectoryOffset
  ) invalidArchive();

  let cursor = centralDirectoryOffset;
  let declaredUncompressedBytes = 0;
  let hasContentTypes = false;
  let hasDocumentXml = false;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > centralDirectoryEnd) invalidArchive();
    if (view.getUint32(cursor, true) !== CENTRAL_FILE_SIGNATURE) invalidArchive();

    const flags = view.getUint16(cursor + 8, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const diskStart = view.getUint16(cursor + 34, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);

    if ((flags & 0x0001) !== 0) {
      throw new Error('不支持加密或受密码保护的 DOCX。请解除保护后重试。');
    }
    if (
      compressedSize === 0xffffffff
      || uncompressedSize === 0xffffffff
      || localHeaderOffset === 0xffffffff
      || diskStart === 0xffff
    ) unsupportedZip64();
    if (diskStart !== 0) {
      throw new Error('不支持多卷 DOCX 压缩包。请重新另存为单个标准 .docx 文件。');
    }

    const fileNameStart = cursor + 46;
    const entryEnd = fileNameStart + fileNameLength + extraLength + commentLength;
    if (entryEnd > centralDirectoryEnd || entryEnd < fileNameStart) invalidArchive();

    const fileName = decodeEntryName(bytes.subarray(fileNameStart, fileNameStart + fileNameLength));
    if (fileName === '[Content_Types].xml') hasContentTypes = true;
    if (fileName === 'word/document.xml') hasDocumentXml = true;

    declaredUncompressedBytes += uncompressedSize;
    if (declaredUncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
      const limitMb = Math.floor(MAX_DOCX_UNCOMPRESSED_BYTES / 1_000_000);
      throw new Error(`DOCX 解压后的声明内容超过 ${limitMb} MB 安全限制。请移除异常大的嵌入内容或拆分文档后重试。`);
    }

    cursor = entryEnd;
  }

  if (!hasContentTypes || !hasDocumentXml) {
    throw new Error('文件缺少标准 DOCX 核心结构。请确认文件未损坏，并重新另存为 .docx 后重试。');
  }

  return {
    entryCount: totalEntries,
    declaredUncompressedBytes,
  };
}
