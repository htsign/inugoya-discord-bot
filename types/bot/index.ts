import type { CacheType, ChatInputApplicationCommandData, ChatInputCommandInteraction } from 'discord.js';

export interface ChatInputCommandFunction<TCacheType extends CacheType = CacheType> {
  func(interaction: ChatInputCommandInteraction<TCacheType>): Promise<void>;
}

export type ChatInputCommand<AdditionalProperties = {}, TCacheType extends CacheType = CacheType> =
  Omit<ChatInputApplicationCommandData, 'name'> & ChatInputCommandFunction<TCacheType> & AdditionalProperties;

export interface ChatInputCommandCollection<AdditionalProperties, TCacheType extends CacheType = CacheType> {
  [commandName: string]: ChatInputCommand<AdditionalProperties, TCacheType>;
}
