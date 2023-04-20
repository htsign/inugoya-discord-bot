import { APIEmbed, APIEmbedAuthor, Channel, Events, Guild } from 'discord.js';
import client from 'bot/client';
import { log } from '@lib/log';
import { urlToDocument } from '@lib/util';

const HOST = 'https://ja.wikipedia.org/';

const core = async (url: string, guild: Guild | null, channel: Channel): Promise<APIEmbed | null> => {
  try {
    const document = await urlToDocument(url);

    const author: APIEmbedAuthor = {
      name: 'Wikipedia',
      url: HOST,
      icon_url: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png',
    };
    const title = document.querySelector('title')?.textContent;
    const content = document.getElementById('bodyContent')?.querySelector('p:not([class*="empty"])')?.textContent?.trim();

    if (title == null) return null;
    if (/^[ -~]*? - Wikipedia$/.test(title)) return null;

    const embed: APIEmbed = { author, title, url };
    if (content != null) {
      return { ...embed, description: content };
    }
    else {
      return embed;
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

  const re = /https:\/\/ja(?:\.m)\.wikipedia\.org\/(wiki\/\S+|\?[\w=&]*curid=\d+)/g;
  const regExpIterator = content.matchAll(re);

  const urlToEmbedPromises: Promise<APIEmbed | null>[] = [];

  console.log(content);
  for (const [, path] of regExpIterator) {
    console.log(path, HOST + path);
    urlToEmbedPromises.push(core(HOST + path, guild, channel));
  }
  const embeds = (await Promise.all(urlToEmbedPromises))
    .filter((x: APIEmbed | null): x is APIEmbed => x != null);

  if (embeds.length > 0) {
    log(
      [
        guild != null ? [guild.name] : [],
        'name' in channel ? [channel.name] : [],
      ].flat().join('/'),
      'expand wikipedia(ja):',
      embeds.map(e => e.url),
    );

    await message.reply({ content: 'Wikipedia(ja) 展開', embeds });
  }
});
