const { Events } = require('discord.js');
const client = require('../client');

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

client.once(Events.ClientReady, () => {
  for (const [event, handlers] of listeners) {
    client.on(event, (...args) => {
      for (const handler of handlers) {
        handler(...args);
      }
    });
  }
});

module.exports = { addHandler };
