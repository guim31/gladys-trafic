// -----------------------------------------------------------------------------
// HTTP downloads of the open data portals: a timeout on every request, a size
// cap on every body (the sandbox has 256 MB), and conditional requests
// (ETag / If-None-Match, or Last-Modified / If-Modified-Since) when the server
// supports them.
//
// `fetch` is injectable: the tests never touch the network.
// -----------------------------------------------------------------------------

export const USER_AGENT = 'gladys-trafic (+https://github.com/guim31/gladys-trafic)';

export class HttpError extends Error {
  constructor(message, status = null, retryAfterMs = null) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** The Retry-After header of a 429 or a 503, in ms (seconds or an HTTP date). */
export function retryAfterMs(response) {
  const value = response.headers?.get?.('retry-after');
  if (!value) {
    return null;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

/**
 * Host of a URL, for messages and logs: never the path nor the query string,
 * where some operators put a public key (`?apiKey=…`).
 */
export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown host';
  }
}

/** Reads a body chunk by chunk, `onChunk(bytes)` for each one, within `maxBytes`. */
async function readChunks(response, url, maxBytes, onChunk) {
  const declared = Number(response.headers?.get?.('content-length'));
  if (declared > maxBytes) {
    await response.body?.cancel?.().catch(() => {});
    throw new HttpError(`${hostOf(url)}: response too large (${declared} bytes)`);
  }
  if (!response.body?.getReader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new HttpError(`${hostOf(url)}: response too large`);
    }
    onChunk(buffer);
    return;
  }
  const reader = response.body.getReader();
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new HttpError(`${hostOf(url)}: response too large`);
    }
    try {
      onChunk(value);
    } catch (err) {
      await reader.cancel().catch(() => {});
      throw err;
    }
  }
}

async function readCapped(response, url, maxBytes) {
  const chunks = [];
  await readChunks(response, url, maxBytes, (chunk) => chunks.push(chunk));
  return Buffer.concat(chunks);
}

/**
 * GET a body into memory. With `etag`, a 304 resolves `{ notModified: true }`.
 * @returns {Promise<{ body: Buffer|null, etag: string|null, notModified: boolean }>}
 */
export async function getBuffer(fetchImpl, url, options = {}) {
  const response = await open(fetchImpl, url, options);
  if (response.status === 304) {
    return { body: null, etag: options.etag ?? null, notModified: true };
  }
  const body = await readCapped(response, url, options.maxBytes ?? 20e6);
  return { body, etag: response.headers?.get?.('etag') ?? null, notModified: false };
}

/**
 * GET a text document without holding it whole: `onText(text)` receives it
 * piece by piece, decoded as UTF-8 (a large file of which a few records are
 * kept). With `since` (a Last-Modified date), a 304 resolves
 * `{ notModified: true }` and calls nothing. (The ETag of a gzipped Apache
 * answer never matches: Apache adds "-gzip" to it, then compares without.)
 * @returns {Promise<{ lastModified: string|null, notModified: boolean }>}
 */
export async function streamText(fetchImpl, url, options = {}, onText) {
  const response = await open(fetchImpl, url, { accept: 'application/xml', ...options });
  if (response.status === 304) {
    return { lastModified: options.since ?? null, notModified: true };
  }
  const decoder = new TextDecoder('utf-8');
  await readChunks(response, url, options.maxBytes ?? 20e6, (chunk) =>
    onText(decoder.decode(chunk, { stream: true })),
  );
  onText(decoder.decode());
  return { lastModified: response.headers?.get?.('last-modified') ?? null, notModified: false };
}

/** Sends a GET; resolves the response when 2xx or 304, throws an HttpError otherwise. */
async function open(
  fetchImpl,
  url,
  { timeoutMs = 20000, etag = null, since = null, accept = 'application/json' } = {},
) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept,
        ...(etag ? { 'if-none-match': etag } : {}),
        ...(since ? { 'if-modified-since': since } : {}),
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err?.message);
    throw new HttpError(`${hostOf(url)}: ${reason}`);
  }
  if (response.status === 304) {
    await response.body?.cancel?.().catch(() => {});
    return response;
  }
  if (!response.ok) {
    await response.body?.cancel?.().catch(() => {});
    throw new HttpError(
      `${hostOf(url)}: HTTP ${response.status}`,
      response.status,
      retryAfterMs(response),
    );
  }
  return response;
}

/** Parses a JSON body, or says which host sent something else. */
export function parseJson(body, url) {
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new HttpError(`${hostOf(url)}: invalid JSON`);
  }
}

/** GET a JSON document. */
export async function getJson(fetchImpl, url, options = {}) {
  const { body } = await getBuffer(fetchImpl, url, options);
  return parseJson(body, url);
}
