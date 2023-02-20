import { Events } from 'discord.js';
import { isNonEmpty } from 'ts-array-length';
import axios from 'axios';
import client from '../../client';
import { URL_REGEX_GLOBAL, getEnv, isUrl } from '../../lib/util';

const API_KEY = getEnv('XGD_API_KEY', 'X.gd API key');
const API_ENTRYPOINT = 'https://xgd.io/V1/shorten';

/**
 * @param {Url[]} urls
 * @returns {Promise<(import('./_types').XgdSuccessMessage | import('./_types').XgdFailureMessage)[]>}
 */
export const shortenUrls = async urls => {
  /** @type {(import('./_types').XgdSuccessMessage | import('./_types').XgdFailureMessage)[]} */
  const shortenUrls = [];

  for (const url of urls) {
    /** @type {import('./_types').XgdRequest} */
    const params = {
      key: API_KEY,
      url,
      analytics: false,
    };

    try {
      /** @type {import('./_types').ShortenUrlResponse} */
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
 * @returns {Promise<import('./_types').XgdSuccessMessage | import('./_types').XgdFailureMessage>}
 */
export const shortenUrl = async url => {
  const shortens = await shortenUrls([url]);
  if (!isNonEmpty(shortens)) {
    throw new Error('unexpected procedure');
  }
  return shortens[0];
};

/**
 * @param {string} content
 * @returns {Promise<(import('./_types').XgdSuccessMessage | import('./_types').XgdFailureMessage)[]>}
 */
export const shortenUrlsOfContent = content => {
  /** @type {function(string[]): Url[]} */
  const filterUrls = contents => contents.filter(isUrl);

  const urls = content.match(URL_REGEX_GLOBAL) ?? [];
  return shortenUrls(filterUrls(urls));
};

/**
 * @param {import('discord.js').Message<boolean>} message
 * @returns {Promise<(import('./_types').XgdSuccessMessage | import('./_types').XgdFailureMessage)[]>}
 */
export const shortenUrlsOfMessage = message => shortenUrlsOfContent(message.content ?? '');

client.on(Events.MessageCreate, async message => {
  const { reference, content, channel } = message;

  if (reference == null) return;
  if (content !== '短縮して') return;

  const referredMessage = await channel.messages.fetch(reference.messageId ?? '');
  const urls = await shortenUrlsOfMessage(referredMessage);

  message.reply(urls.length > 0 ? urls.join('\n') : 'URL が見つからないよ！');
});
