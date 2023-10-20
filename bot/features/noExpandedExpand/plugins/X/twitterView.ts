import fs from 'node:fs/promises';
import { APIEmbed, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { Browser, ElementHandle, Protocol, TimeoutError } from 'puppeteer';
import { dayjs } from '@lib/dayjsSetup';
import { log } from '@lib/log';
import { getEnv } from '@lib/util';
import { closeBrowserIfNoPages, closePage, getBrowser } from '@lib/fakeBrowser';
import type { PluginHooks } from 'types/bot/features/noExpandedExpand';
import type { TweetDetail, TweetInfo } from 'types/bot/features/noExpandedExpand/twitterView';

const BLOCK_URLS = [
  'https://abs-0.twimg.com/',
  'https://twitter.com/i/api/1.1/dm/inbox_initial_state.json?',
  'https://twitter.com/i/api/2/guide.json?',
  'https://twitter.com/i/api/fleets/v1/fleetline?',
];

const ARTICLE_SELECTOR = 'article[data-testid="tweet"]';

const login = async (browser: Browser): Promise<Protocol.Network.Cookie[]> => {
  log(`twitterView#${login.name}:`, 'try to login');

  const page = await browser.newPage();

  try {
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

    return cookies;
  }
  catch (e) {
    if (e instanceof TimeoutError) {
      log(`twitterView#${login.name}:`, 'login timeout');
    }
    else if (e instanceof Error) {
      log(`twitterView#${login.name}:`, 'login failed', e.stack ?? `${e.name}: ${e.message}`);
    }
    else {
      log(`twitterView#${login.name}:`, 'login failed', e);
    }
    return [];
  }
  finally {
    if (!await closePage(page)) {
      return [];
    }
  }
};

export const hooks: PluginHooks = [
  [
    /^https:\/\/(?:mobile\.)?(?:twitter|x)\.com\/\w+?\/status\/\d+?\??/,
    async url => {
      log('twitterView:', 'urls detected', url);

      const browser = await getBrowser();
      const page = await browser.newPage();
      await page.setRequestInterception(true);

      try {
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

        const htmlEntities = {
          'amp': '&',
          'apos': '\'',
          'quot': '"',
          'nbsp': ' ',
          'lt': '<',
          'gt': '>',
        } as const;

        let name: string | undefined;
        let profileImageUrl: string | undefined;
        let tweetBody: string | undefined;
        let pictureUrls: string[] = [];
        let createdAt: string | undefined;
        let likesCount: number | undefined;
        let retweetsCount: number | undefined;
        let impressionsCount: string | undefined;
        page.on('response', async response => {
          const apiUrl = response.url();

          if (apiUrl.startsWith('https://twitter.com/i/api/') && apiUrl.includes('TweetDetail?')) {
            const [, statusId] = url.match(/\/status\/([0-9]+?)\b/) ?? [];
            if (statusId == null) {
              log(`twitterView[${url}]:`, 'failed to get tweet details', 'no statusId');
              return;
            }

            const { data, errors } = await response.json()
              // if redirect response is returned, it's an error
              .catch(_ => ({ errors: [{ name: 'ParseError', code: response.status(), message: apiUrl }] }));

            if (Array.isArray(errors)) {
              for (const { name, code, message } of errors) {
                log(`twitterView[${url}]:`, 'failed to get tweet details', `${name}: [${code}] ${message}`);
              }
              return;
            }

            if (data == null) return;

            for (const value of Object.values(data)) {
              if (value == null || typeof value !== 'object' || !('instructions' in value)) continue;

              const { instructions } = value;

              if (Array.isArray(instructions)) {
                const { entries } = instructions.find(x => x.type === 'TimelineAddEntries') ?? {};

                  if (entries == null) continue;

                const tweet = [...entries].find(x => x.entryId === `tweet-${statusId}`);
                const { core, views, legacy: tweetDetails } = tweet?.content?.itemContent?.tweet_results?.result ?? {};

                if (core != null) {
                  const { legacy: userDetails } = core.user_results?.result ?? {};

                  if (userDetails != null) {
                    name = userDetails.name;
                    profileImageUrl = userDetails.profile_image_url_https;
                  }
                }

                if (views?.count != null) {
                  impressionsCount = views.count;
                }

                if (tweetDetails != null) {
                  tweetBody = Object.entries(htmlEntities)
                    .reduce((acc, [entity, sym]) => acc.replaceAll(`&${entity};`, sym), tweetDetails.full_text ?? '');
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
            log(`twitterView[${url}]:`, 'failed to open cookie file', e.stack ?? `${e.name}: ${e.message}`);
          }
          else {
            throw e;
          }
        }

        await page.goto(url);

        const pParsing = (signal: AbortSignal): Promise<TweetInfo> => new Promise((resolve, reject) => {
          const f = () => {
            if (name != null && profileImageUrl != null && tweetBody != null && createdAt != null && likesCount != null && retweetsCount != null) {
              log(`twitterView[${url}]:`, 'parse TweetDetail is completed');

              return resolve({
                user: name,
                userPic: profileImageUrl,
                tweet: tweetBody,
                pics: pictureUrls,
                timestamp: createdAt,
                likes: likesCount,
                retweets: retweetsCount,
                impressions: impressionsCount,
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
              const message = `abort ${pFetching.name} because of ${pParsing.name} is filled`;
              reject(message);
              log(`twitterView[${url}]:`, message);
              return true;
            }
            if (page.isClosed()) {
              const message = 'page is closed';
              reject(message);
              log(`twitterView[${url}]:`, message);
              return true;
            }
            return false;
          };
          log(`twitterView[${url}]:`, 'try to access');

          let article: ElementHandle<HTMLElement> | null = null;

          try {
            article = await page.waitForSelector(ARTICLE_SELECTOR, { timeout: 10000 });
          }
          catch (e) {
            if (rejectIfAborted()) return;

            if (e instanceof TimeoutError) {
              const cookies = await login(browser);

              if (cookies.length === 0) {
                reject('failed to login');
                log(`twitterView[${url}]:`, 'failed to login');
                return;
              }

              try {
                await page.setCookie(...cookies);
                await page.goto(url);

                if (rejectIfAborted()) return;

                article = await page.waitForSelector(ARTICLE_SELECTOR);
              }
              catch {
                if (page.isClosed()) {
                  const message = 'page is closed';
                  reject(message);
                  log(`twitterView[${url}]:`, message);
                }
              }
            }
            else if (e instanceof Error) {
              log(`twitterView[${url}]:`, 'access failed', e.stack ?? `${e.name}: ${e.message}`);
              return reject('access failed');
            }
            else {
              throw e;
            }
          }
          log(`twitterView[${url}]:`, 'access succeeded');

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

            log(`twitterView[${url}]:`, 'scraping processed');
          }
          catch {
            if (page.isClosed()) {
              reject('page is closed');
            }
          }
        });

        const ac = new AbortController();

        const { id = '' } = url.match(/^https:\/\/(?:mobile\.)?(?:twitter|x)\.com\/(?<id>\w+?)\/status\/\d+?\??/)?.groups ?? {};
        const { user, userPic, tweet, pics, timestamp, likes, retweets, impressions } =
          await Promise.race([pParsing(ac.signal), pFetching(ac.signal)])
            .finally(() => ac.abort())
            .catch(e => {
              const logItem = e instanceof Error ? (e.stack ?? `${e.name}: ${e.message}`) : e;
              log(`twitterView[${url}]:`, logItem);

              return { user: '', userPic: '', tweet: '', pics: [], timestamp: '', likes: 0, retweets: 0 } as TweetInfo;
            });
        const [firstPic, ...restPics] = pics;

        const embeds: APIEmbed[] = [];
        const attachments: AttachmentBuilder[] = [];

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
        if (impressions != null && impressions !== '0') {
          embed.addFields({ name: 'Impressions', value: String(impressions), inline: true });
        }

        if (firstPic != null) {
          embed.setImage(firstPic);
        }

        embeds.push(embed.toJSON());
        attachments.push(new AttachmentBuilder(await fs.readFile('./assets/logo/twitter_24x24.png'), { name: 'logo.png' }));

        for (const pic of restPics) {
          const embed = new EmbedBuilder({ url });
          embed.setImage(pic);
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
      finally {
        await closePage(page);
        await closeBrowserIfNoPages();
      }
    }
  ],
];
