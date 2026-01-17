import {
  type Awaitable,
  type Client,
  type ClientEvents,
  Events,
} from 'discord.js';

// biome-ignore lint/suspicious/noExplicitAny: there's no way to type ClientEvents[K] properly
const listeners = new Map<keyof ClientEvents, Set<(...args: any) => Awaitable<void>>>();

export const addHandler = <K extends keyof ClientEvents>(event: K, handler: (...args: ClientEvents[K]) => Awaitable<void>) => {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)?.add(handler);
};

export const init = (client: Client<true>) => {
  for (const [event, handlers] of listeners) {
    const hook = (event === Events.ClientReady ? client.once : client.on).bind(client);

    hook(event, (...args) => {
      for (const handler of handlers) {
        handler(...args);
      }
    });
  }
};
