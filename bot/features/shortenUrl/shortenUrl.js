import { Events } from 'discord.js';
import { isNonEmpty } from 'ts-array-length';
import { addHandler } from '../../listeners.js';
import { log } from '../../lib/log.js';
import { getEnv, toQueryString, urlsOfText } from '../../lib/util.js';

const API_KEY = getEnv('XGD_API_KEY', 'X.gd API key');
const API_ENTRYPOINT = 'https://xgd.io/V1/shorten';

/**
 * @param {import('types').Url[]} urls
 * @returns {Promise<(import('types/bot/features/shortenUrl').XgdSuccessMessage | import('types/bot/features/shortenUrl').XgdFailureMessage)[]>}
 */
export const shortenUrls = async urls => {
  /** @type {(import('types/bot/features/shortenUrl').XgdSuccessMessage | import('types/bot/features/shortenUrl').XgdFailureMessage)[]} */
  const shortenUrls = [];

  for (const url of urls) {
    /** @type {import('types/bot/features/shortenUrl').XgdRequest} */
    const params = {
      key: API_KEY,
      url,
      analytics: false,
    };

    try {
      const res = await fetch(`${API_ENTRYPOINT}?${toQueryString(params, encodeURIComponent)}`);
      /** @type {import('types/bot/features/shortenUrl').XgdResponse} */
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
 * @param {import('types').Url} url
 * @returns {Promise<import('types/bot/features/shortenUrl').XgdSuccessMessage | import('types/bot/features/shortenUrl').XgdFailureMessage>}
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
 * @returns {Promise<(import('types/bot/features/shortenUrl').XgdSuccessMessage | import('types/bot/features/shortenUrl').XgdFailureMessage)[]>}
 */
export const shortenUrlsOfContent = content => shortenUrls(urlsOfText(content));

/**
 * @param {import('discord.js').Message<boolean>} message
 * @returns {Promise<(import('types/bot/features/shortenUrl').XgdSuccessMessage | import('types/bot/features/shortenUrl').XgdFailureMessage)[]>}
 */
export const shortenUrlsOfMessage = message => shortenUrlsOfContent(message.content ?? '');

addHandler(Events.MessageCreate, async message => {
  const { reference, content, channel, author } = message;

  if (reference == null) return;
  if (content !== '短縮して') return;
  if (!channel.isTextBased() || channel.isVoiceBased()) return;

  const referredMessage = await channel.messages.fetch(reference.messageId ?? '');
  const urls = await shortenUrlsOfMessage(referredMessage);

  try {
    await message.reply(urls.length > 0 ? urls.join('\n') : 'URL が見つからないよ！');
  }
  catch (e) {
    if (e instanceof Error) {
      log('shortenUrl:', `failed to reply to ${author.username}`, e.stack ?? `${e.name}: ${e.message}`);
      return;
    }
    throw e;
  }
});
