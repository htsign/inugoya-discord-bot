import { URL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import chardet from 'chardet';
import { JSDOM } from 'jsdom';
import type { Url } from 'types';

export const URL_REGEX_GLOBAL = /\bhttps?:\/\/\S+/g;
export const DATETIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';

export const getEnv = (key: string, name: string = 'token'): string => {
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

export const urlToDocument = async (url: string): Promise<Document> => {
  const _fetch = async (url: string): Promise<Response> => {
    for (let tryCount = 0; tryCount < 3; tryCount++) {
      try {
        return await fetch(url);
      }
      catch {
        delay(1000);
      }
    }
    return Promise.reject(new Error('failed to fetch'));
  };
  const res = await _fetch(url);
  const buffer = await res.arrayBuffer();
  const encoding =
    res.headers.get('Content-Type')?.match(/(?<=charset=)[^;]+/i)?.[0]
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

export const toQueryString = (queries: {}) => Object.entries(queries).map(([key, val]): string => `${key}=${val}`).join('&');
