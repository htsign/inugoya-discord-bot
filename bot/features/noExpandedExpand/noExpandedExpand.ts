import { URL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { AttachmentBuilder, Events, EmbedBuilder, APIEmbed, EmbedAuthorOptions } from 'discord.js';
import ico from 'icojs';
import fastAvgColor from 'fast-average-color-node';
import client from 'bot/client';
import { log } from '@lib/log';
import { getUrlDomain, isUrl, retrieveRealUrl, urlsOfText, urlToDocument } from '@lib/util';

const THRESHOLD_DELAY = 5 * 1000;

const getFavicon = async (url: Url, index: number): Promise<string | ReturnType<typeof fetchIco>> => {
  const fetchIco = async (iconUrl: string): Promise<[`attachment://favicon${number}.png`, Buffer] | null> => {
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
    .reduce<string | undefined>(
      (acc, selector) => acc || document.querySelector<HTMLMetaElement>(selector)?.content,
      undefined,
    );

  return title || document.title || null;
};

const getDescription = (document: Document): string | null => {
  const desc = [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[property="description"]',
    'meta[name="description"]',
  ]
    .reduce<string | undefined>(
      (acc, selector) => acc || document.querySelector<HTMLMetaElement>(selector)?.content,
      undefined,
    );

  return desc || null;
};

const getAuthor = async (document: Document, url: Url): ReturnType<typeof getAuthorInner> => {
  const getAuthorInner = async (url: string): Promise<[name: string, url?: string] | null> => {
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

  const base = document.querySelector<HTMLBaseElement>('base[href]');
  if (base != null) return getAuthorInner(new URL(base.href, getUrlDomain(url)).href);

  // https://***/path/to/~author/foo/bar
  const [partRoot] = url.match(/.+\/~\w+\//) ?? [];
  if (partRoot != null) return getAuthorInner(partRoot);

  const { protocol, host } = new URL(url);
  return getAuthorInner(`${protocol}//${host}/`);
};

const getUrl = (document: Document): string | null => {
  const url = document.querySelector<HTMLMetaElement>('meta[property="og:url]')?.content ?? null;

  return url != null && isUrl(url) ? url : null;
};

const getImage = (document: Document): string | null => {
  const imageUrl = [
    'meta[property="og:image"]',
    'meta[name="twitter:image:src"]',
  ]
    .reduce<string | null>(
      (acc, selector) => acc ?? document.querySelector<HTMLMetaElement>(selector)?.content ?? null,
      null,
    ) ?? null;

  return imageUrl != null && isUrl(imageUrl) ? imageUrl : null;
};

const getColorAsInt = async (resource: string | Buffer): Promise<number> => {
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

const core = async (url: Url, index: number): Promise<{ embeds: APIEmbed[], attachment: AttachmentBuilder | null }> => {
  try {
    let attachment: AttachmentBuilder | null = null;

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
        const options: EmbedAuthorOptions = { name: authorName };

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

          attachment = new AttachmentBuilder(buffer, { name: `favicon${index}.png` });
        }

        embed.setAuthor(options);
      }
    }

    return { embeds: [embed.toJSON()], attachment };
  }
  catch (e) {
    if (e instanceof Error) {
      log('noExpandedExpand:', e.stack ?? `${e.name}: ${e.message}`);
      return { embeds: [], attachment: null };
    }
    throw e;
  }
};

client.on(Events.MessageCreate, async message => {
  await setTimeout(THRESHOLD_DELAY);

  const urls = urlsOfText(message.content);
  if (message.embeds.length < urls.length) {
    const embedUrls = message.embeds
      .map(embed => embed.url)
      .filter((url: string | null): url is string => url != null);
    const targetUrls = urls
      .filter(url => !embedUrls.includes(url))
      .filter(url => !url.startsWith('https://discord.com/channels/')); // ignore discord message url

    const expandingPromises: ReturnType<typeof core>[] = [];

    for (const [index, url] of targetUrls.entries()) {
      expandingPromises.push(core(url, index));
    }

    const results = await Promise.all(expandingPromises);

    const embeds = results.flatMap(res => res.embeds);
    const files = results.map(res => res.attachment)
      .filter((x: AttachmentBuilder | null): x is AttachmentBuilder => x != null);

    if (embeds.length > 0) {
      const content = 'URL が展開されてないみたいだからこっちで付けとくね';
      await message.reply({ content, embeds, files });
    }
  }
});
