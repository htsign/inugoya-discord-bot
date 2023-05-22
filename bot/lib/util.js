const { URL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');
const dotenv = require('dotenv');
const chardet = require('chardet');
const { JSDOM } = require('jsdom');
const emojiRegex = require('emoji-regex');
const GraphemeSplitter = require('grapheme-splitter');

const URL_REGEX_GLOBAL = /\bhttps?:\/\/\S+/g;
const DATETIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const configOutput = dotenv.config();

/**
 * @param {string} key
 * @param {string=} [name='token']
 * @returns {string}
 */
const getEnv = (key, name = 'token') => {
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
const getUrlDomain = url => {
  const { protocol, host } = new URL(url);
  return `${protocol}//${host}/`;
};

/**
 * @param {string} content
 * @returns {content is Url}
 */
const isUrl = content => /^https?:\/\/\S+$/.test(content);

/**
 * @param {Url} url
 * @returns {Promise<Url>}
 */
const retrieveRealUrl = async url => {
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
 * @returns {Url[]}
 */
const urlsOfText = text => {
  /** @type {function(string[]): Url[]} */
  const filterUrls = contents => contents.filter(isUrl);
  const urls = text.match(URL_REGEX_GLOBAL) ?? [];

  return filterUrls(urls);
};

/**
 * @param {string} url
 * @returns {Promise<Document>}
 */
const urlToDocument = async url => {
  /**
   * @param {string} url
   * @returns {Promise<Response>}
   */
  const _fetch = async url => {
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

/**
 * for debug
 * @param {T} value
 * @returns {T}
 * @template T
 */
const peek = value => {
  console.log(value);
  return value;
}

/**
 * @param {object} queries
 * @returns {string}
 */
const toQueryString = queries => Object.entries(queries).map(([key, val]) => `${key}=${val}`).join('&');

module.exports = {
  URL_REGEX_GLOBAL,
  DATETIME_FORMAT,
  getEnv,
  /** @type {RegExp} */
  // @ts-ignore
  emojiRegex: emojiRegex(),
  graphemeSplitter: new GraphemeSplitter(),
  getUrlDomain,
  isUrl,
  retrieveRealUrl,
  urlsOfText,
  urlToDocument,
  peek,
  toQueryString,
};
