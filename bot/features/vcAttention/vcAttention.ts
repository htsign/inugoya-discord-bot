import { type Channel, ChannelType, Events, type Snowflake, type TextChannel, type VoiceState } from 'discord.js';
import { log, logError } from '../../lib/log.ts';
import { addHandler } from '../../listeners.ts';
import { db } from './db.ts';

const thrivingVoiceChannels = new Set<`${Snowflake},${Snowflake}`>();

const getId: (state: VoiceState) => `${Snowflake},${Snowflake}` = state => `${state.guild.id},${state.channelId}`;

addHandler(Events.GuildDelete, guild => {
  db.unregister(guild.id);
});
addHandler(Events.VoiceStateUpdate, async (oldState, newState) => {
  const configRecord = db.get(newState.guild.id);
  if (configRecord == null) return;

  const { guildName, channelId, channelName, threshold } = configRecord;

  const { channelId: oldChannelId } = oldState;
  const { channelId: newChannelId } = newState;

  // someone joined into one of voice channels
  if (newChannelId != null) {
    const newChannel = newState.channel;
    const membersCount = newChannel?.members.size ?? 0;

    log(newState.guild.name, 'member joined:', newChannel?.name, { membersCount });

    if (membersCount >= threshold) {
      const isTargetChannel =
        (channel: Channel): channel is TextChannel => channel.type === ChannelType.GuildText && channel.id === channelId;

      if (!thrivingVoiceChannels.has(getId(newState))) {
        let targetChannel: TextChannel | undefined;
        try {
          targetChannel = await newState.guild.channels.cache.find(isTargetChannel)?.fetch();
        }
        catch (e) {
          if (e instanceof Error) {
            logError(e, 'vcAttention:', `failed to fetch target channel of ${guildName}`);
            return;
          }
          throw e;
        }

        if (targetChannel?.type === ChannelType.GuildText && newChannel?.name != null) {
          thrivingVoiceChannels.add(getId(newState));
          try {
            await targetChannel.send(`@here <#${newChannelId}> が盛り上がっているみたい！`);
          }
          catch (e) {
            if (e instanceof Error) {
              logError(e, 'vcAttention:', `failed to send message to ${guildName}/${channelName}`);
              return;
            }
            throw e;
          }
        }
      }
    }
  }
  // someone left from one of voice channels
  else if (oldChannelId != null) {
    const oldChannel = oldState.channel;
    const membersCount = oldChannel?.members.size ?? 0;

    log(oldState.guild.name, 'member left:', oldChannel?.name, { membersCount });

    if (membersCount < configRecord.threshold) {
      thrivingVoiceChannels.delete(getId(oldState));
    }
  }
});
