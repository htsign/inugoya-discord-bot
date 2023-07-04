import fs from 'node:fs/promises';
import { EmbedBuilder, Events } from 'discord.js';
import puppeteer, { TimeoutError } from 'puppeteer';
import { addHandler } from '../../listeners.js';
import dayjs from '../../lib/dayjsSetup.js';
import { log } from '../../lib/log.js';
import { getEnv, urlsOfText } from '../../lib/util.js';

const ARTICLE_SELECTOR = 'article[data-testid="tweet"]';

/**
 * @returns {Promise<import('puppeteer').PuppeteerLaunchOptions>}
 */
const getLaunchOptions = async () => {
  try {
    const { default: options } = await import(
      // @ts-ignore
      './launchOptions.json',
      { assert: { type: 'json' },
    });
    return options;
  }
  catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ERR_MODULE_NOT_FOUND') {
      log(`twitterView#${getLaunchOptions.name}:`, 'failed to load launchOptions.json');
      return { headless: 'new' };
    }
    throw e;
  }
};

const login = async () => {
  const browser = await puppeteer.launch(await getLaunchOptions());
  const page = await browser.newPage();

  await page.goto('https://twitter.com/login');

  // type username
  await page.waitForSelector('input[autocomplete="username"]');
  await page.type('input[autocomplete="username"]', getEnv('TWITTER_USERNAME'));
  await page.keyboard.press('Enter');

  // type password
  await page.waitForSelector('input[autocomplete="current-password"]');
  await page.type('input[autocomplete="current-password"]', getEnv('TWITTER_PASSWORD'));
  await page.keyboard.press('Enter');
  await page.waitForNavigation();

  // save cookies
  const cookies = await page.cookies();
  await fs.writeFile('twitter.cookies', JSON.stringify(cookies, null, 2));

  return cookies;
};

addHandler(Events.MessageCreate, async message => {
  const { author, content, guild, channel } = message;
  if (author.bot || guild == null || channel.isVoiceBased() || !('name' in channel)) return;

  const browser = await puppeteer.launch(await getLaunchOptions());
  const page = await browser.newPage();
  page.setViewport({ width: 640, height: 480 });

  const urls = urlsOfText(content);
  const twitterUrls = urls.filter(url => url.startsWith('https://twitter.com/'));

  if (twitterUrls.length > 0) {
    try {
      const cookies = await fs.readFile('twitter.cookies', 'utf8').then(JSON.parse);
      await page.setCookie(...cookies);
    }
    catch (e) {
      log('twitterView:', 'failed to open cookie file');
    }

    for (const url of twitterUrls) {
      await page.goto(url);
      try {
        await page.waitForSelector(ARTICLE_SELECTOR, { timeout: 5000 });
      }
      catch (e) {
        if (e instanceof TimeoutError) {
          await page.setCookie(...await login());
          await page.goto(url);
          await page.waitForSelector(ARTICLE_SELECTOR);
        }
        else {
          throw e;
        }
      }

      const article = await page.$(ARTICLE_SELECTOR);
      if (article == null) continue;

      const [user, userId] = await Promise.all((await article.$$('[data-testid="User-Name"] a')).map(el => el.evaluate(x => x.textContent)));
      const userPic = await page.evaluate(el => el?.src ?? '', await article.$('[data-testid|="UserAvatar-Container"] img'));
      const tweet = await page.evaluate(el => el?.textContent ?? '', await article.$('[data-testid="tweetText"]'));
      const [firstPic, ...restPics] = await Promise.all((await article.$$('[data-testid="tweetPhoto"] img')).map(el => el.evaluate(x => x.src)));
      const timestamp = await page.evaluate(el => el?.dateTime, await article.$('time'));
      const retweets = await page.evaluate(el => el?.textContent, await article.$('[href$="/retweets"] [data-testid="app-text-transition-container"]'));
      const likes = await page.evaluate(el => el?.textContent, await article.$('[href$="/likes"] [data-testid="app-text-transition-container"]'));

      /** @type {import('discord.js').APIEmbed[]} */
      const embeds = [];

      const embed = new EmbedBuilder({ url });
      embed.setDescription(tweet);
      embed.setColor(0x1d9bf0);

      if (user != null && userId != null) {
        embed.setAuthor({ name: `${user} (${userId})`, iconURL: userPic });
      }
      if (timestamp != null) {
        embed.setTimestamp(dayjs.utc(timestamp).tz().valueOf());
      }
      if (retweets != null) {
        embed.addFields({ name: 'Retweets', value: retweets, inline: true });
      }
      if (likes != null) {
        embed.addFields({ name: 'Likes', value: likes, inline: true });
      }

      if (firstPic != null) {
        embed.setImage(firstPic);
      }

      embeds.push(embed.toJSON());

      for (const pic of restPics) {
        const embed = new EmbedBuilder({ url });
        embed.setImage(pic);
        embeds.push(embed.toJSON());
      }

      try {
        await channel.send({ embeds });
      }
      catch (e) {
        if (e instanceof Error) {
          log('twitterView:', `failed to send to ${guild.name}/${channel.name}`, e.stack ?? `${e.name}: ${e.message}`);
          return;
        }
        throw e;
      }

      log('twitterView:', `sent to ${guild.name}/${channel.name}`, url, tweet);
    }
  }

  await browser.close();
});
