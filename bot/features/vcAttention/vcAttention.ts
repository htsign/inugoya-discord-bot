import {
  type Channel,
  ChannelType,
  Events,
  type NewsChannel,
  type Snowflake,
  type TextChannel,
  type VoiceState,
} from 'discord.js';
import {
  log,
  logError,
} from '#lib/log.ts';
import { addHandler } from '#listeners';
import { unregisterIfUnreachable } from '../util.ts';
import { db } from './db.ts';

const thrivingVoiceChannels = new Map<`${Snowflake},${Snowflake}`, symbol>();

const getId: (state: VoiceState) => `${Snowflake},${Snowflake}` = state => `${state.guild.id},${state.channelId}`;

export const clearThrivingVoiceChannels = (guildId: Snowflake): void => {
  for (const id of thrivingVoiceChannels.keys()) {
    if (id.startsWith(`${guildId},`)) thrivingVoiceChannels.delete(id);
  }
};

const unregisterVcAttention = async (guildId: Snowflake): Promise<void> => {
  await db.unregister(guildId);
  clearThrivingVoiceChannels(guildId);
};

addHandler(Events.GuildDelete, async guild => {
  await unregisterVcAttention(guild.id);
});
addHandler(Events.VoiceStateUpdate, async (oldState, newState) => {
  const configRecord = db.get(newState.guild.id);
  if (configRecord == null) return;

  const { guildId, guildName, channelId, channelName, threshold } = configRecord;

  const { channelId: oldChannelId } = oldState;
  const { channelId: newChannelId } = newState;

  // someone left from one of voice channels
  if (oldChannelId != null && oldChannelId !== newChannelId) {
    const oldChannel = oldState.channel;
    const membersCount = oldChannel?.members.size ?? 0;

    log(oldState.guild.name, 'member left:', oldChannel?.name, { membersCount });

    if (membersCount < threshold) {
      thrivingVoiceChannels.delete(getId(oldState));
    }
  }

  // someone joined into one of voice channels
  if (newChannelId != null) {
    const newChannel = newState.channel;
    const membersCount = newChannel?.members.size ?? 0;

    log(newState.guild.name, 'member joined:', newChannel?.name, { membersCount });

    if (membersCount >= threshold) {
      const isTargetChannel = (channel: Channel): channel is TextChannel | NewsChannel =>
        (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) && channel.id === channelId;

      const id = getId(newState);
      if (!thrivingVoiceChannels.has(id)) {
        const mark = Symbol();
        thrivingVoiceChannels.set(id, mark);

        let notified = false;
        try {
          let targetChannel: TextChannel | NewsChannel | undefined;
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

          if (targetChannel != null && newChannel?.name != null) {
            try {
              await targetChannel.send(`@here <#${newChannelId}> が盛り上がっているみたい！`);
              notified = true;
            }
            catch (e) {
              if (e instanceof Error) {
                if (await unregisterIfUnreachable(e, 'vcAttention:', guildId, channelId, () => unregisterVcAttention(guildId))) return;

                logError(e, 'vcAttention:', `failed to send message to ${guildName}/${channelName}`);
                return;
              }
              throw e;
            }
          }
        }
        finally {
          if (!notified && thrivingVoiceChannels.get(id) === mark) thrivingVoiceChannels.delete(id);
        }
      }
    }
  }
});
