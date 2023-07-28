import type { APIEmbed, AttachmentBuilder, Awaitable, ClientEvents } from 'discord.js';
import { Url } from 'types';

export interface Plugin {
  handlers?: PluginHandlers;
  hooks?: PluginHooks;
}
export type PluginHandlers = Partial<{ [K in keyof ClientEvents]: (...args: ClientEvents[K]) => Awaitable<void> }>;
export type PluginHooks = [string | RegExp, (url: Url, index: number) => Promise<HookResult>][];
export interface HookResult {
  embeds: APIEmbed[];
  attachment: AttachmentBuilder | null;
}
