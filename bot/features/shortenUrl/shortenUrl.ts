import { Events, Message } from 'discord.js';
import { isNonEmpty } from 'ts-array-length';
import { URL_REGEX_GLOBAL, getEnv, isUrl, toQueryString } from '@lib/util';
import client from 'bot/client';
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

export const shortenUrlsOfContent = (content: string): Promise<(XgdSuccessMessage | XgdFailureMessage)[]> => {
  const filterUrls = (contents: string[]): Url[] => contents.filter(isUrl);

  const urls = content.match(URL_REGEX_GLOBAL) ?? [];
  return shortenUrls(filterUrls(urls));
};

export const shortenUrlsOfMessage = (message: Message): Promise<(XgdSuccessMessage | XgdFailureMessage)[]> =>
  shortenUrlsOfContent(message.content ?? '');

client.on(Events.MessageCreate, async message => {
  const { reference, content, channel } = message;

  if (reference == null) return;
  if (content !== '短縮して') return;
  if (!channel.isTextBased() || channel.isVoiceBased()) return;

  const referredMessage = await channel.messages.fetch(reference.messageId ?? '');
  const urls = await shortenUrlsOfMessage(referredMessage);

  message.reply(urls.length > 0 ? urls.join('\n') : 'URL が見つからないよ！');
});
