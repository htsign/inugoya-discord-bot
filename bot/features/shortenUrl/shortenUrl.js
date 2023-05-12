const { Events } = require('discord.js');
const { addHandler } = require('../../lib/listeners');
const { log } = require('../../lib/log');
const { getEnv, toQueryString, urlsOfText } = require('../../lib/util');

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
      const res = await fetch(`${API_ENTRYPOINT}?${toQueryString(params)}`);
      /** @type {XgdResponse} */
      const data = await res.json();

      if (res.status !== 200) {
        shortenUrls.push(`error occurred [${res.status}]: unknown error`);
      }
      else if (data.status === 200) {
        log('shorten url:', data.originalurl, '->', data.shorturl);
        shortenUrls.push(`\`${data.originalurl}\`: <${data.shorturl}>`);
      }
      else {
        shortenUrls.push(`error occurred [${data.status}]: ${data.message}`);
      }
    }
    catch (e) {
      if (e instanceof Error) {
        shortenUrls.push(`error occurred [400]: ${e.message || 'unknown error'}`);
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
const shortenUrlsOfContent = content => shortenUrls(urlsOfText(content));

/**
 * @param {Message<boolean>} message
 * @returns {Promise<(XgdSuccessMessage | XgdFailureMessage)[]>}
 */
const shortenUrlsOfMessage = message => shortenUrlsOfContent(message.content ?? '');

addHandler(Events.MessageCreate, async message => {
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
