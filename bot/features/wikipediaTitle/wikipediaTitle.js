const { Events } = require("discord.js");
const client = require("../../client");
const axios = require("axios").default;

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const regExpIterator = message.content.matchAll(/https:\/\/ja\.wikipedia\.org\/(?:wiki\/\S+|\?[\w=&]*curid=\d+)/g);

  /** @type {APIEmbed[]} */
  const embeds = [];

  for (const [url] of regExpIterator) {
    try {
      const { data, status } = await axios.get(url);

      if (status === 200) {
        /** @type {string} */
        const html = data;

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
