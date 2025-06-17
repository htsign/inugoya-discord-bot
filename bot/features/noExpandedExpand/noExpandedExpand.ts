import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Events, type Message, type PartialMessage } from 'discord.js';
import type { HookResult, Plugin } from 'types/bot/features/noExpandedExpand';
import dayjs from '../../lib/dayjsSetup.ts';
import { log, logError } from '../../lib/log.ts';
import { urlsOfText } from '../../lib/util.ts';
import { addHandler } from '../../listeners.ts';

const THRESHOLD_DELAY = 5 * 1000;
const THRESHOLD_FOR_DELETE = 5;

const plugins: Plugin[] = [];

(async () => {
  const selfPath = fileURLToPath(import.meta.url);
  const dirPath = path.dirname(selfPath);
  const pluginDir = path.join(dirPath, 'plugins');

  const addPlugin = async (dirName: string): Promise<void> => {
    const defaultIndexPath = path.join(pluginDir, dirName, 'index.ts');
    const defaultIndexStat = await fs.stat(defaultIndexPath);

    if (defaultIndexStat.isFile()) {
      const relativePath = `./${path.relative(dirPath, defaultIndexPath)}`;
      plugins.push(await import(relativePath));

      log(`noExpandedExpand#${addPlugin.name}:`, 'plugin loaded', relativePath);
    }
  };

  for (const dir of (await fs.readdir(pluginDir, { withFileTypes: true })).filter(ent => ent.isDirectory())) {
    // _default is special treatment
    if (dir.name === '_default') continue;

    await addPlugin(dir.name);
  }
  // insert _default plugin to last of array
  await addPlugin('_default');

  for (const [event, handler] of plugins.flatMap(plugin => Object.entries(plugin.handlers ?? {}))) {
    // @ts-ignore
    addHandler(event, handler);
  }
})();

const targetMessages = new Set<Message<boolean> | PartialMessage>();

addHandler(Events.MessageCreate, async message => {
  const { author, content, guild, channel } = message;
  if (author.bot) return;

  const sendTo = [
    guild != null ? [guild.name] : [],
    'name' in channel ? [channel.name] : [],
  ].flat().join('/');

  targetMessages.add(message);
  await setTimeout(THRESHOLD_DELAY);

  const urls = urlsOfText(content.replace(/\|\|[^\|]+?\|\|/g, '')); // remove spoiled text
  if (targetMessages.has(message) && message.embeds.length < urls.length) {
    const embedUrls = message.embeds.map(embed => embed.url).filter(url => url != null);
    const ignoringUrls =
      (
        await fs.readFile(fileURLToPath(import.meta.resolve('./ignoringUrls.json')), 'utf-8').then(JSON.parse) as string[]
      )
      .map(url => RegExp(url))
      ;
    const targetUrls = urls
      .filter(url => !(embedUrls.includes(url) || ignoringUrls.some(ignoringUrl => ignoringUrl.test(url))))
      .map(url => url.endsWith('||') ? url.slice(0, -'||'.length) : url) // remove tailed '||' if exists
      ;

    if (targetUrls.length > 0) {
      log(`noExpandedExpand[${sendTo}]:`, 'start expanding process', targetUrls);
    }

    const expandingPromises: Promise<HookResult>[] = [];

    process:
    for (const [index, url] of targetUrls.entries()) {
      for (const [pattern, hook] of plugins.flatMap(plugin => plugin.hooks ?? [])) {
        if ((typeof pattern === 'string' && url.startsWith(pattern)) || (typeof pattern === 'object' && pattern.test(url))) {
          const p = hook(url, index).catch(e => {
            log(e);
            return { embeds: [], attachments: [] };
          });
          expandingPromises.push(p);
          continue process;
        }
      }
    }

    const results = await Promise.all(expandingPromises);

    const embeds = results.flatMap(res => res.embeds);
    const files = results.flatMap(res => res.attachments);

    if (targetMessages.has(message) && embeds.length > 0) {
      log(`expand no expanded url[${sendTo}]:`, embeds.map(e => e.url));

      let replied: Message<boolean>;

      try {
        log(`noExpandedExpand[${sendTo}]:`, 'try to reply', message.author.username, message.url);

        const content = 'URL が展開されてないみたいだからこっちで付けとくね';
        replied = await message.reply({ content, embeds, files });
      }
      catch (e) {
        if (e instanceof Error) {
          logError(e, `noExpandedExpand[${sendTo}]:`, `failed to reply to ${author.username}`);
          return;
        }
        throw e;
      }

      // delete replied message if all of original embeds had been created
      const now = dayjs().tz();
      do {
        await setTimeout();

        if (!targetMessages.has(message) || replied.embeds.every(re => message.embeds.some(me => me.url === re.url))) {
          log(`delete expanded url[${sendTo}]:`, embeds.map(e => e.url));

          try {
            await replied.delete();
            break;
          }
          catch (e) {
            if (e instanceof Error) {
              logError(e, `noExpandedExpand[${sendTo}]:`, 'failed to delete replied message');
              break;
            }
            throw e;
          }
        }
      }
      while (dayjs().tz().diff(now, 'seconds') < THRESHOLD_FOR_DELETE);
    }

    targetMessages.delete(message);
  }
});

addHandler(Events.MessageDelete, async message => {
  targetMessages.delete(message);
});
