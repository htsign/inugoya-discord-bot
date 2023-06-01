import { EmbedBuilder } from 'discord.js';
import WebSocket from 'ws';
import { isNonEmpty } from 'ts-array-length';
import client from 'bot/client';
import { log } from '@lib/log';
import { dayjs } from '@lib/dayjsSetup';
import { db } from './db';
import type {
  Area,
  AreaPeers,
  EEW,
  EEWDetection,
  JMAQuake,
  JMATsunami,
  UserQuake,
  UserQuakeEvaluation,
  WebSocketResponse,
} from 'types/bot/features/earthquake';

const ws = new WebSocket('wss://api.p2pquake.net/v2/ws');

const quakeCache: Map<string, JMAQuake> = new Map();

ws.once('open', () => {
  log('earthquake: connected');
});
ws.on('message', data => {
  const response: WebSocketResponse = JSON.parse(data.toString());

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

export const intensityFromNumber = (number: number): string =>
  intensityFromNumberCore(number, n => {
    log('earthquake#intensityFromNumber', 'unexpected value:', n);
    return '不明';
  });
export const intensityFromNumberWithException = (number: number): string =>
  intensityFromNumberCore(number, n => {
    log('earthquake#intensityFromNumberWithException', 'unexpected value:', n);
    throw new UnexpectedIntensityError(n);
  });
const intensityFromNumberCore = (number: number, ifUnexpected: (intensity: number) => string): string => {
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

const resolveJMAQuake = async (response: JMAQuake): Promise<void> => {
  quakeCache.set(response.id, response);
};

const resolveJMATsunami = async (response: JMATsunami): Promise<void> => {
  // not implemented
};

const resolveEEWDetection = async (response: EEWDetection): Promise<void> => {
  // not implemented
};

const resolveAreaPeers = async (response: AreaPeers): Promise<void> => {
  // not implemented
};

const resolveEEW = async (response: EEW): Promise<void> => {
  if (!response.test) return;

  const maxIntensityAreas = response.areas.reduce<Area[]>((acc, curr) => {
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

  const areaNames: { [pref: string]: string[] } = {};
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

const resolveUserQuake = async (response: UserQuake): Promise<void> => {
  // not implemented
};

const resolveUserQuakeEvaluation = async (response: UserQuakeEvaluation): Promise<void> => {
  // not implemented
};

export class UnexpectedIntensityError extends Error {
  #intensity: number;

  get intensity() {
    return this.#intensity;
  }

  constructor(intensity: number) {
    super(`unexpected intensity: ${intensity}`);
    this.#intensity = intensity;
  }
}
