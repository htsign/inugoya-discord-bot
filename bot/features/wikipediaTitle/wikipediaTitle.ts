import { APIEmbed, Events } from 'discord.js';
import axios from 'axios';
import client from '../../client';

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const re = /https:\/\/ja\.wikipedia\.org\/(?:wiki\/\S+|\?[\w=&]*curid=\d+)/g;
  const regExpIterator = message.content.matchAll(re);

  const embeds: APIEmbed[] = [];

  for (const [url] of regExpIterator) {
    try {
      const { data, status } = await axios.get(url);

      if (status === 200) {
        const html: string = data;

        const [, title] = html.match(/<meta property="og:title" content="([^"]+)"/) ?? [];
        if (title == null) return;

        embeds.push({
          fields: [{ name: title, value: url }],
        });
      }
      else {
        console.log(status);
      }
    }
    catch (e) {
      if (axios.isAxiosError(e)) {
        console.log(e.name, e.message);
      }
    }
  }

  if (embeds.length > 0) {
    await message.reply({ content: 'Wikipedia(ja) タイトル展開', embeds });
  }
});
