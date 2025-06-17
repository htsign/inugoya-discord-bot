import { ChannelType, Events, type Guild } from 'discord.js';
import { log, logError } from '../../lib/log.ts';
import { addHandler } from '../../listeners.ts';
import { db } from './db.ts';

addHandler(Events.ClientReady, async client => {
  if (process.env.DISCORD_BOT_RESTART) {
    return log('launched:', 'do not work because of restart');
  }

  for (const { guildId, channelId } of db.records) {
    const channel = await client.channels.fetch(channelId);

    if (channel != null && channel.type === ChannelType.GuildText) {
      let guild: Guild | undefined;
      try {
        guild = await client.guilds.fetch(guildId);

        await channel.send('🐕️ おさんぽからきたくしたよ！');
        log('launched:', `sent message to ${guild.name}/${channel.name}`);
      }
      catch (e) {
        if (e instanceof Error) {
          if (guild == null) {
            logError(e, 'launched:', `guild which id is ${guildId} is not found`);
          }
          else {
            logError(e, 'launched:', `failed to send message to ${guild.name}/${channel.name}`);
          }
          continue;
        }
        throw e;
      }
    }
  }
});
