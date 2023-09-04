import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import ico from 'icojs';
import fastAvgColor from 'fast-average-color-node';
import { log } from '../../../../lib/log.js';
import { getUrlDomain, isUrl, retrieveRealUrl, urlToDocument } from '../../../../lib/util.js';

/**
 * @param {import('types').Url} url
 * @param {number} index
 * @returns {Promise<string | ReturnType<typeof fetchIco>>}
 */
const getFavicon = async (url, index) => {
  /**
   * @param {string} iconUrl
   * @returns {Promise<[`attachment://favicon${number}.png`, Buffer] | null>}
   */
  const fetchIco = async iconUrl => {
    const res = await fetch(iconUrl);

    if (res.ok) {
      const buffer = await res.arrayBuffer();

      try {
        const icons = await ico.parse(buffer, 'image/png');

        // sort with image width descending
        const icon = icons.sort((a, b) => b.width - a.width)[0]?.buffer;

        if (icon != null) {
          return [`attachment://favicon${index}.png`, Buffer.from(icon)];
        }
      }
      catch (e) {
        if (e instanceof Error) {
          log(`noExpandedExpand#${getFavicon.name}#${fetchIco.name}:`, e.stack ?? `${e.name}: ${e.message}`);
        }
      }
    }
    return null;
  };

  const document = await urlToDocument(url);

  /** @type {HTMLLinkElement?} */
  const iconLink = document.querySelector('link[rel="icon"]');
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

/**
 * @param {Document} document
 * @returns {string?}
 */
const getTitle = document => {
  const title = [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
  ]
    .reduce(
      (/** @type {import('types').Nullable<string>} */ acc, selector) =>
        acc || /** @type {HTMLMetaElement?} */ (document.querySelector(selector))?.content,
      null,
    );

  return title || document.title || null;
};

/**
 * @param {Document} document
 * @returns {string?}
 */
const getDescription = document => {
  const desc = [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[property="description"]',
    'meta[name="description"]',
  ]
    .reduce(
      (/** @type {import('types').Nullable<string>} */ acc, selector) =>
        acc || /** @type {HTMLMetaElement?} */ (document.querySelector(selector))?.content,
      null,
    );

  return desc || null;
};

/**
 * @param {Document} document
 * @param {import('types').Url} url
 * @returns {ReturnType<typeof getAuthorInner>}
 */
const getAuthor = async (document, url) => {
  /**
   * @param {string} url
   * @returns {Promise<[name: string, url?: string]?>}
   */
  const getAuthorInner = async url => {
    const document = await urlToDocument(url);

    const name = /** @type {HTMLMetaElement?} */ (document.querySelector('meta[property="og:site_name"]'))?.content;
    if (name != null) return [name, url];

    const part = document.title.includes(' - ') ? document.title.split(' - ').at(-1) : null;
    return part != null ? [part.trim(), url] : null;
  };

  const name = /** @type {HTMLMetaElement?} */ (document.querySelector('meta[property="og:site_name"]'))?.content;
  if (name != null) {
    const homeRef = document.querySelector('[rel="home"][href]')?.getAttribute('href');
    if (homeRef == null) return [name];

    return [name, new URL(homeRef, getUrlDomain(url)).href];
  }

  /** @type {HTMLBaseElement?} */
  const base = document.querySelector('base[href]');
  if (base != null) return getAuthorInner(new URL(base.href, getUrlDomain(url)).href);

  // https://***/path/to/~author/foo/bar
  const [partRoot] = url.match(/.+\/~\w+\//) ?? [];
  if (partRoot != null) return getAuthorInner(partRoot);

  const { protocol, host } = new URL(url);
  return getAuthorInner(`${protocol}//${host}/`);
};

/**
 * @param {Document} document
 * @returns {string?}
 */
const getUrl = document => {
  const url = /** @type {HTMLMetaElement?} */ (document.querySelector('meta[property="og:url]'))?.content ?? null;

  return url != null && isUrl(url) ? url : null;
};

/**
 * @param {Document} document
 * @returns {string?}
 */
const getImage = document => {
  const imageUrl = [
    'meta[property="og:image"]',
    'meta[name="twitter:image:src"]',
  ]
    .reduce(
      (/** @type {string?} */ acc, selector) =>
        acc ?? /** @type {HTMLMetaElement?} */ (document.querySelector(selector))?.content ?? null,
      null,
    ) ?? null;

  return imageUrl != null && isUrl(imageUrl) ? imageUrl : null;
};

/**
 * @param {Document} document
 * @returns {{
 *   availability: string | undefined,
 *   condition: string | undefined,
 *   brand: string | undefined,
 *   prices: { amount: string, currency: string }[],
 * }}
 */
const getProductInfo = document => {
  const availability = /** @type {HTMLMetaElement?} */ (document.querySelector('meta[property="product:availability"]'))?.content;
  const condition = /** @type {HTMLMetaElement?} */ (document.querySelector('meta[property="product:condition"]'))?.content;
  const brand = /** @type {HTMLMetaElement?} */ (document.querySelector('meta[property="product:brand"]'))?.content;

  const getPrices = function* () {
    for (const el of /** @type {NodeListOf<HTMLMetaElement>} */ (document.querySelectorAll('meta[property^="product:price"]'))) {
      switch (el.getAttribute('property')) {
        case 'product:price:amount': {
          if (el.nextElementSibling?.matches('meta[property="product:price:currency"]')) {
            const amount = el.content;
            const currency = /** @type {HTMLMetaElement} */ (el.nextElementSibling).content;

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

/**
 * @param {string | Buffer} resource
 * @returns {Promise<number>}
 */
const getColorAsInt = async resource => {
  try {
    const { value: [red, green, blue] } = await fastAvgColor.getAverageColor(resource, { silent: true });
    return (red << 16) + (green << 8) + blue;
  }
  catch (e) {
    if (e instanceof Error) {
      log(`noExpandedExpand#${getColorAsInt.name}:`, e.stack ?? `${e.name}: ${e.message}`);
    }
    return 0x000000;
  }
};

/** @type {import('types/bot/features/noExpandedExpand').PluginHooks} */
export const hooks = [
  [
    /.+/,
    async function core(url, index) {
      try {
        /** @type {AttachmentBuilder[]} */
        const attachments = []

        const realUrl = await retrieveRealUrl(url);
        const document = await urlToDocument(realUrl);

        const embed = new EmbedBuilder({ url: realUrl })
          .setTitle(getTitle(document))
          .setDescription(getDescription(document))
          .setImage(getImage(document));

        if (embed.data.title == null && embed.data.description == null) {
          log( `noExpandedExpand#${core.name}:`, realUrl, 'no title and description');
          return { embeds: [], attachments: [] };
        }

        {
          const pureUrl = getUrl(document);
          if (pureUrl != null) {
            embed.setURL(pureUrl);
          }
        }

        {
          const [authorName, authorUrl] = await getAuthor(document, realUrl) ?? [];

          if (authorName != null) {
            /** @type {import('discord.js').EmbedAuthorOptions} */
            const options = { name: authorName };

            if (authorUrl != null) {
              options.url = authorUrl;
            }

            const icon = await getFavicon(realUrl, index);
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

          /** @type {string?} */
          const availabilityText = (() => {
            switch (availability) {
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

          /** @type {string?} */
          const conditionText = (() => {
            switch (condition) {
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
          log(`noExpandedExpand#${core.name}:`, e.stack ?? `${e.name}: ${e.message}`);
          return { embeds: [], attachments: [] };
        }
        throw e;
      }
    }
  ],
];
