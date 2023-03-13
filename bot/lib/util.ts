import { URL } from 'node:url';
import chardet from 'chardet';
import { JSDOM } from 'jsdom';

export const URL_REGEX_GLOBAL = /\bhttps?:\/\/\S+/g;

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
    const { url: realUrl } = await fetch(url, { method: 'HEAD' });
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
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const encoding = chardet.detect(new Uint8Array(buffer)) ?? 'utf-8';
  const html = new TextDecoder(encoding).decode(buffer);
  const { window: { document } } = new JSDOM(html);

  return document;
};

export const peek = <T>(value: T): T => {
  console.log(value);
  return value;
};

export const toQueryString = (queries: {}) => Object.entries(queries).map(([key, val]): string => `${key}=${val}`).join('&');
