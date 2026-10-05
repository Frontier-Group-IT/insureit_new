let installed = false;

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

/**
 * React Native/Android does not reliably support fetch(file://...) or
 * fetch(content://...) for documents returned by expo-document-picker.
 *
 * Customer policy upload code intentionally uses ArrayBuffer because that is
 * the Supabase Storage compatible payload on React Native. This shim keeps the
 * normal network fetch untouched, but reads local picker URIs through React
 * Native's XMLHttpRequest bridge and exposes the same Response.arrayBuffer()
 * contract to the existing upload paths.
 */
export function installLocalDocumentFetchSupport() {
  if (installed || typeof globalThis.fetch !== 'function' || typeof XMLHttpRequest === 'undefined') return;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: FetchInput, init?: FetchInit) => {
    const uri = fetchUri(input);
    const method = String(init?.method ?? 'GET').toUpperCase();

    if (!uri || method !== 'GET' || !isLocalDocumentUri(uri)) {
      return originalFetch(input, init);
    }

    try {
      const body = await readLocalDocumentAsArrayBuffer(uri);
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      });
    } catch (error) {
      console.warn('[customer-document-upload] Local file read failed', {
        scheme: uri.split(':', 1)[0] || 'unknown',
        error: errorMessage(error),
      });
      throw error;
    }
  }) as typeof fetch;

  installed = true;
}

export function readLocalDocumentAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', uri, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) {
        reject(new Error(`Local document read returned status ${xhr.status}`));
        return;
      }
      if (xhr.response instanceof ArrayBuffer) {
        resolve(xhr.response);
        return;
      }
      reject(new Error('Local document did not return binary data'));
    };
    xhr.onerror = () => reject(new Error('Local document could not be read'));
    xhr.ontimeout = () => reject(new Error('Local document read timed out'));
    xhr.timeout = 30_000;
    xhr.send(null);
  });
}

function fetchUri(input: FetchInput) {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.toString();
  const requestUrl = (input as { url?: unknown })?.url;
  return typeof requestUrl === 'string' ? requestUrl : null;
}

function isLocalDocumentUri(uri: string) {
  return uri.startsWith('file://') || uri.startsWith('content://');
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
