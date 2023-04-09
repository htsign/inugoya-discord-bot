const { Events, ChannelType } = require("discord.js");
const client = require("../../client");
const { log } = require("../../lib/log");

const THRIVING_THRESHOLD = 3;

/** @type {Set<Snowflake>} */
const thrivingVoiceChannels = new Set();

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const { channelId: oldChannelId } = oldState;
  const { channelId: newChannelId } = newState;

  // someone joined into one of voice channels
  if (newChannelId != null) {
    const newChannel = newState.channel;
    const membersCount = newChannel?.members.size ?? 0;

    log(newState.guild.name, 'member joined:', newChannel?.name, { membersCount });

    if (membersCount >= THRIVING_THRESHOLD) {
      /** @type {function(Channel): boolean} */
      const isVcChat = channel => channel.type === ChannelType.GuildText && channel.name === 'vc-chat';

      if (!thrivingVoiceChannels.has(newChannelId)) {
        const vcChat = await client.channels.cache.find(isVcChat)?.fetch();

        if (vcChat?.type === ChannelType.GuildText && newChannel?.name != null) {
          thrivingVoiceChannels.add(newChannelId);
          await vcChat.send(`@here <#${newChannelId}> が盛り上がっているみたい！`);
        }
      }
    }
  }
  // someone left from one of voice channels
  else if (oldChannelId != null) {
    const oldChannel = oldState.channel;
    const membersCount = oldChannel?.members.size ?? 0;

    log(oldState.guild.name, 'member left:', oldChannel?.name, { membersCount });

    if (membersCount < THRIVING_THRESHOLD) {
      thrivingVoiceChannels.delete(oldChannelId);
    }
  }
});
