import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { AttachmentBuilder, Events } from 'discord.js';
import dayjs from '../../lib/dayjsSetup.js';
import { addHandler } from '../../listeners.js';
import { log } from '../../lib/log.js';
import { urlsOfText } from '../../lib/util.js';

const THRESHOLD_DELAY = 5 * 1000;
const THRESHOLD_FOR_DELETE = 5;

/** @type {import('types/bot/features/noExpandedExpand').Plugin[]} */
const plugins = [];

(async () => {
  const selfPath = fileURLToPath(import.meta.url);
  const dirPath = path.dirname(selfPath);
  const pluginDir = path.join(dirPath, 'plugins');

  /**
   * @param {string} dirName
   * @returns {Promise<void>}
   */
  const addPlugin = async dirName => {
    const defaultIndexPath = path.join(pluginDir, dirName, 'index.js');
    const defaultIndexStat = await fs.stat(defaultIndexPath);

    if (defaultIndexStat.isFile()) {
      const relativePath = './' + path.relative(dirPath, defaultIndexPath);
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

/** @type {Set<import('discord.js').Message<boolean> | import('discord.js').PartialMessage>} */
const targetMessages = new Set();

addHandler(Events.MessageCreate, async message => {
  const { author, content, guild, channel } = message;
  if (author.bot) return;

  targetMessages.add(message);
  await setTimeout(THRESHOLD_DELAY);

  const urls = urlsOfText(content);
  if (targetMessages.has(message) && message.embeds.length < urls.length) {

    const embedUrls = message.embeds
      .map(embed => embed.url)
      .filter(/** @type {(url: string?) => url is string} */ url => url != null);
    const { default: ignoringUrls } = await import('./ignoringUrls.json', { assert: { type: 'json' } });
    const targetUrls = urls
      .filter(url => !embedUrls.includes(url))
      .filter(url => !ignoringUrls.some(ignoringUrl => url.startsWith(ignoringUrl)));

    /** @type {Promise<import('types/bot/features/noExpandedExpand').HookResult>[]} */
    const expandingPromises = [];

    process:
    for (const [index, url] of targetUrls.entries()) {
      for (const [pattern, hook] of plugins.flatMap(plugin => plugin.hooks ?? [])) {
        if ((typeof pattern === 'string' && url.startsWith(pattern)) || (typeof pattern === 'object' && pattern.test(url))) {
          expandingPromises.push(hook(url, index));
          continue process;
        }
      }
    }

    /** @type {import('types/bot/features/noExpandedExpand').HookResult[]} */
    let results;
    try {
      results = await Promise.all(expandingPromises);
    }
    catch (e) {
      log('noExpandedExpand:', `failed to expand urls`, e);
      return;
    }

    const embeds = results.flatMap(res => res.embeds);
    const files = results.map(res => res.attachment)
      .filter(/** @type {(x: import('discord.js').AttachmentBuilder?) => x is AttachmentBuilder} */ x => x != null);

    if (targetMessages.has(message) && embeds.length > 0) {
      log(
        [
          guild != null ? [guild.name] : [],
          'name' in channel ? [channel.name] : [],
        ].flat().join('/'),
        'expand no expanded url:',
        embeds.map(e => e.url),
      );

      /** @type {import('discord.js').Message<boolean>} */
      let replied;

      try {
        const content = 'URL が展開されてないみたいだからこっちで付けとくね';
        replied = await message.reply({ content, embeds, files });
      }
      catch (e) {
        if (e instanceof Error) {
          log('noExpandedExpand:', `failed to reply to ${author.username}`, e.stack ?? `${e.name}: ${e.message}`);
          return;
        }
        throw e;
      }

      // delete replied message if all of original embeds had been created
      const now = dayjs().tz();
      do {
        await setTimeout();

        if (replied.embeds.every(re => message.embeds.some(me => me.url === re.url))) {
          log(
            [
              guild != null ? [guild.name] : [],
              'name' in channel ? [channel.name] : [],
            ].flat().join('/'),
            'delete expanded url:',
            embeds.map(e => e.url),
          );

          try {
            await replied.delete();
            break;
          }
          catch (e) {
            if (e instanceof Error) {
              log('noExpandedExpand:', `failed to delete replied message`, e.stack ?? `${e.name}: ${e.message}`);
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
