import { ChannelType, Events, Guild } from 'discord.js';
import { addHandler } from 'bot/listeners';
import { log } from '@lib/log';
import { db } from './db';

addHandler(Events.ClientReady, async client => {
  for (const { guildId, channelId } of db.records) {
    const channel = await client.channels.fetch(channelId);

    if (channel != null && channel.type === ChannelType.GuildText) {
      let guild: Guild | undefined;
      try {
        guild = await client.guilds.fetch(guildId);
        channel.send('お散歩から帰宅しました。');
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
