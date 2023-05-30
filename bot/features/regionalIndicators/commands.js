import { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, Events, MessageReaction } from 'discord.js';
import { addHandler } from '../../listeners.js';
import { log } from '../../lib/log.js';
import { toEmojis } from './index.js';

addHandler(Events.InteractionCreate, async interaction => {
  const { guild, channel } = interaction;

  if (interaction.isButton()) {
    const { customId } = interaction;

    if (channel == null) {
      log(...[
        guild != null ? [guild.name] : [],
        customId,
        'couldn\'t fetch channel',
      ]);
      interaction.reply({ content: '想定外のエラーが発生しました。', ephemeral: true });
      return;
    }

    if (customId.startsWith('delete_')) {
      const messageId = customId.slice('delete_'.length);
      const { reactions } = channel.messages.cache.get(messageId) ?? await channel.messages.fetch(messageId);

      for (const reaction of reactions.cache.values()) {
        if (reaction.me) {
          reaction.remove();
        }
      }
      interaction.reply({ content: '削除しました。', ephemeral: true });
    }
  }
});

/** @type {import('types/bot').ChatInputCommandCollection<void, {}>} */
export const commands = {
  emojify: {
    description: 'アルファベット絵文字で連続リアクションします。',
    options: [
      {
        name: 'to',
        description: 'リアクションを送るメッセージのID',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'text',
        description: '与えるリアクションのアルファベット文字列',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
    async func(interaction) {
      const to = interaction.options.getString('to', true);
      const text = interaction.options.getString('text', true);

      const { channel } = interaction;
      if (channel == null || !channel.isTextBased() || channel.isVoiceBased()) {
        await interaction.reply({ content: '対応していないチャンネルです。', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const messages = await channel.messages.fetch();
      const message = messages?.get(to);

      if (message == null) {
        await interaction.editReply('与えられたメッセージIDに対応するメッセージが見付かりませんでした。');
        return;
      }

      const emojis = toEmojis(text);
      if (emojis.success) {
        await channel.send(`${interaction.user} が \`/emojify "${text}"\` を使用しました。`);

        /** @type {MessageReaction[]} */
        const reactedEmojis = [];
        for (const emojiText of emojis.values) {
          reactedEmojis.push(await message.react(emojiText));
        }

        const button = new ButtonBuilder({ customId: `delete_${to}`, label: 'やっぱり削除', style: ButtonStyle.Danger });
        /** @type {ActionRowBuilder<ButtonBuilder>} */ // @ts-ignore
        const row = new ActionRowBuilder().addComponents(button);
        await interaction.editReply({ components: [row.toJSON()] });
      }
      else {
        await interaction.editReply(emojis.message);
      }
    },
  },
};
