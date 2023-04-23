import { Events, ChannelType, Snowflake, Channel, VoiceState } from 'discord.js';
import { log } from '@lib/log';
import client from 'bot/client';
import { db } from './db';

const thrivingVoiceChannels = new Set<`${Snowflake},${Snowflake}`>();

const getId = (state: VoiceState): `${Snowflake},${Snowflake}` => `${state.guild.id},${state.channelId}`;

client.on(Events.GuildDelete, guild => {
  db.unregister(guild.id);
});
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const configRecord = db.get(newState.guild.id);
  if (configRecord == null) return;

  const { channelId: oldChannelId } = oldState;
  const { channelId: newChannelId } = newState;

  // someone joined into one of voice channels
  if (newChannelId != null) {
    const newChannel = newState.channel;
    const membersCount = newChannel?.members.size ?? 0;

    log(newState.guild.name, 'member joined:', newChannel?.name, { membersCount });

    if (membersCount >= configRecord.threshold) {
      const isTargetChannel = (channel: Channel): boolean => channel.type === ChannelType.GuildText && channel.name === configRecord.channelName;

      if (!thrivingVoiceChannels.has(getId(newState))) {
        const targetChannel = await newState.guild.channels.cache.find(isTargetChannel)?.fetch();

        if (targetChannel?.type === ChannelType.GuildText && newChannel?.name != null) {
          thrivingVoiceChannels.add(getId(newState));
          await targetChannel.send(`@here <#${newChannelId}> が盛り上がっているみたい！`);
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
