import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';
import chardet from 'chardet';
import { JSDOM } from 'jsdom';
import type { Nullable, Obj, Url } from 'types';

export const URL_REGEX_GLOBAL = /\bhttps?:\/\/\S+/g;
export const DATETIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0';

const IgnoredContentTypes = new Set([
  'image/svg+xml',
  'application/javascript',
  'application/x-javascript',
  'text/javascript',
  'application/pdf',
]);

export const identity = <T>(value: T) => value;

export const getEnv = (key: string, name: string = key): string => {
  const token = process.env[key];
  if (token == null) {
    throw new Error(`${name} is empty`);
  }
  return token;
};

export const getUrlDomain = (url: string): string => {
  const { protocol, host } = new URL(url);
  return `${protocol}//${host}/`;
};

export const isUrl = (content: string): content is Url => /^https?:\/\/\S+$/.test(content);

export const retrieveRealUrl = async (url: Url): Promise<Url> => {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);

    const { url: realUrl } = await fetch(url, { method: 'HEAD', signal: controller.signal })
      .catch(async e => {
        if (e instanceof DOMException && e.name === 'AbortError') {
          return await fetch(url);
        }
        return { url };
      });
    if (isUrl(realUrl)) {
      return realUrl;
    }
  }
  catch {}

  return url;
}

export const urlsOfText = (text: string): Url[] => {
  const filterUrls = (contents: string[]): Url[] => contents.filter(isUrl);
  const urls = text.match(URL_REGEX_GLOBAL) ?? [];

  return filterUrls(urls);
};

export const urlToDocument = async (url: string): Promise<Document | null> => {
  const headers: HeadersInit = {
    Accept: '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'ja,en-US;en;q=0.3',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'User-Agent': USER_AGENT,
  };

  const _fetch = async (url: string): Promise<Response> => {
    for (let tryCount = 0; tryCount < 3; tryCount++) {
      try {
        return await fetch(url, { headers });
      }
      catch {
        delay(1000);
      }
    }
    return Promise.reject(new Error('failed to fetch'));
  };
  const charsetFromBuffer = (buffer: ArrayBuffer): Nullable<string> => {
    const html = new TextDecoder().decode(buffer);
    const { window: { document } } = new JSDOM(html, { url });

    const getAttr = (selector: string, attr: string): Nullable<string> =>
      document.querySelector(selector)?.getAttribute(attr);

    return getAttr('meta[charset]', 'charset')
      ?? getAttr('meta[http-equiv="Content-Type"]', 'content')?.match(/(?<=charset=)[^;]+/i)?.[0]
  }

  const res = await _fetch(url);

  // returns null if the content type is ignored
  const contentType = res.headers.get('Content-Type');
  if (contentType != null && IgnoredContentTypes.has(contentType)) {
    return null;
  }

  const buffer = await res.arrayBuffer();
  const encoding =
    res.headers.get('Content-Type')?.match(/(?<=charset=)[^;]+/i)?.[0]
    ?? charsetFromBuffer(buffer)
    ?? chardet.detect(new Uint8Array(buffer))
    ?? 'utf-8';
  const html = new TextDecoder(encoding).decode(buffer);
  const { window: { document } } = new JSDOM(html, { url });

  return document;
};

export const peek = <T>(value: T): T => {
  console.log(value);
  return value;
};

export const toQueryString =
  (queries: Obj, valueFilter: (value: string) => string = identity) => Object.entries(queries)
    .map(([key, val]): string => `${key}=${valueFilter(String(val))}`)
    .join('&');
