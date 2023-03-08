const dotenv = require('dotenv');

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
 * @param {string} content
 * @returns {content is Url}
 */
const isUrl = content => /^https?:\/\/\S+$/.test(content);

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
  isUrl,
  urlsOfText,
  peek,
  toQueryString,
};
