import { Awaitable, ClientEvents, Events } from 'discord.js';
import client from '../client';

const listeners: Map<keyof ClientEvents, Set<(...args: any) => Awaitable<void>>> = new Map();

export const addHandler = <K extends keyof ClientEvents>(
  event: K,
  handler: (...args: ClientEvents[K]) => Awaitable<void>,
) => {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(handler);
};

client.once(Events.ClientReady, () => {
  for (const [event, handlers] of listeners) {
    client.on(event, (...args) => {
      for (const handler of handlers) {
        handler(...args);
      }
    });
  }
});
