const { Events, ChannelType } = require('discord.js');
const client = require('../../client');
const { log } = require('../../lib/log');
const { db } = require('./db');

/** @type {Set<`${Snowflake},${Snowflake}`>} */
const thrivingVoiceChannels = new Set();

/** @type {(state: VoiceState) => `${Snowflake},${Snowflake}`} */
const getId = state => `${state.guild.id},${state.channelId}`;

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
      /** @type {function(Channel): boolean} */
      const isTargetChannel = channel => channel.type === ChannelType.GuildText && channel.name === configRecord.channelName;

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
