import { URL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { AttachmentBuilder, Events, EmbedBuilder, APIEmbed, EmbedAuthorOptions } from "discord.js";
import ico from 'icojs';
import fastAvgColor from 'fast-average-color-node';
import client from "bot/client";
import { urlsOfText, urlToDocument } from "@lib/util";

const THRESHOLD_DELAY = 5 * 1000;

const getFavicon = async (url: Url, index: number): Promise<string | ReturnType<typeof fetchIco>> => {
  const fetchIco = async (iconUrl: string): Promise<[`attachment://favicon${number}.png`, Buffer] | null> => {
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

  const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const iconUrl = iconLink?.href;

  if (iconUrl != null) {
    if (iconUrl.endsWith('.ico')) {
      return fetchIco(iconUrl);
    }
    return iconUrl;
  }

  const { protocol, host } = new URL(url);
  return fetchIco(`${protocol}//${host}/favicon.ico`);
};

const getTitle = (document: Document): string => {
  return [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
  ]
    .reduce<string | null>(
      (acc, selector) => acc ?? document.querySelector<HTMLMetaElement>(selector)?.content ?? null,
      null,
    ) ?? document.title;
};

const getDescription = (document: Document): string | null => {
  return [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[property="description"]',
    'meta[name="description"]',
  ]
    .reduce<string | null>(
      (acc, selector) => acc ?? document.querySelector<HTMLMetaElement>(selector)?.content ?? null,
      null,
    ) ?? null;
};

const getAuthorName = (document: Document): string | null =>
  document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content ?? null;

const getImage = (document: Document): string | null => {
  return [
    'meta[property="og:image"]',
    'meta[name="twitter:image:src"]',
  ]
    .reduce<string | null>(
      (acc, selector) => acc ?? document.querySelector<HTMLMetaElement>(selector)?.content ?? null,
      null,
    ) ?? null;
};

const getColorAsInt = async (resource: string | Buffer): Promise<number> => {
  const { value: [red, green, blue] } = await fastAvgColor.getAverageColor(resource, { silent: true });
  return (red << 16) + (green << 8) + blue;
};

client.on(Events.MessageCreate, async message => {
  await setTimeout(THRESHOLD_DELAY);

  const urls = urlsOfText(message.content);
  if (message.embeds.length < urls.length) {
    const embedUrls = message.embeds
      .map(embed => embed.url)
      .filter((url: string | null): url is string => url != null);
    const targetUrls = urls.filter(url => !embedUrls.includes(url));

    const embeds: APIEmbed[] = [];

    const files: AttachmentBuilder[] = [];

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
            const { protocol, host } = new URL(url);
            authorName = getAuthorName(await urlToDocument(`${protocol}//${host}/`));
          }

          if (authorName != null) {
            const options: EmbedAuthorOptions = { name: authorName };

            const base = document.querySelector<HTMLBaseElement>('base[href]');
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
