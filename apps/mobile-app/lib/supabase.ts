import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { beginTrackedLoading, endTrackedLoading } from '@/lib/loading-tracker';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing mobile app environment configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: platformFetch,
  },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

function platformFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = requestUrl(input);
  const method = requestMethod(input, init);
  const tracked = shouldTrackRequest(url, method);
  const token = tracked ? beginTrackedLoading(requestLabel(url, method)) : null;
  const request = Platform.OS === 'web' && typeof XMLHttpRequest !== 'undefined'
    ? xhrFetch(input, init)
    : fetch(input, init);

  return request.finally(() => {
    if (!token) return;
    setTimeout(() => endTrackedLoading(token), 140);
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function shouldTrackRequest(url: string, method: string) {
  if (method === 'OPTIONS' || method === 'HEAD') return false;
  if (method === 'GET') return false;
  if (url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token')) return false;
  if (url.includes('/auth/v1/health')) return false;
  if (url.includes('/rest/v1/india_locations')) return false;
  if (url.includes('/rest/v1/notifications')) return false;
  return url.startsWith(supabaseUrl!);
}

function requestLabel(url: string, method: string) {
  if (url.includes('/storage/v1/object') && method !== 'GET') return 'Uploading document';
  if (url.includes('/rpc/')) return 'Processing request';
  if (url.includes('/auth/v1/')) return method === 'GET' ? 'Checking your session' : 'Signing you in';
  if (method === 'GET') return 'Loading page data';
  if (method === 'DELETE') return 'Deleting record';
  if (method === 'PATCH' || method === 'PUT') return 'Saving changes';
  return 'Processing request';
}

function xhrFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = input instanceof Request ? input : null;
    const url = request?.url ?? input.toString();
    const xhr = new XMLHttpRequest();
    xhr.open(init?.method ?? request?.method ?? 'GET', url, true);

    const headers = new Headers(request?.headers);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));

    xhr.onload = () => {
      const responseHeaders = parseResponseHeaders(xhr.getAllResponseHeaders());
      const body = [101, 204, 205, 304].includes(xhr.status) ? null : xhr.responseText;
      resolve(new Response(body, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: responseHeaders,
      }));
    };
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.ontimeout = () => reject(new TypeError('Network request timed out'));
    xhr.timeout = 15000;
    xhr.send((init?.body ?? null) as XMLHttpRequestBodyInit | null);
  });
}

function parseResponseHeaders(rawHeaders: string) {
  const headers = new Headers();
  rawHeaders.trim().split(/[\r\n]+/).forEach((line) => {
    const index = line.indexOf(':');
    if (index > 0) headers.append(line.slice(0, index).trim(), line.slice(index + 1).trim());
  });
  return headers;
}
