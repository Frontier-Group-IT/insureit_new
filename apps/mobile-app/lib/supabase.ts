import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

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
  if (Platform.OS === 'web' && typeof XMLHttpRequest !== 'undefined') {
    return xhrFetch(input, init);
  }
  return fetch(input, init);
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
