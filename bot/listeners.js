import { Client, Events } from 'discord.js';

/** @type {Map<keyof import('discord.js').ClientEvents, Set<(...args: any) => import('discord.js').Awaitable<void>>>} */
const listeners = new Map();

/**
 * @param {K} event
 * @param {(...args: import('discord.js').ClientEvents[K]) => import('discord.js').Awaitable<void>} handler
 * @template {keyof import('discord.js').ClientEvents} K
 */
export const addHandler = (event, handler) => {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)?.add(handler);
};

/**
 * @param {Client<true>} client
 */
export const init = client => {
  for (const [event, handlers] of listeners) {
    const hook = (event === Events.ClientReady ? client.once : client.on).bind(client);

    hook(event, (...args) => {
      for (const handler of handlers) {
        handler(...args);
      }
    });
  }
};
