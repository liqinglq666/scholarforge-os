const DATABASE_NAME = 'scholarforge-os-original-docx';
const DATABASE_VERSION = 1;
const DOCUMENT_STORE = 'documents';
const BINDING_STORE = 'bindings';
const MAX_STORED_DOCUMENTS = 6;

export interface StoredOriginalDocxMeta {
  id: string;
  fileName: string;
  size: number;
  importedAt: string;
}

export interface StoredOriginalDocx extends StoredOriginalDocxMeta {
  mimeType: string;
  bytes: ArrayBuffer;
}

export interface OriginalDocxBinding {
  fingerprint: string;
  documentId: string;
  fileName: string;
  sectionTitle: string;
  sourceLabel: string;
  boundAt: string;
}

function requestAsPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction was aborted.'));
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB，无法保留原始 DOCX。'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
        const documents = database.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' });
        documents.createIndex('importedAt', 'importedAt');
      }
      if (!database.objectStoreNames.contains(BINDING_STORE)) {
        const bindings = database.createObjectStore(BINDING_STORE, { keyPath: 'fingerprint' });
        bindings.createIndex('documentId', 'documentId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开原始 DOCX 本地存储。'));
  });
}

function normalizeSource(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim();
}

async function fingerprintSource(value: string) {
  const normalized = normalizeSource(value);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fallback-${(hash >>> 0).toString(16)}-${normalized.length}`;
}

async function removeDocument(database: IDBDatabase, documentId: string) {
  const transaction = database.transaction([DOCUMENT_STORE, BINDING_STORE], 'readwrite');
  transaction.objectStore(DOCUMENT_STORE).delete(documentId);
  const bindingIndex = transaction.objectStore(BINDING_STORE).index('documentId');
  const keys = await requestAsPromise(bindingIndex.getAllKeys(IDBKeyRange.only(documentId)));
  keys.forEach((key) => transaction.objectStore(BINDING_STORE).delete(key));
  await transactionDone(transaction);
}

async function cleanupOldDocuments(database: IDBDatabase) {
  const transaction = database.transaction(DOCUMENT_STORE, 'readonly');
  const documents = await requestAsPromise(transaction.objectStore(DOCUMENT_STORE).getAll()) as StoredOriginalDocx[];
  await transactionDone(transaction);
  const oldDocuments = documents
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt))
    .slice(MAX_STORED_DOCUMENTS);
  for (const document of oldDocuments) await removeDocument(database, document.id);
}

export async function saveOriginalDocx(file: File): Promise<StoredOriginalDocxMeta> {
  if (!file.name.toLowerCase().endsWith('.docx')) throw new Error('只有 DOCX 文件可以保留原始包。');
  const database = await openDatabase();
  try {
    const record: StoredOriginalDocx = {
      id: globalThis.crypto?.randomUUID?.() || `docx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      fileName: file.name,
      mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: file.size,
      importedAt: new Date().toISOString(),
      bytes: await file.arrayBuffer(),
    };
    const transaction = database.transaction(DOCUMENT_STORE, 'readwrite');
    transaction.objectStore(DOCUMENT_STORE).put(record);
    await transactionDone(transaction);
    await cleanupOldDocuments(database);
    return { id: record.id, fileName: record.fileName, size: record.size, importedAt: record.importedAt };
  } finally {
    database.close();
  }
}

export async function bindOriginalDocxSource(
  document: StoredOriginalDocxMeta,
  sourceText: string,
  sectionTitle: string,
  sourceLabel: string,
) {
  const database = await openDatabase();
  try {
    const fingerprint = await fingerprintSource(sourceText);
    const binding: OriginalDocxBinding = {
      fingerprint,
      documentId: document.id,
      fileName: document.fileName,
      sectionTitle,
      sourceLabel,
      boundAt: new Date().toISOString(),
    };
    const transaction = database.transaction(BINDING_STORE, 'readwrite');
    transaction.objectStore(BINDING_STORE).put(binding);
    await transactionDone(transaction);
    return binding;
  } finally {
    database.close();
  }
}

export async function findOriginalDocxBinding(sourceText: string) {
  const database = await openDatabase();
  try {
    const fingerprint = await fingerprintSource(sourceText);
    const transaction = database.transaction(BINDING_STORE, 'readonly');
    const binding = await requestAsPromise(transaction.objectStore(BINDING_STORE).get(fingerprint)) as OriginalDocxBinding | undefined;
    await transactionDone(transaction);
    return binding || null;
  } finally {
    database.close();
  }
}

export async function loadOriginalDocx(documentId: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DOCUMENT_STORE, 'readonly');
    const document = await requestAsPromise(transaction.objectStore(DOCUMENT_STORE).get(documentId)) as StoredOriginalDocx | undefined;
    await transactionDone(transaction);
    return document || null;
  } finally {
    database.close();
  }
}

export async function deleteOriginalDocx(documentId: string) {
  const database = await openDatabase();
  try {
    await removeDocument(database, documentId);
  } finally {
    database.close();
  }
}
