import fs from 'node:fs/promises';
import { APIEmbed, AttachmentBuilder, Client, EmbedBuilder, Events } from 'discord.js';
import puppeteer, { Browser, ElementHandle, PuppeteerLaunchOptions, TimeoutError } from 'puppeteer';
import { dayjs } from '@lib/dayjsSetup';
import { log } from '@lib/log';
import { getEnv } from '@lib/util';
import type { PluginHandlers, PluginHooks } from 'types/bot/features/noExpandedExpand';
import type { TweetDetail, TweetInfo } from 'types/bot/features/noExpandedExpand/twitterView';

const BLOCK_URLS = [
  'https://abs-0.twimg.com/',
  'https://twitter.com/i/api/1.1/dm/inbox_initial_state.json?',
  'https://twitter.com/i/api/2/guide.json?',
  'https://twitter.com/i/api/fleets/v1/fleetline?',
];

const ARTICLE_SELECTOR = 'article[data-testid="tweet"]';

let browser: Browser;

const getLaunchOptions = async (): Promise<PuppeteerLaunchOptions> => {
  try {
    const { default: options } = await import(
      // @ts-ignore
      '../../../noExpandedExpand/plugins/X/launchOptions.json',
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

const initialize = async (client: Client<true>) => {
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

export const handlers: PluginHandlers = {
  [Events.ClientReady]: initialize,
};

export const hooks: PluginHooks = [
  [
    /^https:\/\/(?:mobile\.)?twitter\.com\/\w+?\/status\/\d+?\??/,
    async url => {
      log('twitterView:', 'urls detected', url);

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

      let name: string | undefined;
      let profileImageUrl: string | undefined;
      let tweetBody: string | undefined;
      let pictureUrls: string[] = [];
      let createdAt: string | undefined;
      let likesCount: number | undefined;
      let retweetsCount: number | undefined;
      page.on('response', async response => {
        const url = response.url();

        if (url.startsWith('https://twitter.com/i/api/') && url.includes('TweetDetail?')) {
          const { data } = await response.json();

          if (data == null) return;

          for (const value of Object.values(data)) {
            if (value == null || typeof value !== 'object' || !('instructions' in value)) continue;

            const { instructions } = value;

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
                tweetBody = tweetDetails.full_text;
                createdAt = tweetDetails.created_at;
                likesCount = tweetDetails.favorite_count;
                retweetsCount = tweetDetails.retweet_count;

                const { media = [], urls = [] }: { media: TweetDetail.Media[], urls: TweetDetail.Url[] } = tweetDetails.entities ?? {};
                for (const x of media) {
                  if (tweetBody != null) {
                    tweetBody = tweetBody.replace(' ' + x.url, '');
                  }
                  pictureUrls.push(x.media_url_https);
                }
                for (const x of urls) {
                  if (tweetBody != null) {
                    tweetBody = tweetBody.replace(x.url, `[${x.display_url}](${x.expanded_url})`);
                  }
                }
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

      await page.goto(url);

      const pParsing = (signal: AbortSignal): Promise<TweetInfo> => new Promise((resolve, reject) => {
        const f = () => {
          if (name != null && profileImageUrl != null && tweetBody != null && createdAt != null && likesCount != null && retweetsCount != null) {
            log('parse TweetDetail is completed');

            return resolve({
              user: name,
              userPic: profileImageUrl,
              tweet: tweetBody,
              pics: pictureUrls,
              timestamp: createdAt,
              likes: likesCount,
              retweets: retweetsCount,
            });
          }

          if (signal.aborted) {
            return reject(`abort ${pParsing.name} because of ${pFetching.name} is filled`);
          }
          setTimeout(f, 10);
        }
        f();
      });
      const pFetching = (signal: AbortSignal): Promise<TweetInfo> => new Promise(async (resolve, reject) => {
        /**
         * @returns {boolean} rejected
         */
        const rejectIfAborted = (): boolean => {
          if (signal.aborted) {
            reject(`abort ${pFetching.name} because of ${pParsing.name} is filled`);
            return true;
          }
          if (page.isClosed()) {
            reject('page is closed');
            return true;
          }
          return false;
        };
        log('twitterView:', 'try to access', url);

        let article: ElementHandle<HTMLElement> | null = null;

        try {
          article = await page.waitForSelector(ARTICLE_SELECTOR, { timeout: 10000 });
        }
        catch (e) {
          if (rejectIfAborted()) return;

          if (e instanceof TimeoutError) {
            const cookies = await login();

            try {
              await page.setCookie(...cookies);
              await page.goto(url);

              if (rejectIfAborted()) return;

              article = await page.waitForSelector(ARTICLE_SELECTOR);
            }
            catch {
              if (page.isClosed()) {
                reject('page is closed');
              }
            }
          }
          else {
            throw e;
          }
        }
        log('twitterView:', 'access succeeded', url);

        if (rejectIfAborted()) return;

        if (article == null) {
          throw new Error('article is null');
        }

        try {
          resolve({
            user: await page.evaluate(el => el?.textContent ?? '', await article.$('[data-testid="User-Name"] a')),
            userPic: await page.evaluate(el => el?.src ?? '', await article.$('[data-testid|="UserAvatar-Container"] img')),
            tweet: await page.evaluate(el => el?.textContent ?? '', await article.$('[data-testid="tweetText"]')),
            pics: await Promise.all((await article.$$('[data-testid="tweetPhoto"] img')).map(el => el.evaluate(x => x.src))),
            timestamp: await page.evaluate(el => el?.dateTime ?? '', await article.$('time')),
            likes: await page.evaluate(el => +(el?.textContent?.replaceAll(',', '') ?? 0), await article.$('[href$="/likes"] [data-testid="app-text-transition-container"]')),
            retweets: await page.evaluate(el => +(el?.textContent?.replaceAll(',', '') ?? 0), await article.$('[href$="/retweets"] [data-testid="app-text-transition-container"]')),
          });

          log('twitterView:', 'scraping processed');
        }
        catch {
          if (page.isClosed()) {
            reject('page is closed');
          }
        }
      });

      const ac = new AbortController();

      const { id = '' } = url.match(/^https:\/\/(?:mobile\.)?twitter\.com\/(?<id>\w+?)\/status\/\d+?\??/)?.groups ?? {};
      const { user, userPic, tweet, pics, timestamp, likes, retweets } = await Promise.race([pParsing(ac.signal), pFetching(ac.signal)]).finally(() => ac.abort());
      const [firstPic, ...restPics] = pics;

      const embeds: APIEmbed[] = [];

      const embed = new EmbedBuilder({ url });
      embed.setColor(0x1d9bf0);
      embed.setFooter({ text: 'Twitter', iconURL: 'attachment://logo.png' });

      if (user !== '') {
        embed.setAuthor({ name: `${user} (@${id})`, url: `https://twitter.com/${id}`, iconURL: userPic });
      }
      if (tweet !== '') {
        embed.setDescription(tweet);
      }
      if (timestamp !== '') {
        embed.setTimestamp(dayjs.utc(timestamp).tz().valueOf());
      }
      if (likes !== 0) {
        embed.addFields({ name: 'Likes', value: String(likes), inline: true });
      }
      if (retweets !== 0) {
        embed.addFields({ name: 'Retweets', value: String(retweets), inline: true });
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

      const attachment = new AttachmentBuilder(await fs.readFile('./assets/logo/twitter_24x24.png'), { name: 'logo.png' });

      try {
        return { embeds, attachment };
      }
      finally {
        await page.close();
      }
    }
  ],
];