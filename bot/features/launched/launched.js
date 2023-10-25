import { ChannelType, Events } from 'discord.js';
import { addHandler } from '../../listeners.js';
import { log } from '../../lib/log.js';
import { db } from './db.js';

addHandler(Events.ClientReady, async client => {
  for (const { guildId, channelId } of db.records) {
    const channel = await client.channels.fetch(channelId);

    if (channel != null && channel.type === ChannelType.GuildText) {
      /** @type {import('discord.js').Guild | undefined} */
      let guild;
      try {
        guild = await client.guilds.fetch(guildId);

        await channel.send('🐕️ おさんぽからきたくしたよ！');
        log('launched:', `sent message to ${guild.name}/${channel.name}`);
      }
      catch (e) {
        if (e instanceof Error) {
          if (guild == null) {
            log('launched:', `guild which id is ${guildId} is not found`, e.stack ?? `${e.name}: ${e.message}`);
          }
          else {
            log('launched:', `failed to send message to ${guild.name}/${channel.name}`, e.stack ?? `${e.name}: ${e.message}`);
          }
          continue;
        }
        throw e;
      }
    }
  }
});
