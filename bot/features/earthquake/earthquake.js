import { EmbedBuilder } from 'discord.js';
import WebSocket from 'ws';
import { isNonEmpty } from 'ts-array-length';
import client from '../../client.js';
import { log } from '../../lib/log.js';
import dayjs from '../../lib/dayjsSetup.js';
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

  // actual data does not have "id", but has "_id"
  if (response.id == null) {
    response.id = response._id;
  }

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
 * @returns {'不明' | `震度${0 | 1 | 2 | 3 | 4}` | `震度${5 | 6}${'弱' | '強'}` | `震度7${'' | '程度以上'}`}
 */
export const intensityFromNumber = number =>
  intensityFromNumberCore(number, n => {
    log('earthquake#intensityFromNumber', 'unexpected value:', n);
    return '不明';
  });
/**
 * @param {number} number
 * @returns {ReturnType<typeof intensityFromNumber> | never}
 */
export const intensityFromNumberWithException = number =>
  intensityFromNumberCore(number, n => {
    log('earthquake#intensityFromNumberWithException', 'unexpected value:', n);
    throw new UnexpectedIntensityError(n);
  });
/**
 * @param {number} number
 * @param {(intensity: number) => S} ifUnexpected
 * @returns {ReturnType<typeof intensityFromNumber> | S}
 * @template {string} S
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

  let groupedByIntensityAreas = (response.points ?? [])
    .reduce((/** @type {Map<number, import('types/bot/features/earthquake').ObservationPoint[]>} */ acc, curr) => {
      const group = acc.get(curr.scale) ?? [];
      if (isNonEmpty(group)) {
        return acc.set(curr.scale, group.concat(curr).sort((a, b) => a.addr > b.addr ? 1 : -1));
      }
      else {
        return acc.set(curr.scale, [curr]);
      }
    }, new Map());
  // sort by intensity scale
  groupedByIntensityAreas = new Map([...groupedByIntensityAreas].sort(([a], [b]) => b - a));

  if (groupedByIntensityAreas.size === 0 || response.earthquake.hypocenter == null) {
    return log('resolveJMAQuake:', 'no data', JSON.stringify(response));
  }

  const { hypocenter: { name, magnitude, depth }, maxScale } = response.earthquake;
  const maxIntensity = intensityFromNumber(maxScale);

  for (const { guildId, channelId, minIntensity } of db.records) {
    if (maxScale < minIntensity) continue;

    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);

    if (channel?.isTextBased()) {
      const sentences = [`${name}で最大${maxIntensity}の地震が発生しました。`];
      if (magnitude !== -1) {
        sentences.push(`マグニチュードは ${magnitude}。`);
      }
      if (depth !== -1) {
        sentences.push(`震源の深さはおよそ ${depth}km です。`)
      }

      const embed = new EmbedBuilder()
        .setTitle('地震情報')
        .setDescription(sentences.join('\n'))
        .setTimestamp(dayjs(response.time).valueOf());

      const message = await channel.send({ embeds: [embed] });
      const thread = await message.startThread({ name: `${response.time} 震度別地域詳細` });

      for (const [intensity, observations] of groupedByIntensityAreas) {
        const embed = new EmbedBuilder()
          .setTitle(intensityFromNumber(intensity));

        const groupedByPrefPoints = observations.reduce((/** @type {Map<string, string[]>} */ acc, curr) => {
          const group = acc.get(curr.pref) ?? [];
          if (isNonEmpty(group)) {
            return acc.set(curr.pref, group.concat(curr.addr).sort());
          }
          else {
            return acc.set(curr.pref, [curr.addr]);
          }
        }, new Map());

        for (const [pref, points] of groupedByPrefPoints) {
          embed.addFields({ name: pref, value: points.join('、') });
        }

        await thread.send({ embeds: [embed] });
      }
    }
  }
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

  if (maxIntensityAreas.length === 0 || response.earthquake == null) {
    return log('resolveEEW:', 'no data', JSON.stringify(response));
  }

  const maxIntensity = Math.max(...maxIntensityAreas.map(x => x.scaleTo));
  const intensity = intensityFromNumber(maxIntensity);
  if (maxIntensity < 10 || intensity === '不明') {

  }

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
  const maxIntensityAreaNames =
    Object.entries(areaNames).map(([pref, names]) => `${pref}: ${names.join('、')}`);

  for (const { guildId, channelId, minIntensity } of db.records) {
    if (maxIntensity < minIntensity) continue;

    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);

    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('緊急地震速報')
        .setTimestamp(dayjs(response.time).tz().valueOf());

      embed.addFields({ name: '最大予測震度', value: intensity });
      embed.addFields({
        name: '最大震度観測予定地',
        value: maxIntensityAreaNames.join('\n'),
      });
      embed.addFields({ name: '発生日時', value: response.earthquake.originTime });

      channel.send({ embeds: [embed] });
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
