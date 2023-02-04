const { Events } = require('discord.js');
const dotenv = require('dotenv');
const client = require('../../client');
const axios = require('axios').default;
const { URL_REGEX, isUrl } = require('../../lib/util');

const API_KEY = (dotenv.config().parsed ?? process.env).XGD_API_KEY;
const API_ENTRYPOINT = 'https://xgd.io/V1/shorten';

/**
 * @param {Url[]} urls
 * @returns {Promise<(XgdSuccessMessage | XgdFailureMessage)[]>}
 */
const shortenUrls = async urls => {
  /** @type {(XgdSuccessMessage | XgdFailureMessage)[]} */
  const shortenUrls = [];

  if (API_KEY == null) {
    throw new Error('X.gd API key is empty');
  }

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
        shortenUrls.push(`\`${data.originalurl}\`: ${data.shorturl}`);
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
  const [shortenUrl] = await shortenUrls([url]);
  return shortenUrl;
};

/**
 * @param {string} content
 * @returns {Promise<(XgdSuccessMessage | XgdFailureMessage)[]>}
 */
const shortenUrlsOfContent = content => {
  /** @type {function(string[]): Url[]} */
  const filterUrls = contents => contents.filter(isUrl);

  const urls = content.match(URL_REGEX) ?? [];
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

  const referredMessage = await channel.messages.fetch(reference.messageId ?? '');
  const urls = await shortenUrlsOfMessage(referredMessage);
  message.reply(urls.join('\n'));
});

module.exports = {
  shortenUrls,
  shortenUrl,
  shortenUrlsOfContent,
  shortenUrlsOfMessage,
};
