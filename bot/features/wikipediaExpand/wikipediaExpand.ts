import { APIEmbed, APIEmbedAuthor, Events } from 'discord.js';
import client from 'bot/client';
import { log } from '@lib/log';
import { urlToDocument } from '@lib/util';

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const re = /https:\/\/ja\.wikipedia\.org\/(?:wiki\/\S+|\?[\w=&]*curid=\d+)/g;
  const regExpIterator = message.content.matchAll(re);

  const embeds: APIEmbed[] = [];

  for (const [url] of regExpIterator) {
    try {
      const document = await urlToDocument(url);

      const author: APIEmbedAuthor = {
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
        log('wikipediaExpand:', e.stack ?? `${e.name}: ${e.message}`);
      }
    }
  }

  if (embeds.length > 0) {
    await message.reply({ content: 'Wikipedia(ja) 展開', embeds });
  }
});
