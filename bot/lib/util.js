const { URL } = require('node:url');
const dotenv = require('dotenv');
const chardet = require('chardet');
const { JSDOM } = require('jsdom');

const URL_REGEX_GLOBAL = /\bhttps?:\/\/\S+/g;
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
    const { url: realUrl } = await fetch(url, { method: 'HEAD' });
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
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const encoding = chardet.detect(new Uint8Array(buffer)) ?? 'utf-8';
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
  getEnv,
  getUrlDomain,
  isUrl,
  retrieveRealUrl,
  urlsOfText,
  urlToDocument,
  peek,
  toQueryString,
};
