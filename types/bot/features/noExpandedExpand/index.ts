import type {
  APIEmbed,
  AttachmentBuilder,
  Awaitable,
  ClientEvents,
} from 'discord.js';

export interface Plugin {
  handlers?: PluginHandlers;
  hooks?: PluginHooks;
}
export type PluginHandlers = Partial<{ [K in keyof ClientEvents]: (...args: ClientEvents[K]) => Awaitable<void> }>;
export type PluginHooks = [string | RegExp, (url: string, index?: number) => Promise<HookResult>][];
export interface HookResult {
  embeds: APIEmbed[];
  attachments: AttachmentBuilder[];
}
