import fs from 'node:fs/promises';
import { AttachmentBuilder, EmbedBuilder, Events } from 'discord.js';
import puppeteer, { Browser, ElementHandle, TimeoutError } from 'puppeteer';
import { addHandler } from '../../listeners.js';
import dayjs from '../../lib/dayjsSetup.js';
import { log } from '../../lib/log.js';
import { getEnv, urlsOfText } from '../../lib/util.js';

const BLOCK_URLS = [
  'https://abs-0.twimg.com/',
  'https://twitter.com/i/api/1.1/dm/inbox_initial_state.json?',
  'https://twitter.com/i/api/2/guide.json?',
  'https://twitter.com/i/api/fleets/v1/fleetline?',
];

const ARTICLE_SELECTOR = 'article[data-testid="tweet"]';

/** @type {Browser} */
let browser;

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

const initialize = async () => {
  const launchOptions = await getLaunchOptions();
  browser = await puppeteer.launch(launchOptions);
};

const login = async () => {
  log(`twitterView#${login.name}:`, 'try to login');

  const page = await browser.newPage();

  await page.goto('https://twitter.com/login');

  // type username
  const usernameInput = await page.waitForSelector('input[autocomplete="username"]');
  if (usernameInput == null) {
    log(`twitterView#${login.name}:`, 'failed to find username input');
    await page.close();
    return [];
  }
  await usernameInput.type(getEnv('TWITTER_USERNAME'));
  await page.keyboard.press('Enter');

  // type password
  const passwordInput = await page.waitForSelector('input[autocomplete="current-password"]');
  if (passwordInput == null) {
    log(`twitterView#${login.name}:`, 'failed to find password input');
    await page.close();
    return [];
  }
  await passwordInput.type(getEnv('TWITTER_PASSWORD'));
  await page.keyboard.press('Enter');

  await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

  log(`twitterView#${login.name}:`, 'login success');

  // save cookies
  const cookies = await page.cookies();
  await fs.writeFile('twitter.cookies', JSON.stringify(cookies, null, 2));

  await page.close();

  return cookies;
};

addHandler(Events.ClientReady, initialize);

addHandler(Events.MessageCreate, async message => {
  const { author, content, guild, channel } = message;
  if (author.bot || guild == null || channel.isVoiceBased() || !('name' in channel)) return;

  const urls = urlsOfText(content);
  const twitterUrls = urls.filter(url => /^https:\/\/(?:mobile\.)?twitter\.com\/\w+?\/status\/\d+?\??/.test(url));

  if (twitterUrls.length > 0) {
    log('twitterView:', 'urls detected', twitterUrls);

    const page = await browser.newPage();
    page.setRequestInterception(true);

    page.on('request', request => {
      const url = request.url();
      const resourceType = request.resourceType();

      if (BLOCK_URLS.some(x => url.startsWith(x)) || resourceType === 'font') {
        request.abort();
      }
      else {
        request.continue();
      }
    });

    /** @type {string | undefined} */
    let name;
    /** @type {string | undefined} */
    let profileImageUrl;
    /** @type {string | undefined} */
    let createdAt;
    /** @type {number | undefined} */
    let likesCount;
    /** @type {number | undefined} */
    let retweetsCount;
    page.on('response', async response => {
      const url = response.url();

      if (url.startsWith('https://twitter.com/i/api/') && url.includes('TweetDetail?')) {
        const { data } = await response.json();

        if (data == null) return;

        for (const { instructions } of Object.values(data)) {
          if (Array.isArray(instructions)) {
            const { entries } = instructions.find(x => x.type === 'TimelineAddEntries') ?? {};

            if (entries == null) continue;

            const [tweet] = entries;
            const { core, legacy: tweetDetails } = tweet?.content?.itemContent?.tweet_results?.result ?? {};

            if (core != null) {
              const { legacy: userDetails } = core.user_results?.result ?? {};

              if (userDetails != null) {
                name = userDetails.name;
                profileImageUrl = userDetails.profile_image_url_https;
              }
            }

            if (tweetDetails != null) {
              createdAt = tweetDetails.created_at;
              likesCount = tweetDetails.favorite_count;
              retweetsCount = tweetDetails.retweet_count;
              return;
            }
          }
        }
      }
    });

    try {
      const cookies = await fs.readFile('twitter.cookies', 'utf8').then(JSON.parse);
      await page.setCookie(...cookies);
    }
    catch (e) {
      if (e instanceof Error) {
        log('twitterView:', 'failed to open cookie file', e.stack ?? `${e.name}: ${e.message}`);
      }
      else {
        throw e;
      }
    }

    for (const url of twitterUrls) {
      log('twitterView:', 'try to access', url);

      /** @type {ElementHandle<HTMLElement> | null} */
      let article = null;

      await page.goto(url);
      try {
        article = await page.waitForSelector(ARTICLE_SELECTOR, { timeout: 10000 });
      }
      catch (e) {
        if (e instanceof TimeoutError) {
          const cookies = await login();
          await page.setCookie(...cookies);
          await page.goto(url);
          article = await page.waitForSelector(ARTICLE_SELECTOR);
        }
        else {
          throw e;
        }
      }
      log('twitterView:', 'access succeeded', url);

      if (article == null) continue;

      const { id = '' } = url.match(/^https:\/\/(?:mobile\.)?twitter\.com\/(?<id>\w+?)\/status\/\d+?\??/)?.groups ?? {};
      const user = name ?? await page.evaluate(el => el?.textContent ?? '', await article.$('[data-testid="User-Name"] a'));
      const userPic = profileImageUrl ?? await page.evaluate(el => el?.src ?? '', await article.$('[data-testid|="UserAvatar-Container"] img'));
      const tweet = await page.evaluate(el => el?.textContent ?? '', await article.$('[data-testid="tweetText"]'));
      const [firstPic, ...restPics] = await Promise.all((await article.$$('[data-testid="tweetPhoto"] img')).map(el => el.evaluate(x => x.src)));
      const timestamp = createdAt ?? await page.evaluate(el => el?.dateTime, await article.$('time'));
      const likes = likesCount != null ? String(likesCount) : await page.evaluate(el => el?.textContent, await article.$('[href$="/likes"] [data-testid="app-text-transition-container"]'));
      const retweets = retweetsCount != null ? String(retweetsCount) : await page.evaluate(el => el?.textContent, await article.$('[href$="/retweets"] [data-testid="app-text-transition-container"]'));

      log('twitterView:', 'scraping processed');

      /** @type {import('discord.js').APIEmbed[]} */
      const embeds = [];

      const embed = new EmbedBuilder({ url });
      embed.setDescription(tweet);
      embed.setColor(0x1d9bf0);
      embed.setFooter({ text: 'Twitter', iconURL: 'attachment://logo.png' });

      if (user != null) {
        embed.setAuthor({ name: `${user} (@${id})`, url: `https://twitter.com/${id}`, iconURL: userPic });
      }
      if (timestamp != null) {
        embed.setTimestamp(dayjs.utc(timestamp).tz().valueOf());
      }
      if (likes != null && likes !== '0') {
        embed.addFields({ name: 'Likes', value: likes, inline: true });
      }
      if (retweets != null && retweets !== '0') {
        embed.addFields({ name: 'Retweets', value: retweets, inline: true });
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
        const attachment = new AttachmentBuilder(await fs.readFile('./assets/logo/twitter_24x24.png'), { name: 'logo.png' });
        await channel.send({ embeds, files: [attachment] });
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

    await page.close();
  }
});
