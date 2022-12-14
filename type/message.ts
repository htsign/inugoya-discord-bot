import { Message as _Message, PartialMessage } from 'discord.js';

export type Message<T extends boolean> = _Message<T> | PartialMessage;
