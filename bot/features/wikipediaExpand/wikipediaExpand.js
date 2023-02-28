const { Events } = require("discord.js");
const client = require("../../client");

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const re = /https:\/\/ja\.wikipedia\.org\/(?:wiki\/\S+|\?[\w=&]*curid=\d+)/g;
  const regExpIterator = message.content.matchAll(re);

  /** @type {APIEmbed[]} */
  const embeds = [];

  for (const [url] of regExpIterator) {
    try {
      const res = await fetch(url);
      const html = await res.text();

      if (res.status === 200) {
        const [, title] = html.match(/<meta property="og:title" content="([^"]+)"/) ?? [];
        if (title == null) return;
        if (/^[ -~]*? - Wikipedia$/.test(title)) return;

        embeds.push({
          fields: [{ name: title, value: url }],
        });
      }
      else {
        console.log('wikipediaExpand:', { status: res.status });
      }
    }
    catch (e) {
      if (e instanceof Error) {
        console.log(e.name, e.message);
      }
    }
  }

  if (embeds.length > 0) {
    await message.reply({ content: 'Wikipedia(ja) タイトル展開', embeds });
  }
});
