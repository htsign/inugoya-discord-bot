const { Events, Guild } = require('discord.js');
const client = require('../../client');
const { log } = require('../../lib/log');
const { urlToDocument } = require('../../lib/util');

/**
 * @param {string} url
 * @param {Guild?} guild
 * @param {Channel} channel
 * @returns {Promise<APIEmbed?>}
 */
const core = async (url, guild, channel) => {
  try {
    const document = await urlToDocument(url);

    /** @type {APIEmbedAuthor} */
    const author = {
      name: 'Wikipedia',
      url: 'https://ja.wikipedia.org/',
      icon_url: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png',
    };
    const title = document.querySelector('title')?.textContent;
    const content = document.getElementById('bodyContent')?.querySelector('p:not([class*="empty"])')?.textContent?.trim();

    if (title == null) return null;
    if (/^[ -~]*? - Wikipedia$/.test(title)) return null;

    if (content != null) {
      return { author, title, description: content, url };
    }
    else {
      return { author, title, url };
    }
  }
  catch (e) {
    if (e instanceof Error) {
      const insideOf = [...(guild != null ? [guild.name] : []), ...('name' in channel ? [channel.name] : [])];
      log(...insideOf, 'wikipediaExpand:', e.stack ?? `${e.name}: ${e.message}`);

      return null;
    }
    throw e;
  }
};

client.on(Events.MessageCreate, async message => {
  const { author, content, guild, channel } = message;
  if (author.bot) return;

  const re = /https:\/\/ja\.wikipedia\.org\/(?:wiki\/\S+|\?[\w=&]*curid=\d+)/g;
  const regExpIterator = content.matchAll(re);

  /** @type {Promise<APIEmbed?>[]} */
  const urlToEmbedPromises = [];

  for (const [url] of regExpIterator) {
    urlToEmbedPromises.push(core(url, guild, channel));
  }
  const embeds = (await Promise.all(urlToEmbedPromises))
    .filter(/** @type {(x: APIEmbed?) => x is APIEmbed} */ x => x != null);

  if (embeds.length > 0) {
    await message.reply({ content: 'Wikipedia(ja) 展開', embeds });
  }
});
