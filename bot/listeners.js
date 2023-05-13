const { Client, Events } = require('discord.js');

/** @type {Map<keyof ClientEvents, Set<(...args: any) => Awaitable<void>>>} */
const listeners = new Map();

/**
 * @param {K} event
 * @param {(...args: ClientEvents[K]) => Awaitable<void>} handler
 * @template {keyof ClientEvents} K
 */
const addHandler = (event, handler) => {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)?.add(handler);
};

/**
 * @param {Client<true>} client
 */
const init = client => {
  for (const [event, handlers] of listeners) {
    const hook = (event === Events.ClientReady ? client.once : client.on).bind(client);

    hook(event, (...args) => {
      for (const handler of handlers) {
        handler(...args);
      }
    });
  }
};

module.exports = {
  addHandler,
  init,
};
