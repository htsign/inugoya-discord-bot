import {
  ChannelType,
  Events,
  type Guild,
  type NewsChannel,
  type TextChannel,
} from 'discord.js';
import {
  log,
  logError,
} from '#lib/log.ts';
import { addHandler } from '#listeners';
import { db } from './db.ts';

addHandler(Events.ClientReady, async client => {
  if (process.env.DISCORD_BOT_RESTART) {
    return log('launched:', 'do not work because of restart');
  }

  for (const { guildId, channelId } of db.records) {
    let channel: TextChannel | NewsChannel | undefined;
    let guild: Guild | undefined;
    try {
      const fetched = await client.channels.fetch(channelId);

      if (fetched != null && (fetched.type === ChannelType.GuildText || fetched.type === ChannelType.GuildAnnouncement)) {
        channel = fetched;
        guild = await client.guilds.fetch(guildId);

        await channel.send('🐕️ おさんぽからきたくしたよ！');
        log('launched:', `sent message to ${guild.name}/${channel.name}`);
      }
    }
    catch (e) {
      if (e instanceof Error) {
        if (channel == null) {
          logError(e, 'launched:', `failed to fetch the channel which id is ${channelId} (guild id: ${guildId})`);
        }
        else if (guild == null) {
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
});
