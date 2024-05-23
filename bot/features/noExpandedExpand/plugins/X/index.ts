import fs from 'node:fs/promises';
import { log } from '@lib/log';
import { getEnv } from '@lib/util';
import { Scraper } from '@the-convocation/twitter-scraper';
import { type APIEmbed, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { runes } from 'runes2';
import { Cookie } from 'tough-cookie';
import type { PluginHooks } from 'types/bot/features/noExpandedExpand';
import { retrieveFromVx } from './vxTwitterAPI';

const HTML_ENTITIES = Object.freeze({
  amp: '&',
  apos: '\'',
  quot: '"',
  nbsp: ' ',
  lt: '<',
  gt: '>',
});

const HASHTAG_USABLE_PATTERN = String.raw`\w\u30a0-\u30ff\u3040-\u309f\u3005-\u3006\u30e0-\u9fcf〜～`;

const login = async (label: string, scraper: Scraper, retryCount = 3): Promise<void> => {
  const saveNewCookies = async (): Promise<Cookie[]> => {
    try {
      log(`noExpandedExpand#X#${login.name}[${label}]:`, 'try to login');

      const username = getEnv('TWITTER_USERNAME');
      const password = getEnv('TWITTER_PASSWORD');
      const email = getEnv('TWITTER_EMAIL');

      await scraper.login(username, password, email);
      log(`noExpandedExpand#X#${login.name}[${label}]:`, 'login success');

      const cookies = await scraper.getCookies();
      fs.writeFile('twitter.cookies', JSON.stringify(cookies.map(c => c.toJSON())), { encoding: 'utf-8' });

      return cookies;
    }
    catch (e) {
      if (e instanceof Error) {
        log(`noExpandedExpand#X#${login.name}[${label}]:`, 'failed to login', e.stack ?? `${e.name}: ${e.message}`);
      }
      throw e;
    }
  };

  try {
    const json = await fs.readFile('twitter.cookies', { encoding: 'utf-8' });
    const cookies = JSON.parse(json);
    await scraper.setCookies(cookies.map(Cookie.fromJSON));

    if (!scraper.isLoggedIn()) {
      const cookies = await saveNewCookies();
      await scraper.setCookies(cookies);
    }
  }
  catch (e) {
    if (e instanceof Error) {
      log(`noExpandedExpand#X#${login.name}[${label}]:`, 'failed to read cookies', e.stack ?? `${e.name}: ${e.message}`);

      if (retryCount > 1) {
        await saveNewCookies();
        return await login(label, scraper, retryCount - 1);
      }
      return log(`noExpandedExpand#X#${login.name}[${label}]:`, 'failed to login');
    }
    throw e;
  }
};

export const hooks: PluginHooks = [
  [
    /^https:\/\/(?:mobile\.)?(?:twitter|x)\.com\/\w+?\/status\/\d+?\??/,
    async url => {
      log('noExpandedExpand#X:', 'urls detected', url);

      try {
        const [, statusId = ''] = url.match(/\/status\/([0-9]+?)\b/) ?? [];

        const scraper = new Scraper();
        await login(url, scraper);

        const tweet = await scraper.getTweet(statusId);

        if (tweet == null) {
          const fromVx = await retrieveFromVx(url, statusId);
          if (fromVx.embeds.length > 0) {
            return fromVx;
          }

          log(`noExpandedExpand#X[${url}]:`, `tweet not found at ${statusId}`);
          return { embeds: [], attachments: [] };
        }
        const { username, name, html, photos, videos, timeParsed, likes, retweets, views, quotedStatus } = tweet;

        const embed = new EmbedBuilder({ url });
        embed.setColor(0x1d9bf0);
        embed.setFooter({ text: 'Twitter', iconURL: 'attachment://logo.png' });

        if (username != null && name != null) {
          const { avatar } = await scraper.getProfile(username);
          embed.setAuthor({ name: `${name} (@${username})`, url: `https://twitter.com/${username}`, iconURL: avatar ?? '' });
        }
        if (html != null) {
          let text = Object.entries(HTML_ENTITIES)
            .reduce((acc, [entity, sym]) => acc.replaceAll(`&${entity};`, sym), html)
            .replaceAll('<br>', '\n')
            .replace(/<a href="(https?:\/\/)([^"]+?)">(.*?)<\/a>/g, (_, scheme, url, text) => {
              // remove anchor tag if url is a hashtag
              if (url.startsWith('twitter.com/hashtag/')) {
                return text;
              }

              // replace to empty text if text is an image link
              if (text.startsWith('<img src=')) return '';

              // replace to mention if url is a user
              if (text.startsWith('@') && url === `twitter.com/${text.slice(1)}`) {
                return `[${text}](${scheme}${url})`;
              }

              return `[${url}](${scheme}${url})`;
            });

          // record indices for start and end positions of [keyword](url)
          const innerHashIndices: [number, number][] = [];
          for (const { 0: matched, index = 0 } of text.matchAll(/(?<=\[).+?\]\(.+?(?=\))/g)) {
            innerHashIndices.push([index, index + matched.length - 1]);
          }

          // resolve unresolved t.co links
          {
            let m: RegExpMatchArray | null;
            while ((m = text.match(/https:\/\/t.co\/\S+/)) != null) {
              const [tCoUrl] = m;

              const response = await fetch(tCoUrl, { redirect: 'manual' });
              const redirectUrl = response.headers.get('location');

              if (redirectUrl == null) {
                log(`noExpandedExpand#X[${url}]:`, 'failed to resolve t.co link: ', tCoUrl);
                break;
              }

              text = text.replaceAll(tCoUrl, redirectUrl);
            }
          }

          text = text
            .replace(
              RegExp(`(?<hash>#|＃)(?<keyword>[${HASHTAG_USABLE_PATTERN}]+?)(?=[^${HASHTAG_USABLE_PATTERN}]|$)`, 'g'),
              (original, hash, keyword, offset) => {
                // returns original text if '#' is inner of brackets
                if (innerHashIndices.some(([start, end]) => start <= offset && offset <= end)) {
                  return original;
                }
                return `[${hash}${keyword}](https://twitter.com/hashtag/${keyword})`;
              },
            )
            .replace(/<img src="[^"]+?"\/>/g, '');

          const ellipsis = '…\n\n（4000文字制限のため以下省略）';
          if (runes(text).length > 4000) {
            text = text.slice(0, 4000 - ellipsis.length) + ellipsis;
          }

          embed.setDescription(text);
        }
        if (timeParsed != null) {
          embed.setTimestamp(timeParsed);
        }
        if (likes != null && likes !== 0) {
          embed.addFields({ name: 'Likes', value: String(likes), inline: true });
        }
        if (retweets != null && retweets !== 0) {
          embed.addFields({ name: 'Retweets', value: String(retweets), inline: true });
        }
        if (views != null && views !== 0) {
          embed.addFields({ name: 'Impressions', value: String(views), inline: true });
        }

        const [firstPic, ...restPics] = [...photos.map(x => x.url), ...videos.map(x => x.preview)];
        if (firstPic != null) {
          embed.setImage(firstPic);
        }

        const embeds: APIEmbed[] = [];
        const attachments: AttachmentBuilder[] = [];

        embeds.push(embed.toJSON());
        attachments.push(new AttachmentBuilder(await fs.readFile('./assets/logo/twitter_24x24.png'), { name: 'logo.png' }));

        if (quotedStatus != null) {
          const { photos, videos } = quotedStatus;
          restPics.push(...photos.map(x => x.url), ...videos.map(x => x.preview));
        }
        for (const pic of restPics) {
          const embed = new EmbedBuilder({ url });
          embed.setImage(pic);
          embeds.push(embed.toJSON());
        }

        return { embeds, attachments };
      }
      catch (e) {
        if (e instanceof Error) {
          log(`noExpandedExpand#X[${url}]:`, 'unknown error occurred', e.stack ?? `${e.name}: ${e.message}`);
          return { embeds: [], attachments: [] };
        }
        throw e;
      }
    }
  ],
];
