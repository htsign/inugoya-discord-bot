const { URL } = require('node:url');
const { setTimeout } = require('node:timers/promises');
const { AttachmentBuilder, Events, EmbedBuilder } = require("discord.js");
const ico = require('icojs');
const fastAvgColor = require('fast-average-color-node');
const client = require("../../client");
const { urlsOfText, urlToDocument } = require("../../lib/util");

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
      const icons = await ico.parse(buffer, 'image/png');

      // sort with image width descending
      const icon = icons.sort((a, b) => b.width - a.width)[0]?.buffer;

      if (icon != null) {
        return [`attachment://favicon${index}.png`, Buffer.from(icon)];
      }
    }
    return null;
  }

  const document = await urlToDocument(url);

  /** @type {HTMLLinkElement | null} */
  const iconLink = document.querySelector('link[rel="icon"]');
  const iconUrl = iconLink?.href;

  if (iconUrl != null) {
    if (iconUrl.endsWith('.ico')) {
      return fetchIco(iconUrl);
    }
    return iconUrl;
  }

  const urlObject = new URL(url);
  return fetchIco(`${urlObject.protocol}//${urlObject.host}/favicon.ico`);
};

/**
 * @param {Document} document
 * @returns {string}
 */
const getTitle = document => {
  return [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
  ]
    .reduce(
      (/** @type {string?} */ acc, selector) => acc ?? document.querySelector(selector)?.getAttribute('content') ?? null,
      null,
    ) ?? document.title;
};

/**
 * @param {Document} document
 * @returns {string?}
 */
const getDescription = document => {
  return [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[property="description"]',
    'meta[name="description"]',
  ]
    .reduce(
      (/** @type {string?} */ acc, selector) => acc ?? document.querySelector(selector)?.getAttribute('content') ?? null,
      null,
    ) ?? null;
};

/**
 * @param {Document} document
 * @returns {string?}
 */
const getAuthorName = document => document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? null;

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
  const { value: [red, green, blue] } = await fastAvgColor.getAverageColor(resource, { silent: true });
  return (red << 16) + (green << 8) + blue;
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
        const document = await urlToDocument(url);

        const embed = new EmbedBuilder({ url })
          .setTitle(getTitle(document))
          .setDescription(getDescription(document))
          .setImage(getImage(document));

        {
          let authorName = getAuthorName(document);
          if (authorName == null) {
            const urlObject = new URL(url);
            authorName = getAuthorName(await urlToDocument(`${urlObject.protocol}//${urlObject.host}/`));
          }

          if (authorName != null) {
            /** @type {import('discord.js').EmbedAuthorOptions} */
            const options = { name: authorName };

            /** @type {HTMLBaseElement | null} */
            const base = document.querySelector('base[href]');
            const authorUrl = base?.href;

            if (authorUrl != null) {
              options.url = authorUrl;
            }

            const icon = await getFavicon(url, index);
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
          console.log(e.name, e.message);
        }
      }
    }

    if (embeds.length > 0) {
      const content = 'URL が展開されてないみたいだからこっちで付けとくね';
      await message.reply({ content, embeds, files });
    }
  }
});
