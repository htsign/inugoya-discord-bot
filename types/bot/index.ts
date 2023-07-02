import type { CacheType, ChatInputApplicationCommandData, ChatInputCommandInteraction } from 'discord.js';

export interface ChatInputCommandFunction<Result, TCacheType extends CacheType = CacheType> {
  func(interaction: ChatInputCommandInteraction<TCacheType>): Promise<Result>;
}

export type ChatInputCommand<FuncResult, AdditionalProperties = {}, TCacheType extends CacheType = CacheType> =
  Omit<ChatInputApplicationCommandData, 'name'> & ChatInputCommandFunction<FuncResult, TCacheType> & AdditionalProperties;

export interface ChatInputCommandCollection<FuncResult, AdditionalProperties, TCacheType extends CacheType = CacheType> {
  [commandName: string]: ChatInputCommand<FuncResult, AdditionalProperties, TCacheType>;
}

export type EmbedMessageOptions = ('reactions' | 'originalLink')[];
