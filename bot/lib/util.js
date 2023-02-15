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

module.exports = {
  URL_REGEX_GLOBAL,
  getEnv,
  isUrl,
};
