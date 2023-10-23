import fs from 'node:fs/promises';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { Scraper } from '@the-convocation/twitter-scraper';
import { Cookie } from 'tough-cookie';
import { log } from '../../../../lib/log.js';
import { getEnv } from '../../../../lib/util.js';

const HTML_ENTITIES = Object.freeze({
  'amp': '&',
  'apos': '\'',
  'quot': '"',
  'nbsp': ' ',
  'lt': '<',
  'gt': '>',
});

/**
 * @param {string} label
 * @param {Scraper} scraper
 * @returns {Promise<void>}
 */
const login = async (label, scraper) => {
  const saveNewCookies = async () => {
    try {
      log(`twitterView#${login.name}[${label}]:`, 'try to login');

      const username = getEnv('TWITTER_USERNAME');
      const password = getEnv('TWITTER_PASSWORD');
      const email = getEnv('TWITTER_EMAIL');

      await scraper.login(username, password, email);
      log(`twitterView#${login.name}[${label}]:`, 'login success');

      const cookies = await scraper.getCookies();
      fs.writeFile('twitter.cookies', JSON.stringify(cookies.map(c => c.toJSON())), { encoding: 'utf-8' });

      return cookies;
    }
    catch (e) {
      if (e instanceof Error) {
        log(`twitterView#${login.name}[${label}]:`, 'failed to login', e.stack ?? `${e.name}: ${e.message}`);
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
      log(`twitterView#${login.name}[${label}]:`, 'failed to read cookies', e.stack ?? `${e.name}: ${e.message}`);

      await saveNewCookies();
      return await login(label, scraper);
    }
    throw e;
  }
};

/** @type {import('types/bot/features/noExpandedExpand').PluginHooks} */
export const hooks = [
  [
    /^https:\/\/(?:mobile\.)?(?:twitter|x)\.com\/\w+?\/status\/\d+?\??/,
    async url => {
      log('twitterView:', 'urls detected', url);

      try {
        const [, statusId = ''] = url.match(/\/status\/([0-9]+?)\b/) ?? [];

        const scraper = new Scraper();
        await login(url, scraper);

        let tweet = await scraper.getTweet(statusId);

        if (tweet == null) {
          tweet = await scraper.getTweet(statusId);
        }
        if (tweet == null) {
          log(`twitterView[${url}]:`, `tweet not found at ${statusId}`);
          return { embeds: [], attachments: [] };
        }
        const { username, name, html, photos, timeParsed, likes, retweets, views } = tweet;

        const embed = new EmbedBuilder({ url });
        embed.setColor(0x1d9bf0);
        embed.setFooter({ text: 'Twitter', iconURL: 'attachment://logo.png' });

        if (username != null && name != null) {
          const { avatar } = await scraper.getProfile(username);
          embed.setAuthor({ name: `${name} (@${username})`, url: `https://twitter.com/${username}`, iconURL: avatar ?? '' });
        }
        if (html != null) {
          const text = Object.entries(HTML_ENTITIES)
            .reduce((acc, [entity, sym]) => acc.replaceAll(`&${entity};`, sym), html)
            .replaceAll('<br>', '\n')
            .replace(/<a href="(https?:\/\/)([^"]+?)">(.*?)<\/a>/g, (_, scheme, url, text) => {
              // replace to plain text if url is a hashtag
              if (url.startsWith('twitter.com/hashtag/')) return text;

              // replace to empty text if text is an image link
              if (text.startsWith('<img src=')) return '';

              // replace to mention if url is a user
              if (text.startsWith('@') && url === `twitter.com/${text.slice(1)}`) {
                return `[${text}](${scheme}${url})`;
              }

              return `[${url}}](${scheme}${url})`;
            })
            .replace(/<img src="[^"]+?"\/>/g, '');
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

        const [firstPic, ...restPics] = photos ?? [];
        if (firstPic != null) {
          embed.setImage(firstPic.url);
        }

        /** @type {import('discord.js').APIEmbed[]} */
        const embeds = [];
        /** @type {import('discord.js').AttachmentBuilder[]} */
        const attachments = [];

        embeds.push(embed.toJSON());
        attachments.push(new AttachmentBuilder(await fs.readFile('./assets/logo/twitter_24x24.png'), { name: 'logo.png' }));

        for (const pic of restPics) {
          const embed = new EmbedBuilder({ url });
          embed.setImage(pic.url);
          embeds.push(embed.toJSON());
        }

        return { embeds, attachments };
      }
      catch (e) {
        if (e instanceof Error) {
          log(`twitterView[${url}]:`, 'unknown error occurred', e.stack ?? `${e.name}: ${e.message}`);
          return { embeds: [], attachments: [] };
        }
        throw e;
      }
    }
  ],
];
