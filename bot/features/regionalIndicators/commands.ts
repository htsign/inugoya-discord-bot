import { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, Events, type MessageReaction } from 'discord.js';
import type { ChatInputCommandCollection } from '../../../types/bot/index.ts';
import type { Obj } from '../../../types/index.ts';
import { log, logError } from '../../lib/log.ts';
import { addHandler } from '../../listeners.ts';
import { toEmojis } from './index.ts';

addHandler(Events.InteractionCreate, async interaction => {
  const { guild, channel, user } = interaction;

  if (interaction.isButton()) {
    const { customId } = interaction;

    if (channel == null) {
      log(...[
        guild != null ? [guild.name] : [],
        customId,
        'couldn\'t fetch channel',
      ]);
      try {
        await interaction.reply({ content: '想定外のエラーが発生しました。', ephemeral: true });
        return;
      }
      catch (e) {
        if (e instanceof Error) {
          logError(e, 'regionalIndicators:', `failed to reply to ${user.username}`);
          return;
        }
        throw e;
      }
    }

    if (customId.startsWith('delete_')) {
      const messageId = customId.slice('delete_'.length);
      const { reactions } = channel.messages.cache.get(messageId) ?? await channel.messages.fetch(messageId);

      for (const reaction of reactions.cache.values()) {
        if (reaction.me) {
          try {
            await reaction.remove();
          }
          catch (e) {
            if (e instanceof Error) {
              logError(e, 'regionalIndicators:', `failed to remove ${reaction.emoji.name}`);
              continue;
            }
            throw e;
          }
        }
      }
      try {
        await interaction.reply({ content: '削除しました。', ephemeral: true });
      }
      catch (e) {
        if (e instanceof Error) {
          logError(e, 'regionalIndicators:', `failed to reply to ${user.username}`);
          return;
        }
        throw e;
      }
    }
  }
});

export const commands: ChatInputCommandCollection<void, Obj> = {
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
      if (channel == null || !channel.isTextBased() || channel.isVoiceBased() || !('send' in channel)) {
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

        const reactedEmojis: MessageReaction[] = [];
        for (const emojiText of emojis.values) {
          reactedEmojis.push(await message.react(emojiText));
        }

        const button = new ButtonBuilder({ customId: `delete_${to}`, label: 'やっぱり削除', style: ButtonStyle.Danger });
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
        await interaction.editReply({ components: [row.toJSON()] });
      }
      else {
        await interaction.editReply(emojis.message);
      }
    },
  },
};
