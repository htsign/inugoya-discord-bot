const { Events } = require('discord.js');
const axios = require('axios').default;
const client = require('../../client');
const { URL_REGEX_GLOBAL, getEnv, isUrl } = require('../../lib/util');

const API_KEY = getEnv('XGD_API_KEY', 'X.gd API key');
const API_ENTRYPOINT = 'https://xgd.io/V1/shorten';

/**
 * @param {Url[]} urls
 * @returns {Promise<(XgdSuccessMessage | XgdFailureMessage)[]>}
 */
const shortenUrls = async urls => {
  /** @type {(XgdSuccessMessage | XgdFailureMessage)[]} */
  const shortenUrls = [];

  for (const url of urls) {
    /** @type {XgdRequest} */
    const params = {
      key: API_KEY,
      url,
      analytics: false,
    };

    try {
      /** @type {ShortenUrlResponse} */
      const { data, status } = await axios.get(API_ENTRYPOINT, { params });

      if (status !== 200) {
        shortenUrls.push(`error occured [${status}]: unknown error`);
      }
      else if (data.status === 200) {
        shortenUrls.push(`\`${data.originalurl}\`: <${data.shorturl}>`);
      }
      else {
        shortenUrls.push(`error occured [${data.status}]: ${data.message}`);
      }
    }
    catch (e) {
      if (axios.isAxiosError(e)) {
        const status = e.response?.status ?? e.status ?? 400;
        shortenUrls.push(`error occured [${status}]: ${e.message || 'unknown error'}`);
      }
    }
  }
  return shortenUrls;
};

/**
 * @param {Url} url
 * @returns {Promise<XgdSuccessMessage | XgdFailureMessage>}
 */
const shortenUrl = async url => {
  const { isNonEmpty } = await import('ts-array-length');

  const shortens = await shortenUrls([url]);
  if (!isNonEmpty(shortens)) {
    throw new Error('unexpected procedure');
  }
  return shortens[0];
};

/**
 * @param {string} content
 * @returns {Promise<(XgdSuccessMessage | XgdFailureMessage)[]>}
 */
const shortenUrlsOfContent = content => {
  /** @type {function(string[]): Url[]} */
  const filterUrls = contents => contents.filter(isUrl);

  const urls = content.match(URL_REGEX_GLOBAL) ?? [];
  return shortenUrls(filterUrls(urls));
};

/**
 * @param {Message<boolean>} message
 * @returns {Promise<(XgdSuccessMessage | XgdFailureMessage)[]>}
 */
const shortenUrlsOfMessage = message => shortenUrlsOfContent(message.content ?? '');

client.on(Events.MessageCreate, async message => {
  const { reference, content, channel } = message;

  if (reference == null) return;
  if (content !== '短縮して') return;
  if (!channel.isTextBased() || channel.isVoiceBased()) return;

  const referredMessage = await channel.messages.fetch(reference.messageId ?? '');
  const urls = await shortenUrlsOfMessage(referredMessage);

  message.reply(urls.length > 0 ? urls.join('\n') : 'URL が見つからないよ！');
});

module.exports = {
  shortenUrls,
  shortenUrl,
  shortenUrlsOfContent,
  shortenUrlsOfMessage,
};
