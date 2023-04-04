const { URL } = require('node:url');
const { setTimeout } = require('node:timers/promises');
const { AttachmentBuilder, Events, EmbedBuilder } = require("discord.js");
const ico = require('icojs');
const fastAvgColor = require('fast-average-color-node');
const client = require("../../client");
const { log } = require('../../lib/log');
const { getUrlDomain, retrieveRealUrl, urlsOfText, urlToDocument } = require("../../lib/util");

const THRESHOLD_DELAY = 5 * 1000;

/**
 * @param {Url} url
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
          log('noExpandedExpand#getFavicon#fetchIco:', e.stack ?? `${e.name}: ${e.message}`);
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
      (/** @type {string | null | undefined} */ acc, selector) => acc || document.querySelector(selector)?.getAttribute('content'),
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
      (/** @type {string | null | undefined} */ acc, selector) => acc || document.querySelector(selector)?.getAttribute('content'),
      null,
    );

  return desc || null;
};

/**
 * @param {Document} document
 * @param {Url} url
 * @returns {ReturnType<typeof getAuthorInner>}
 */
const getAuthor = async (document, url) => {
  /**
   * @param {string} url
   * @returns {Promise<[name: string, url?: string]?>}
   */
  const getAuthorInner = async url => {
    const document = await urlToDocument(url);

    const name = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
    if (name != null) return [name, url];

    const part = document.title.split(' - ').at(-1);
    return part != null ? [part.trim(), url] : null;
  };

  const name = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
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
const getUrl = document => document.querySelector('meta[property="og:url]')?.getAttribute('content') ?? null;

/**
 * @param {Document} document
 * @returns {string?}
 */
const getImage = document => {
  return [
    'meta[property="og:image"]',
    'meta[name="twitter:image:src"]',
  ]
    .reduce(
      (/** @type {string?} */ acc, selector) => acc ?? document.querySelector(selector)?.getAttribute('content') ?? null,
      null,
    ) ?? null;
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
      log('noExpandedExpand#getColorAsInt:', e.stack ?? `${e.name}: ${e.message}`);
    }
    return 0x000000;
  }
};

client.on(Events.MessageCreate, async message => {
  await setTimeout(THRESHOLD_DELAY);

  const urls = urlsOfText(message.content);
  if (message.embeds.length < urls.length) {
    const embedUrls = message.embeds
      .map(embed => embed.url)
      .filter(/** @type {(url: string?) => url is string} */ url => url != null);
    const targetUrls = urls.filter(url => !embedUrls.includes(url));

    /** @type {APIEmbed[]} */
    const embeds = [];

    /** @type {import('discord.js').AttachmentBuilder[]} */
    const files = [];

    for (const [index, url] of targetUrls.entries()) {
      try {
        const realUrl = await retrieveRealUrl(url);
        const document = await urlToDocument(realUrl);

        const embed = new EmbedBuilder({ url: realUrl })
          .setTitle(getTitle(document))
          .setDescription(getDescription(document))
          .setImage(getImage(document));

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

              const attachment = new AttachmentBuilder(buffer, { name: `favicon${index}.png` });
              files.push(attachment);
            }

            embed.setAuthor(options);
          }
        }

        embeds.push(embed.toJSON());
      }
      catch (e) {
        if (e instanceof Error) {
          log('noExpandedExpand:', e.stack ?? `${e.name}: ${e.message}`);
        }
      }
    }

    if (embeds.length > 0) {
      const content = 'URL が展開されてないみたいだからこっちで付けとくね';
      await message.reply({ content, embeds, files });
    }
  }
});