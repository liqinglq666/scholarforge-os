import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/review/route';
import { MAX_REQUEST_BYTES } from '@/lib/config';
import {
  readRequestTextWithLimit,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body';

function streamRequest(chunks: Uint8Array[], onCancel?: () => void) {
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (!chunk) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    },
    cancel() {
      onCancel?.();
    },
  });
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    body: stream,
    duplex: 'half',
  };
  return new Request('http://localhost/api/review', init);
}

afterEach(() => {
  delete process.env.DASHSCOPE_API_KEY;
  vi.restoreAllMocks();
});

describe('streaming request body limits', () => {
  it('preserves UTF-8 text when a multibyte character is split across chunks', async () => {
    const source = JSON.stringify({ text: '科研安全检查' });
    const encoded = new TextEncoder().encode(source);
    const splitAt = encoded.indexOf(0xe7) + 1;
    const request = streamRequest([
      encoded.slice(0, splitAt),
      encoded.slice(splitAt, splitAt + 1),
      encoded.slice(splitAt + 1),
    ]);

    await expect(readRequestTextWithLimit(request, encoded.byteLength)).resolves.toBe(source);
  });

  it('cancels the body stream and throws as soon as the byte limit is exceeded', async () => {
    const cancelled = vi.fn();
    const request = streamRequest([
      new Uint8Array(6).fill(65),
      new Uint8Array(5).fill(66),
      new Uint8Array(100).fill(67),
    ], cancelled);

    await expect(readRequestTextWithLimit(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('returns 413 for an oversized streamed API request without relying on Content-Length', async () => {
    const prefix = new TextEncoder().encode('{"text":"');
    const oversized = new Uint8Array(MAX_REQUEST_BYTES + 1).fill(65);
    const request = streamRequest([prefix, oversized]);

    expect(request.headers.get('content-length')).toBeNull();
    const response = await POST(request);
    const payload = await response.json() as { code?: string };

    expect(response.status).toBe(413);
    expect(payload.code).toBe('REQUEST_TOO_LARGE');
  });
});
