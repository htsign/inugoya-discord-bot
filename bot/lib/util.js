import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';
import chardet from 'chardet';
import dotenv from 'dotenv';
import { JSDOM } from 'jsdom';

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

const configOutput = dotenv.config();

/**
 * @param {T} value
 * @returns {T}
 * @template T
 */
export const identity = value => value;

/**
 * @param {string} key
 * @param {string=} [name='token']
 * @returns {string}
 */
export const getEnv = (key, name = key) => {
  const token = configOutput.parsed?.[key] ?? process.env[key];
  if (token == null) {
    throw new Error(`${name} is empty`);
  }
  return token;
};

/**
 * @param {string} url
 * @returns {string}
 */
export const getUrlDomain = url => {
  const { protocol, host } = new URL(url);
  return `${protocol}//${host}/`;
};

/**
 * @param {string} content
 * @returns {content is import('types').Url}
 */
export const isUrl = content => /^https?:\/\/\S+$/.test(content);

/**
 * @param {import('types').Url} url
 * @returns {Promise<import('types').Url>}
 */
export const retrieveRealUrl = async url => {
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
};

/**
 * @param {string} text
 * @returns {import('types').Url[]}
 */
export const urlsOfText = text => {
  /** @type {function(string[]): import('types').Url[]} */
  const filterUrls = contents => contents.filter(isUrl);
  const urls = text.match(URL_REGEX_GLOBAL) ?? [];

  return filterUrls(urls);
};

/**
 * @param {string} url
 * @returns {Promise<Document | null>}
 */
export const urlToDocument = async url => {
  /** @type {HeadersInit} */
  const headers = {
    Accept: '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'ja,en-US;en;q=0.3',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'User-Agent': USER_AGENT,
  };

  /**
   * @param {string} url
   * @returns {Promise<Response>}
   */
  const _fetch = async url => {
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
  /**
   * @param {ArrayBuffer} buffer
   * @returns {import('types').Nullable<string>}
   */
  const charsetFromBuffer = buffer => {
    const html = new TextDecoder().decode(buffer);
    const { window: { document } } = new JSDOM(html, { url });

    /**
     * @param {string} selector
     * @param {string} attr
     * @returns {import('types').Nullable<string>}
     */
    const getAttr = (selector, attr) => document.querySelector(selector)?.getAttribute(attr);

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

/**
 * for debug
 * @param {T} value
 * @returns {T}
 * @template T
 */
export const peek = value => {
  console.log(value);
  return value;
}

/**
 * @param {object} queries
 * @param {(value: string) => string} [valueFilter]
 * @returns {string}
 */
export const toQueryString =
  (queries, valueFilter = identity) => Object.entries(queries)
    .map(([key, val]) => `${key}=${valueFilter(val)}`)
    .join('&');
