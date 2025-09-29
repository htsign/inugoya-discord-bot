import { setTimeout } from 'node:timers/promises';
import { URL } from 'node:url';
import {
  type AnyThreadChannel,
  AttachmentBuilder,
  Colors,
  EmbedBuilder,
  type Message,
  type MessageCreateOptions,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { isNonEmpty } from 'ts-array-length';
import type {
  Area,
  AreaPeers,
  DomesticTsunami,
  EEW,
  EEWDetection,
  JMAQuake,
  JMATsunami,
  LatLng,
  UserQuake,
  UserQuakeEvaluation,
  WebSocketResponse,
} from '../../../types/bot/features/earthquake/index.ts';
import client from '../../client.ts';
import dayjs from '../../lib/dayjsSetup.ts';
import { log, logError } from '../../lib/log.ts';
import { getEnv } from '../../lib/util.ts';
import { db } from './db.ts';
import { geocode } from './geocoding.ts';

const debug = false;
const ENDPOINT = `wss://${debug ? 'api-realtime-sandbox' : 'api'}.p2pquake.net/v2/ws`;

const connectWebSocket = (address: string, onMessage: (event: MessageEvent) => void): Promise<WebSocket> => {
  const reconnect = async (timeout: number): Promise<WebSocket> => {
    await setTimeout(timeout);
    return await connectWebSocket(address, onMessage);
  };

  try {
    const ws = new WebSocket(address);

    ws.onopen = () => log('earthquake: connected');
    ws.onmessage = event => {
      try {
        onMessage(event);
      }
      catch (error) {
        log('earthquake#onmessage: unhandled error', error);
        reconnect(1000);
      }
    };
    ws.onerror = event => {
      log('earthquake#onerror: error', event);
      try {
        ws.close();
      }
      catch (error) {
        log('earthquake#onerror: unhandled error', error);
        reconnect(1000);
      }
    };
    ws.onclose = ({ code, reason }) => {
      log('earthquake#onclose: disconnected', `[${code}] ${reason}`);
      reconnect(1000);
    };

    return Promise.resolve(ws);
  }
  catch (error) {
    log(`earthquake#${connectWebSocket.name}: unhandled error`, error);
    return reconnect(1000);
  }
};

connectWebSocket(ENDPOINT, ({ data }) => {
  if (data == null) return;

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

export const intensityFromNumber = (
  number: number,
): '不明' | `震度${0 | 1 | 2 | 3 | 4}` | `震度${5 | 6}${'弱' | '強'}` | '震度5弱以上' | `震度7${'' | '程度以上'}` =>
  intensityFromNumberCore(number, n => {
    log(`earthquake#${intensityFromNumber.name}`, 'unexpected value:', n);
    return '不明';
  });
export const intensityFromNumberWithException = (number: number): ReturnType<typeof intensityFromNumber> | never =>
  intensityFromNumberCore(number, n => {
    log(`earthquake#${intensityFromNumberWithException.name}`, 'unexpected value:', n);
    throw new UnexpectedIntensityError(n);
  });
const intensityFromNumberCore = <S>(number: number, ifUnexpected: (intensity: number) => S): ReturnType<typeof intensityFromNumber> | S => {
  switch (number) {
    case -1: return '不明';
    case 0: return '震度0';
    case 10: return '震度1';
    case 20: return '震度2';
    case 30: return '震度3';
    case 40: return '震度4';
    case 45: return '震度5弱';
    case 46: return '震度5弱以上';
    case 50: return '震度5強';
    case 55: return '震度6弱';
    case 60: return '震度6強';
    case 70: return '震度7';
    case 99: return '震度7程度以上';
    default: return ifUnexpected(number);
  }
};

const getColorsOfIntensity = (intensity: ReturnType<typeof intensityFromNumber>): number | null => {
  switch (intensity) {
    case '不明': return null;
    case '震度0': return null;
    case '震度1': return 0xf2f2ff;
    case '震度2': return 0x00aaff;
    case '震度3': return 0x0041ff;
    case '震度4': return 0xfae696;
    case '震度5弱': return 0xffe600;
    case '震度5弱以上': return 0xffe600;
    case '震度5強': return 0xff9900;
    case '震度6弱': return 0xff2800;
    case '震度6強': return 0xa50021;
    case '震度7': return 0xb40068;
    case '震度7程度以上': return 0xb40068;
  }
};

const resolveJMAQuake = async (response: JMAQuake): Promise<void> => {
  const { points = [] } = response;

  let groupedByIntensityAreas: Map<number, Map<string, string[]>> = points
    .reduce((acc: Map<number, Map<string, string[]>>, curr) => {
      const group = acc.get(curr.scale) ?? new Map<string, string[]>();
      const areas = group.get(curr.pref) ?? [];
      if (isNonEmpty(areas)) {
        return acc.set(curr.scale, group.set(curr.pref, areas.concat(curr.addr).sort()));
      }

      return acc.set(curr.scale, group.set(curr.pref, [curr.addr]));
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

  const { type } = response.issue;
  if (type !== 'ScalePrompt' && type !== 'DetailScale') {
    return log(`earthquake#${resolveJMAQuake.name}:`, 'unexpected issue type', JSON.stringify(response));
  }

  const { hypocenter: { name, magnitude, depth, latitude, longitude }, maxScale, time, domesticTsunami } = response.earthquake;
  if (type === 'DetailScale' && (name === '' || latitude === -200 || longitude === -200 || depth === -1 || magnitude === -1)) {
    return log(`earthquake#${resolveJMAQuake.name}:`, 'insufficient hypocenter data', JSON.stringify(response));
  }

  const maxIntensity = intensityFromNumber(maxScale);

  const { records } = db;

  if (records.every(({ minIntensity }) => maxScale < minIntensity)) {
    return log(`earthquake#${resolveJMAQuake.name}:`, 'skipped because of maxScale is too low', JSON.stringify(response));
  }

  const locations = new Map<number, Set<LatLng>>();
  for (const p of points) {
    const geo = await geocode(p.pref, p.addr);
    if (geo != null) {
      const set = locations.get(p.scale) ?? new Set();
      locations.set(p.scale, set.add(geo));
    }
  }

  const center = type === 'DetailScale' ? { latitude, longitude } : undefined;
  const mapBuffer = await getMapImageAsBuffer(locations, 'small', center);
  const mapAttachment = mapBuffer != null ? new AttachmentBuilder(mapBuffer, { name: `${response.id}.png` }) : null;

  for (const { guildId, guildName, channelId, minIntensity, alertThreshold } of records) {
    if (maxScale < minIntensity) continue;

    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);

    if (channel?.isTextBased()) {
      const tsunamiToMessage = (tsunami: DomesticTsunami | undefined): [string] | [] => {
        if (tsunami == null) return [];
        switch (tsunami) {
          case 'None': return ['この地震による津波の心配はありません。'];
          case 'Unknown': return ['この地震による津波の影響は不明です。'];
          case 'Checking': return ['この地震による津波の影響は確認中です。'];
          case 'NonEffective': return ['この地震により若干の海面変動が予想されますが、被害の心配はありません。'];
          case 'Watch': return ['津波に注意してください。'];
          case 'Warning': return ['津波に注意してください。'];
        }
      }

      const [title, ...sentences] = (type => {
        switch (type) {
          case 'ScalePrompt': {
            const positions = Array.from(locations.values()).flatMap(set => Array.from(set));
            const latitude = positions.map(p => p.lat).reduce((a, b) => a + b, 0) / positions.length;
            const longitude = positions.map(p => p.lng).reduce((a, b) => a + b, 0) / positions.length;

            const [pickedPoint, pickedPoint2] = points.slice(0, 2);
            if (pickedPoint == null) {
              throw new Error('no picked point');
            }

            let name = pickedPoint.addr;
            if (pickedPoint2 != null) {
              name += `や${pickedPoint2.addr}`;

              if (points.length > 2) {
                name += 'など';
              }
            }

            const ll = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
            const mapParams = new URLSearchParams({ ll, z: '8' });
            return [
              '地震速報',
              `[${name}](https://www.google.com/maps?${mapParams})で最大${maxIntensity}の地震を観測しました。`,
            ];
          }
          case 'DetailScale': {
            const ll = `${latitude},${longitude}`;
            const mapParams = new URLSearchParams({ ll, z: '8', q: ll });
            return [
              '地震情報',
              `[${name}](https://www.google.com/maps?${mapParams})で最大${maxIntensity}の地震が発生しました。`,
              `マグニチュードは ${magnitude}、震源の深さはおよそ ${depth}km です。`,
            ];
          }
          default:
            throw type satisfies never;
        }
      })(type);

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(sentences.concat(tsunamiToMessage(domesticTsunami)).join('\n'))
        .setColor(getColorsOfIntensity(maxIntensity))
        .setTimestamp(dayjs.tz(time, 'Asia/Tokyo').valueOf());

      const payload: MessageCreateOptions = { embeds: [embed] };

      if (maxScale >= alertThreshold) {
        payload.content = '@here';
      }
      if (mapAttachment != null) {
        payload.files = [mapAttachment];
        embed.setImage(`attachment://${response.id}.png`);
      }

      let message: Message<true>;
      try {
        message = await channel.send(payload);
      }
      catch (e) {
        if (e instanceof Error) {
          logError(e, `earthquake#${resolveJMAQuake.name}:`, `failed to send to ${guildName}/${channel.name}`);
          continue;
        }
        throw e;
      }

      let thread: AnyThreadChannel;
      try {
        thread = await message.startThread({
          name: `${response.time} 震度別地域詳細`,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        });
      }
      catch (e) {
        if (e instanceof Error) {
          logError(e, `earthquake#${resolveJMAQuake.name}:`, `failed to start thread in ${guildName}/${channel.name}`);
          if (message.thread == null) {
            continue;
          }

          thread = message.thread;
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
            logError(e, `earthquake#${resolveJMAQuake.name}:`, `failed to send to ${guildName}/${thread.name}`);
            continue;
          }
          throw e;
        }
      }

      const { points: _points, ...restResponse } = response;
      log(`earthquake#${resolveJMAQuake.name}:`, `sent to ${guildName}/${channel.name}`, JSON.stringify(restResponse));
    }
  }
};

const resolveJMATsunami = async (_response: JMATsunami): Promise<void> => {
  // not implemented
};

const resolveEEWDetection = async (_response: EEWDetection): Promise<void> => {
  // not implemented
};

const resolveAreaPeers = async (_response: AreaPeers): Promise<void> => {
  // not implemented
};

const resolveEEW = async (response: EEW): Promise<void> => {
  if (response.test) return;

  const maxIntensityAreas = response.areas.reduce((acc: Area[], curr) => {
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

  const { records } = db;

  if (records.every(({ minIntensity }) => maxIntensity < minIntensity)) {
    return log(`earthquake#${resolveEEW.name}:`, 'skipped because of maxIntensity is too low', JSON.stringify(response));
  }

  const areaNames: { [pref: string]: string[]; } = {};
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

  const locations = new Map<number, Set<LatLng>>();
  for (const p of maxIntensityAreas) {
    const geo = await geocode(p.pref, p.name);
    if (geo != null) {
      const set = locations.get(p.scaleTo) ?? new Set();
      locations.set(p.scaleTo, set.add(geo));
    }
  }

  const mapBuffer = await getMapImageAsBuffer(locations, undefined);
  const mapAttachment = mapBuffer != null ? new AttachmentBuilder(mapBuffer, { name: `${response.id}.png` }) : null;

  for (const { guildId, guildName, channelId, channelName, minIntensity, alertThreshold } of records) {
    if (maxIntensity < minIntensity) continue;

    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);

    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('緊急地震速報')
        .setColor(Colors.Red)
        .setTimestamp(dayjs.tz(arrivalTime, 'Asia/Tokyo').valueOf());

      embed.addFields({ name: '最大予測震度', value: intensity });
      embed.addFields({
        name: '最大震度観測予定地',
        value: maxIntensityAreaNames.join('\n'),
      });
      embed.addFields({ name: '発生日時', value: originTime });

      const payload: MessageCreateOptions = { embeds: [embed] };

      if (maxIntensity >= alertThreshold) {
        payload.content = '@here';
      }
      if (mapAttachment != null) {
        payload.files = [mapAttachment];
        embed.setImage(`attachment://${response.id}.png`);
      }

      try {
        await channel.send({ embeds: [embed] });
      }
      catch (e) {
        if (e instanceof Error) {
          logError(e, `earthquake#${resolveEEW.name}:`, `failed to send to ${guildName}/${channelName}`);
          continue;
        }
        throw e;
      }

      // biome-ignore lint/correctness/noUnusedVariables: ignore `areas` away from logs
      const { areas, ...restResponse } = response;
      log(`earthquake#${resolveEEW.name}:`, `sent to ${guildName}/${channelName}`, JSON.stringify(restResponse));
    }
  }
};

const resolveUserQuake = async (_response: UserQuake): Promise<void> => {
  // not implemented
};

const resolveUserQuakeEvaluation = async (_response: UserQuakeEvaluation): Promise<void> => {
  // not implemented
};

const getMapImageAsBuffer = async (
  locations: Map<number, Set<LatLng>>,
  markersSize: 'tiny' | 'mid' | 'small' | undefined,
  center?: { latitude: number; longitude: number; },
): Promise<Buffer | null> => {
  const mapImageParams: [string, string][] = [
    ['key', getEnv('GOOGLE_MAPS_API_KEY', 'Googlemaps API Key')],
    ['size', '640x480'],
    ['zoom', '8'],
    ['language', 'ja'],
  ];

  if (center != null) {
    mapImageParams.push(
      ['center', `${center.latitude},${center.longitude}`],
      ['markers', `color:red|${center.latitude},${center.longitude}`],
    );
  }

  const mapImageUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
  for (const [key, value] of mapImageParams) {
    mapImageUrl.searchParams.append(key, value);
  }

  let markersCount = 0;

  const _markersSize: [`size:${Exclude<Parameters<typeof getMapImageAsBuffer>[1], undefined>}`] | [] =
    markersSize != null ? [`size:${markersSize}`] : [];

  // add markers for each intensity
  for (const [intensity, points] of locations) {
    const color = getColorsOfIntensity(intensityFromNumber(intensity));
    if (color == null) continue;

    const hexRgb = color.toString(16).padStart(6, '0');
    const availablePoints =
      center == null
        ? [...points]
        : [...points].filter(p => Math.abs(center.latitude - p.lat) < 1.2 && Math.abs(center.longitude - p.lng) < 1.8);
    mapImageUrl.searchParams.append(
      'markers',
      [
        `color:0x${hexRgb}`,
        ..._markersSize,
        `${availablePoints.map(p => `${p.lat},${p.lng}`).join('|')}`,
      ].join('|'),
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
      logError(e, `earthquake#${getMapImageAsBuffer.name}:`, `failed to fetch ${url}`);
      return null;
    }
    throw e;
  }
};

export class UnexpectedIntensityError extends Error {
  #intensity: number;

  get intensity(): number {
    return this.#intensity;
  }

  constructor(intensity: number) {
    super(`unexpected intensity: ${intensity}`);
    this.#intensity = intensity;
  }
}
