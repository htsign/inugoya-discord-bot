import { URL } from 'node:url';
import { AttachmentBuilder, Colors, EmbedBuilder, ThreadAutoArchiveDuration } from 'discord.js';
import WebSocket from 'ws';
import { isNonEmpty } from 'ts-array-length';
import client from '../../client.js';
import { getEnv } from '../../lib/util.js';
import { log } from '../../lib/log.js';
import dayjs from '../../lib/dayjsSetup.js';
import { db } from './db.js';
import { geocode } from './geocoding.js';

const debug = false;
const ENDPOINT = `wss://${debug ? 'api-realtime-sandbox' : 'api'}.p2pquake.net/v2/ws`;

/**
 * @param {string} address
 * @param {(data: WebSocket.RawData, isBinary: boolean) => void} onMessage
 * @returns {WebSocket}
 */
const connectWebSocket = (address, onMessage) => {
  const ws = new WebSocket(address);

  ws.on('open', () => {
    log('earthquake: connected');
  });
  ws.on('message', onMessage);
  ws.on('error', error => {
    log('earthquake: error', error);
    ws.close();
  });
  ws.on('close', (code, reason) => {
    log('earthquake: disconnected', `[${code}] ${reason.toString()}`);
    setTimeout(() => connectWebSocket(address, onMessage), 1000);
  });

  return ws;
};

connectWebSocket(ENDPOINT, data => {
  /** @type {import('types/bot/features/earthquake').WebSocketResponse} */
  const response = JSON.parse(data.toString());

  // actual data does not have "id", but has "_id"
  if (response.id == null) {
    response.id = response._id;
  }

  switch (response.code) {
    case  551: return resolveJMAQuake(response);
    case  552: return resolveJMATsunami(response);
    case  554: return resolveEEWDetection(response);
    case  555: return resolveAreaPeers(response);
    case  556: return resolveEEW(response);
    case  561: return resolveUserQuake(response);
    case 9611: return resolveUserQuakeEvaluation(response);
  }
});

/**
 * @param {number} number
 * @returns {'不明' | `震度${0 | 1 | 2 | 3 | 4}` | `震度${5 | 6}${'弱' | '強'}` | `震度7${'' | '程度以上'}`}
 */
export const intensityFromNumber = number =>
  intensityFromNumberCore(number, n => {
    log(`earthquake#${intensityFromNumber.name}`, 'unexpected value:', n);
    return '不明';
  });
/**
 * @param {number} number
 * @returns {ReturnType<typeof intensityFromNumber> | never}
 */
export const intensityFromNumberWithException = number =>
  intensityFromNumberCore(number, n => {
    log(`earthquake#${intensityFromNumberWithException.name}`, 'unexpected value:', n);
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
 * @param {ReturnType<typeof intensityFromNumber>} intensity
 * @returns {number?}
 */
const getColorsOfIntensity = intensity => {
  switch (intensity) {
    case '不明'         : return null;
    case '震度0'        : return null;
    case '震度1'        : return 0xf2f2ff;
    case '震度2'        : return 0x00aaff;
    case '震度3'        : return 0x0041ff;
    case '震度4'        : return 0xfae696;
    case '震度5弱'      : return 0xffe600;
    case '震度5強'      : return 0xff9900;
    case '震度6弱'      : return 0xff2800;
    case '震度6強'      : return 0xa50021;
    case '震度7'        : return 0xb40068;
    case '震度7程度以上': return 0xb40068;
  }
};

/**
 * @param {import('types/bot/features/earthquake').JMAQuake} response
 * @returns {Promise<void>}
 */
const resolveJMAQuake = async response => {
  const { points = [] } = response;

  let groupedByIntensityAreas = points
    .reduce((/** @type {Map<number, Map<string, string[]>>} */ acc, curr) => {
      /** @type {Map<string, string[]>} */
      const group = acc.get(curr.scale) ?? new Map();
      const areas = group.get(curr.pref) ?? [];
      if (isNonEmpty(areas)) {
        return acc.set(curr.scale, group.set(curr.pref, areas.concat(curr.addr).sort()));
      }
      else {
        return acc.set(curr.scale, group.set(curr.pref, [curr.addr]));
      }
    }, new Map());
  // sort by intensity scale descending and prefectures ascending
  groupedByIntensityAreas = new Map(
    [...groupedByIntensityAreas]
      .sort(([a], [b]) => b - a)
      .map(([scale, group]) => [scale, new Map([...group].sort(([a], [b]) => a.localeCompare(b)))])
  );

  if (groupedByIntensityAreas.size === 0 || response.earthquake.hypocenter == null) {
    return log(`earthquake#${resolveJMAQuake.name}:`, 'no data', JSON.stringify(response));
  }

  const { hypocenter: { name, magnitude, depth, latitude, longitude }, maxScale, time } = response.earthquake;
  if (name === '' || latitude === -200 || longitude === -200 || depth === -1 || magnitude === -1) {
    return log(`earthquake#${resolveJMAQuake.name}:`, 'insufficient hypocenter data', JSON.stringify(response));
  }

  const maxIntensity = intensityFromNumber(maxScale);

  /** @type {Map<number, Set<import('types/bot/features/earthquake').LatLng>>} */
  const locations = new Map();
  for (const p of points) {
    const geo = await geocode(p.pref, p.addr);
    if (geo != null) {
      const set = locations.get(p.scale) ?? new Set();
      locations.set(p.scale, set.add(geo));
    }
  }

  const { records } = db;

  if (records.every(({ minIntensity }) => maxScale < minIntensity)) {
    return log(`earthquake#${resolveJMAQuake.name}:`, 'skipped because of maxScale is too low', JSON.stringify(response));
  }

  const mapBuffer = await getMapImageAsBuffer(latitude, longitude, locations);
  const mapAttachment = mapBuffer != null ? new AttachmentBuilder(mapBuffer, { name: `${response.id}.png` }) : null;

  for (const { guildId, guildName, channelId, minIntensity, alertThreshold } of records) {
    if (maxScale < minIntensity) continue;

    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);

    if (channel?.isTextBased()) {
      const ll = `${latitude},${longitude}`;
      const mapParams = new URLSearchParams({ ll, z: '8', q: ll });
      const sentences = [
        `[${name}](https://www.google.com/maps?${mapParams})で最大${maxIntensity}の地震が発生しました。`,
        `マグニチュードは ${magnitude}、震源の深さはおよそ ${depth}km です。`,
      ];

      const embed = new EmbedBuilder()
        .setTitle('地震情報')
        .setDescription(sentences.join('\n'))
        .setColor(getColorsOfIntensity(maxIntensity))
        .setTimestamp(dayjs.tz(time, 'Asia/Tokyo').valueOf());

      /** @type {import('discord.js').MessageCreateOptions} */
      const payload = { embeds: [embed] };

      if (maxScale >= alertThreshold) {
        payload.content = '@here';
      }
      if (mapAttachment != null) {
        payload.files = [mapAttachment];
        embed.setImage(`attachment://${response.id}.png`);
      }

      /** @type {import('discord.js').Message<true>} */
      let message;
      try {
        message = await channel.send(payload);
      }
      catch (e) {
        if (e instanceof Error) {
          log(`earthquake#${resolveJMAQuake.name}:`, `failed to send to ${guildName}/${channel.name}`, e.stack ?? `${e.name}: ${e.message}`);
          continue;
        }
        throw e;
      }

      /** @type {import('discord.js').AnyThreadChannel<boolean>} */
      let thread;
      try {
        thread = await message.startThread({
          name: `${response.time} 震度別地域詳細`,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        });
      }
      catch (e) {
        if (e instanceof Error) {
          log(`earthquake#${resolveJMAQuake.name}:`, `failed to start thread in ${guildName}/${channel.name}`, e.stack ?? `${e.name}: ${e.message}`);
          if (message.thread == null) {
            continue;
          }
          else {
            thread = message.thread;
          }
        }
        else {
          throw e;
        }
      }

      for (const [intensityNum, groupedByPrefPoints] of groupedByIntensityAreas) {
        const intensity = intensityFromNumber(intensityNum);
        const embed = new EmbedBuilder()
          .setTitle(intensity)
          .setColor(getColorsOfIntensity(intensity));

        for (const [pref, points] of groupedByPrefPoints) {
          embed.addFields({ name: pref, value: points.join('、') });
        }

        try {
          await thread.send({ embeds: [embed] });
        }
        catch (e) {
          if (e instanceof Error) {
            log(`earthquake#${resolveJMAQuake.name}:`, `failed to send to ${guildName}/${thread.name}`, e.stack ?? `${e.name}: ${e.message}`);
            continue;
          }
          throw e;
        }
      }

      const { points, ...restResponse } = response;
      log(`earthquake#${resolveJMAQuake.name}:`, `sent to ${guildName}/${channel.name}`, JSON.stringify(restResponse));
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
    return log(`earthquake#${resolveEEW.name}:`, 'no data', JSON.stringify(response));
  }

  const maxIntensity = Math.max(...maxIntensityAreas.map(x => x.scaleTo));
  const intensity = intensityFromNumber(maxIntensity);
  if (maxIntensity < 10 || intensity === '不明') {
    log(`earthquake#${resolveEEW.name}:`, 'insufficient intensity data', JSON.stringify(response));
    return;
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

  const { arrivalTime, originTime } = response.earthquake;

  for (const { guildId, guildName, channelId, channelName, minIntensity } of db.records) {
    if (maxIntensity < minIntensity) continue;

    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);

    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('緊急地震速報')
        .setColor(Colors.Red)
        .setTimestamp(dayjs(arrivalTime).tz().valueOf());

      embed.addFields({ name: '最大予測震度', value: intensity });
      embed.addFields({
        name: '最大震度観測予定地',
        value: maxIntensityAreaNames.join('\n'),
      });
      embed.addFields({ name: '発生日時', value: originTime });

      try {
        await channel.send({ embeds: [embed] });
      }
      catch (e) {
        if (e instanceof Error) {
          log(`earthquake#${resolveEEW.name}:`, `failed to send to ${guildName}/${channelName}`, e.stack ?? `${e.name}: ${e.message}`);
          continue;
        }
        throw e;
      }

      const { areas, ...restResponse } = response;
      log(`earthquake#${resolveEEW.name}:`, `sent to ${guildName}/${channelName}`, JSON.stringify(restResponse));
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

/**
 * @param {number} latitude
 * @param {number} longitude
 * @param {Map<number, Set<import('types/bot/features/earthquake').LatLng>>} locations
 * @returns {Promise<Buffer | null>}
 */
const getMapImageAsBuffer = async (latitude, longitude, locations) => {
  /** @type {[string, string][]} */
  const mapImageParams = [
    ['key', getEnv('GOOGLE_MAPS_API_KEY', 'Googlemaps API Key')],
    ['size', '640x480'],
    ['zoom', '8'],
    ['center', `${latitude},${longitude}`],
    ['markers', `color:red|${latitude},${longitude}`],
    ['language', 'ja'],
  ];

  const mapImageUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
  for (const [key, value] of mapImageParams) {
    mapImageUrl.searchParams.append(key, value);
  }

  let markersCount = 0;

  // add markers for each intensity
  for (const [intensity, points] of locations) {
    const color = getColorsOfIntensity(intensityFromNumber(intensity));
    if (color == null) continue;

    const hexRgb = color.toString(16).padStart(6, '0');
    const availablePoints = [...points].filter(p => Math.abs(latitude - p.lat) < 1.2 && Math.abs(longitude - p.lng) < 1.8);
    mapImageUrl.searchParams.append(
      'markers',
      `color:0x${hexRgb}|size:small|${availablePoints.map(p => `${p.lat},${p.lng}`).join('|')}`,
    );

    markersCount += availablePoints.length;
  }

  const url = mapImageUrl.toString();
  try {
    log(`earthquake#${getMapImageAsBuffer.name}:`, { url, len: url.length, markersCount });

    const buffer = await fetch(url).then(x => x.arrayBuffer());
    return Buffer.from(buffer);
  }
  catch (e) {
    if (e instanceof Error) {
      log(`earthquake#${getMapImageAsBuffer.name}:`, `failed to fetch ${url}`, e.stack ?? `${e.name}: ${e.message}`);
      return null;
    }
    throw e;
  }
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
