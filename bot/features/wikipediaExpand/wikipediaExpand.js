const { Events } = require("discord.js");
const client = require("../../client");
const { log } = require("../../lib/log");
const { urlToDocument } = require('../../lib/util');

client.on(Events.MessageCreate, async message => {
  const { author, content, guild, channel } = message;
  if (author.bot) return;

  const re = /https:\/\/ja\.wikipedia\.org\/(?:wiki\/\S+|\?[\w=&]*curid=\d+)/g;
  const regExpIterator = content.matchAll(re);

  /** @type {APIEmbed[]} */
  const embeds = [];

  for (const [url] of regExpIterator) {
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

      if (title == null) return;
      if (/^[ -~]*? - Wikipedia$/.test(title)) return;

      if (content != null) {
        embeds.push({ author, title, description: content, url });
      }
      else {
        embeds.push({ author, title, url });
      }
    }
    catch (e) {
      if (e instanceof Error) {
        const insideOf = [...(guild != null ? [guild.name] : []), ...('name' in channel ? [channel.name] : [])];
        log(...insideOf, 'wikipediaExpand:', e.stack ?? `${e.name}: ${e.message}`);
      }
    }
  }

  if (embeds.length > 0) {
    await message.reply({ content: 'Wikipedia(ja) 展開', embeds });
  }
});
