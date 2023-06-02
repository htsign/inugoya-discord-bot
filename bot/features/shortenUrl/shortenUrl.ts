import { Events, Message } from 'discord.js';
import { isNonEmpty } from 'ts-array-length';
import { addHandler } from 'bot/listeners';
import { getEnv, toQueryString, urlsOfText } from '@lib/util';
import { log } from '@lib/log';
import type { Url } from 'types';
import type { XgdFailureMessage, XgdRequest, XgdResponse, XgdSuccessMessage } from 'types/bot/features/shortenUrl';

const API_KEY = getEnv('XGD_API_KEY', 'X.gd API key');
const API_ENTRYPOINT = 'https://xgd.io/V1/shorten';

export const shortenUrls = async (urls: Url[]): Promise<(XgdSuccessMessage | XgdFailureMessage)[]> => {
  const shortenUrls: (XgdSuccessMessage | XgdFailureMessage)[] = [];

  for (const url of urls) {
    const params: XgdRequest = {
      key: API_KEY,
      url,
      analytics: false,
    };

    try {
      const res: Response = await fetch(`${API_ENTRYPOINT}?${toQueryString(params)}`);
      const data: XgdResponse = await res.json();

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

export const shortenUrl = async (url: Url): Promise<XgdSuccessMessage | XgdFailureMessage> => {
  const shortens = await shortenUrls([url]);
  if (!isNonEmpty(shortens)) {
    throw new Error('unexpected procedure');
  }
  return shortens[0];
};

export const shortenUrlsOfContent = (content: string): Promise<(XgdSuccessMessage | XgdFailureMessage)[]> =>
  shortenUrls(urlsOfText(content));

export const shortenUrlsOfMessage = (message: Message): Promise<(XgdSuccessMessage | XgdFailureMessage)[]> =>
  shortenUrlsOfContent(message.content ?? '');

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
