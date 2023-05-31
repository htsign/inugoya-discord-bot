import { EmbedBuilder } from 'discord.js';
import WebSocket from 'ws';
import { isNonEmpty } from 'ts-array-length';
import client from '../../client.js';
import { log } from '../../lib/log.js';
import { db } from './db.js';

const ws = new WebSocket('wss://api.p2pquake.net/v2/ws');

/** @type {Map<string, import('types/bot/features/earthquake').JMAQuake>} */
const quakeCache = new Map();

ws.once('open', () => {
  log('earthquake: connected');
});
ws.on('message', data => {
  /** @type {import('types/bot/features/earthquake').WebSocketResponse} */
  const response = JSON.parse(data.toString());

  switch (response.code) {
    case 551: return resolveJMAQuake(response);
    case 552: return resolveJMATsunami(response);
    case 554: return resolveEEWDetection(response);
    case 555: return resolveAreaPeers(response);
    case 556: return resolveEEW(response);
    case 561: return resolveUserQuake(response);
    case 9611: return resolveUserQuakeEvaluation(response);
  }
});

/**
 * @param {number} number
 * @returns {string}
 */
export const intensityFromNumber = number =>
  intensityFromNumberCore(number, n => {
    log('earthquake#intensityFromNumber', 'unexpected value:', n);
    return '不明';
  });
/**
 * @param {number} number
 * @returns {string}
 */
export const intensityFromNumberWithException = number =>
  intensityFromNumberCore(number, n => {
    log('earthquake#intensityFromNumberWithException', 'unexpected value:', n);
    throw new UnexpectedIntensityError(n);
  });
/**
 * @param {number} number
 * @param {(intensity: number) => string} ifUnexpected
 * @returns {string}
 */
const intensityFromNumberCore = (number, ifUnexpected) => {
  switch (number) {
    case -1: return '不明';
    case  0: return '震度0';
    case 10: return '震度1';
    case 20: return '震度2';
    case 30: return '震度3';
    case 40: return '震度4';
    case 45: return '震度5弱';
    case 50: return '震度5強';
    case 55: return '震度6弱';
    case 60: return '震度6強';
    case 70: return '震度7';
    case 99: return '震度7程度以上';
    default: return ifUnexpected(number);
  }
};

/**
 * @param {import('types/bot/features/earthquake').JMAQuake} response
 * @returns {Promise<void>}
 */
const resolveJMAQuake = async response => {
  quakeCache.set(response.id, response);
};

/**
 * @param {import('types/bot/features/earthquake').JMATsunami} response
 * @returns {Promise<void>}
 */
const resolveJMATsunami = async response => {
  // not implemented
};

/**
 * @param {import('types/bot/features/earthquake').EEWDetection} response
 * @returns {Promise<void>}
 */
const resolveEEWDetection = async response => {
  // not implemented
};

/**
 * @param {import('types/bot/features/earthquake').AreaPeers} response
 * @returns {Promise<void>}
 */
const resolveAreaPeers = async response => {
  // not implemented
};

/**
 * @param {import('types/bot/features/earthquake').EEW} response
 * @returns {Promise<void>}
 */
const resolveEEW = async response => {
  if (!response.test) return;

  const maxIntensityAreas = response.areas.reduce((/** @type {import('types/bot/features/earthquake').Area[]} */ acc, curr) => {
    if (isNonEmpty(acc)) {
      const [first] = acc;
      if (first.scaleTo === curr.scaleTo) {
        return acc.concat(curr);
      }
      return first.scaleTo < curr.scaleTo ? [curr] : acc;
    }
    return [curr];
  }, [])
    .sort((a, b) => a.pref > b.pref ? 1 : -1);

  const maxIntensity = Math.max(...maxIntensityAreas.map(x => x.scaleTo));
  const intensity = intensityFromNumber(maxIntensity);

  for (const record of db.records) {
    if (maxIntensity < record.minIntensity) continue;

    const guild = client.guilds.cache.get(record.guildId) ?? await client.guilds.fetch(record.guildId);
    const channel = guild.channels.cache.get(record.channelId) ?? await guild.channels.fetch(record.channelId);

    if (channel?.isTextBased() && response.earthquake != null) {
      /** @type {{ [pref: string]: string[] }} */
      const areaNames = {};
      for (const { pref, name } of maxIntensityAreas) {
        if (Object.hasOwn(areaNames, pref)) {
          areaNames[pref]?.push(name);
        }
        else {
          areaNames[pref] = [name];
        }
      }

      const embed = new EmbedBuilder();
      embed.addFields({ name: '最大予測震度', value: intensity });
      embed.addFields({
        name: '最大震度観測予定地',
        value: Object.entries(areaNames).map(([pref, names]) => `${pref}: ${names.join('、')}`).join('\n'),
      });
      embed.addFields({ name: '発生日時', value: response.earthquake.originTime });

      const embeds = [embed];
      channel.send({ content: '緊急地震速報です。', embeds });
    }
  }
};

/**
 * @param {import('types/bot/features/earthquake').UserQuake} response
 * @returns {Promise<void>}
 */
const resolveUserQuake = async response => {
  // not implemented
};

/**
 * @param {import('types/bot/features/earthquake').UserQuakeEvaluation} response
 * @returns {Promise<void>}
 */
const resolveUserQuakeEvaluation = async response => {
  // not implemented
};

export class UnexpectedIntensityError extends Error {
  /** @type {number} */
  #intensity;

  get intensity() {
    return this.#intensity;
  }

  /**
   * @constructor
   * @param {number} intensity
   */
  constructor(intensity) {
    super(`unexpected intensity: ${intensity}`);
    this.#intensity = intensity;
  }
}
