import { Events, Message } from 'discord.js';
import { isNonEmpty } from 'ts-array-length';
import axios from 'axios';
import client from '../../client';
import { URL_REGEX_GLOBAL, getEnv, isUrl } from '../../lib/util';
import type { ShortenUrlResponse, XgdFailureMessage, XgdRequest, XgdSuccessMessage } from './_types';

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
      const { data, status }: ShortenUrlResponse = await axios.get(API_ENTRYPOINT, { params });

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

  const referredMessage = await channel.messages.fetch(reference.messageId ?? '');
  const urls = await shortenUrlsOfMessage(referredMessage);

  message.reply(urls.length > 0 ? urls.join('\n') : 'URL が見つからないよ！');
});
