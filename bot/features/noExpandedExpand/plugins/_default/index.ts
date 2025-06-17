import { AttachmentBuilder, type EmbedAuthorOptions, EmbedBuilder } from 'discord.js';
import fastAvgColor from 'fast-average-color-node';
import { parseICO } from 'icojs';
import type { PluginHooks } from '../../../../../types/bot/features/noExpandedExpand/index.ts';
import type { Nullable, Url } from '../../../../../types/index.ts';
import { log, logError } from '../../../../lib/log.ts';
import { getUrlDomain, isUrl, retrieveRealUrl, urlToDocument } from '../../../../lib/util.ts';

const IGNORED_URLS = Object.freeze([
  /^https:\/\/discord\.com\/events\//,
]);

const getFavicon = async (url: Url, index: number): Promise<string | ReturnType<typeof fetchIco>> => {
  const fetchIco = async (iconUrl: string): Promise<[`attachment://favicon${number}.png`, Buffer] | null> => {
    const res = await fetch(iconUrl);

    if (res.ok) {
      const buffer = await res.arrayBuffer();

      try {
        const icons = await parseICO(buffer, 'image/png');

        // sort with image width descending
        const icon = icons.sort((a, b) => b.width - a.width)[0]?.buffer;

        if (icon != null) {
          return [`attachment://favicon${index}.png`, Buffer.from(icon)];
        }
      }
      catch (e) {
        if (e instanceof Error) {
          logError(e, `noExpandedExpand#${getFavicon.name}#${fetchIco.name}:`);
        }
      }
    }
    return null;
  };

  const document = await urlToDocument(url);
  if (document == null) return null;

  const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const iconUrl = iconLink?.href;

  if (iconUrl != null) {
    if (iconUrl.endsWith('.ico')) {
      const { href } = new URL(iconUrl, getUrlDomain(url));
      return fetchIco(href);
    }
    return iconUrl;
  }

  const { protocol, host } = new URL(url);
  return fetchIco(`${protocol}//${host}/favicon.ico`);
};

const getTitle = (document: Document): string | null => {
  const title = [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
  ]
    .reduce((acc: Nullable<string>, selector) => acc || document.querySelector<HTMLMetaElement>(selector)?.content, null);

  return title || document.title || null;
};

const getDescription = (document: Document): string | null => {
  const desc = [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[property="description"]',
    'meta[name="description"]',
  ]
    .reduce((acc: Nullable<string>, selector) => acc || document.querySelector<HTMLMetaElement>(selector)?.content, null);

  return desc || null;
};

const getAuthor = async (document: Document, url: Url): ReturnType<typeof getAuthorInner> => {
  const getAuthorInner = async (url: string): Promise<[name: string, url?: string] | null> => {
    const document = await urlToDocument(url);
    if (document == null) return null;

    const name = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content;
    if (name != null) return [name, url];

    const part = document.title.includes(' - ') ? document.title.split(' - ').at(-1) : null;
    return part != null ? [part.trim(), url] : null;
  };

  const name = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content;
  if (name != null) {
    const homeRef = document.querySelector<HTMLElement & { href: string }>('[rel="home"][href]')?.href;
    if (homeRef == null) return [name];

    return [name, new URL(homeRef, getUrlDomain(url)).href];
  }

  const base = document.querySelector<HTMLBaseElement>('base[href]');
  if (base != null) return getAuthorInner(new URL(base.href, getUrlDomain(url)).href);

  // https://***/path/to/~author/foo/bar
  const [partRoot] = url.match(/.+\/~\w+\//) ?? [];
  if (partRoot != null) return getAuthorInner(partRoot);

  const { protocol, host } = new URL(url);
  return getAuthorInner(`${protocol}//${host}/`);
};

const getUrl = (document: Document): Url | null => {
  const url = document.querySelector<HTMLMetaElement>('meta[property="og:url]')?.content ?? null;

  return url != null && isUrl(url) ? url : null;
};

const getImage = (document: Document): string | null => {
  const imageUrl = [
    'meta[property="og:image"]',
    'meta[name="twitter:image:src"]',
  ]
    .reduce((acc: string | null, selector) => acc ?? document.querySelector<HTMLMetaElement>(selector)?.content ?? null, null) ?? null;

  return imageUrl != null && isUrl(imageUrl) ? imageUrl : null;
};

const getProductInfo = (document: Document): {
    availability: string | undefined;
    condition: string | undefined;
    brand: string | undefined;
    prices: { amount: string; currency: string; }[];
  } => {
  const availability = document.querySelector<HTMLMetaElement>('meta[property="product:availability"]')?.content;
  const condition = document.querySelector<HTMLMetaElement>('meta[property="product:condition"]')?.content;
  const brand = document.querySelector<HTMLMetaElement>('meta[property="product:brand"]')?.content;

  const getPrices = function* (): Generator<{ amount: string; currency: string; }> {
    for (const el of document.querySelectorAll<HTMLMetaElement>('meta[property^="product:price"]')) {
      switch (el.getAttribute('property')) {
        case 'product:price:amount': {
          if (el.nextElementSibling?.matches('meta[property="product:price:currency"]')) {
            const amount = el.content;
            const currency = (el.nextElementSibling as HTMLMetaElement).content;

            yield { amount, currency };
          }
          break;
        }
        case 'product:price:currency': {
          // process in 'product:price:amount' case
          break;
        }
        case 'product:price': {
          const [amount, currency] = el.content.split(' ');

          if (amount != null && amount !== '' && currency != null && currency !== '') {
            yield { amount, currency };
          }
          break;
        }
        default: {
          const message = `unhandled property '${el.getAttribute('property')}' on ${document.URL}`;
          log(`noExpandedExpand#${getProductInfo.name}#${getPrices.name}: ${message}`);
        }
      }
    }
  };

  return { availability, condition, brand, prices: [...getPrices()] };
};

const getColorAsInt = async (resource: string | Buffer): Promise<number> => {
  const timeout = new Promise<{ value: [0, 0, 0]; }>(resolve => setTimeout(() => resolve({ value: [0, 0, 0] }), 10 * 1000));
  try {
    const { value: [red, green, blue] } = await Promise.race([
      fastAvgColor.getAverageColor(resource, { silent: true }),
      timeout,
    ]);
    return (red << 16) + (green << 8) + blue;
  }
  catch (e) {
    if (e instanceof Error) {
      logError(e, `noExpandedExpand#${getColorAsInt.name}:`);
    }
    return 0x000000;
  }
};

export const hooks: PluginHooks = [
  [
    /.+/,
    async function core(url, index) {
      if (!isUrl(url)) {
        log(`noExpandedExpand#${core.name}:`, url, 'is not a url');
        return { embeds: [], attachments: [] };
      }
      if (IGNORED_URLS.some(re => re.test(url))) {
        log(`noExpandedExpand#${core.name}:`, url, 'is ignored');
        return { embeds: [], attachments: [] };
      }

      try {
        const attachments: AttachmentBuilder[] = [];

        const realUrl = await retrieveRealUrl(url);
        const document = await urlToDocument(realUrl);

        if (document == null) {
          log(`noExpandedExpand#${core.name}:`, realUrl, 'document is null');
          return { embeds: [], attachments: [] };
        }

        const embed = new EmbedBuilder({ url: realUrl })
          .setTitle(getTitle(document))
          .setDescription(getDescription(document))
          .setImage(getImage(document));

        if (embed.data.title == null && embed.data.description == null) {
          log(`noExpandedExpand#${core.name}:`, realUrl, 'no title and description');
          return { embeds: [], attachments: [] };
        }

        {
          const pureUrl = getUrl(document);
          embed.setURL(pureUrl ?? realUrl);
        }

        {
          const [authorName, authorUrl] = await getAuthor(document, realUrl) ?? [];

          if (authorName != null) {
            const options: EmbedAuthorOptions = { name: authorName };

            if (authorUrl != null) {
              options.url = authorUrl;
            }

            const icon = await getFavicon(realUrl, index ?? 0);
            if (typeof icon === 'string') {
              options.iconURL = icon;
              embed.setColor(await getColorAsInt(icon));
            }
            else if (icon != null) {
              const [url, buffer] = icon;
              options.iconURL = url;
              embed.setColor(await getColorAsInt(buffer));

              attachments.push(new AttachmentBuilder(buffer, { name: `favicon${index}.png` }));
            }

            embed.setAuthor(options);
          }
        }

        {
          const { availability, condition, brand, prices } = getProductInfo(document);

          const availabilityText: string | null = (() => {
            switch (availability) {
              case undefined     : return null;
              case 'in stock'    : return '在庫あり';
              case 'out of stock': return '在庫なし';
              default: {
                log(`noExpandedExpand#${core.name}:`, `unhandled availability '${availability}' on ${realUrl}`);
                return null;
              }
            }
          })();
          if (availabilityText != null) {
            embed.addFields({ name: '在庫', value: availabilityText });
          }

          const conditionText: string | null = (() => {
            switch (condition) {
              case undefined    : return null;
              case 'new'        : return '新品';
              case 'refurbished': return '再販品';
              case 'used'       : return '中古品';
              default: {
                log(`noExpandedExpand#${core.name}:`, `unhandled condition '${condition}' on ${realUrl}`);
                return null;
              }
            }
          })();
          if (conditionText != null) {
            embed.addFields({ name: '状態', value: conditionText });
          }

          if (brand != null) {
            embed.addFields({ name: 'ブランド', value: brand });
          }

          for (const { amount, currency } of prices) {
            embed.addFields({ name: '価格', value: `${amount} ${currency}` });
          }
        }

        return { embeds: [embed.toJSON()], attachments };
      }
      catch (e) {
        if (e instanceof Error) {
          logError(e, `noExpandedExpand#${core.name}:`);
          return { embeds: [], attachments: [] };
        }
        throw e;
      }
    }
  ],
];
