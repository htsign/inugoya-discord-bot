const { ApplicationCommandOptionType } = require("discord.js");
const { shortenUrlsOfContent } = require("./shortenUrl");

/** @type {ChatInputCommand} */
module.exports = {
  shorten: {
    description: '与えられたURLを省略します。',
    options: [
      {
        name: 'urls',
        description: '省略したい URL を含んだ文字列（余計な文字は無視されます）',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
    async func(interaction) {
      const content = interaction.options.getString('urls', true);

      const firstReply = await interaction.reply({ content: 'create shorten urls...', fetchReply: true });
      const shortenUrls = await shortenUrlsOfContent(content);

      if (shortenUrls.length > 0) {
        await interaction.editReply(shortenUrls.join('\n'));
      }
      else {
        await firstReply.delete();
        await interaction.followUp({ content: 'URL が見つからないよ！', ephemeral: true });
      }
    },
  },
};
