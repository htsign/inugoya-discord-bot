import fs from 'node:fs/promises';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { runes } from 'runes2';
import { log, logError } from '../../../../lib/log.js';

/**
 * @param {string} url
 * @param {string} statusId
 * @return {Promise<{ embeds: import('discord.js').APIEmbed[], attachments: AttachmentBuilder[] }>}
 */
export const retrieveFromVx = async (url, statusId) => {
  log(`noExpandedExpand#X#${retrieveFromVx.name}:`, `start for ${url}`);
  try {
    const jsonText = await fetch(`https://api.vxtwitter.com/Twitter/status/${statusId}`)
      .then(res => res.text());

    /** @type {import('types/bot/features/noExpandedExpand/twitterView.js').VxTwitterAPIResponse} */
    let jsonObject;
    try {
      jsonObject = JSON.parse(jsonText);
    }
    catch {
      log(`noExpandedExpand#X#${retrieveFromVx.name}:`, 'failed to parse json', jsonText);
      return { embeds: [], attachments: [] };
    }

    if ('error' in jsonObject) {
      log(`noExpandedExpand#X#${retrieveFromVx.name}:`, jsonObject.error);
      return { embeds: [], attachments: [] };
    }

    const {
      user_name: name,
      user_screen_name: screenName,
      user_profile_image_url: profileImage,
      text: tweetBody,
      date_epoch: timestamp,
      likes,
      retweets,
      media_extended: media,
      qrtURL,
    } = jsonObject;

    const embed = new EmbedBuilder({ url });
    embed.setColor(0x1d9bf0);
    embed.setFooter({ text: 'Twitter', iconURL: 'attachment://logo.png' });

    embed.setAuthor({ name: `${name} (@${screenName})`, url: `https://twitter.com/${screenName}`, iconURL: profileImage });
    {
      let text = tweetBody;

      // remove t.co URLs
      text = text.replace(/ https:\/\/t\.co\/\S+/g, '');

      // replace plain url to markdown link
      text = text.replace(/(https?:\/\/)(\S+)/g, '[$2]($1$2)');

      // replace hashtag to markdown link
      text = text.replace(/(?<hash>#|＃)(?<keyword>.+?)(?=[\s#＃])/g, '[$<hash>$<keyword>](https://twitter.com/hashtag/$<keyword>)');

      // replace mention to markdown link
      text = text.replace(/@(\S+)/g, '[@$1](https://twitter.com/$1)');

      const ellipsis = '…\n\n（4000文字制限のため以下省略）';
      if (runes(text).length > 4000) {
        text = text.slice(0, 4000 - ellipsis.length) + ellipsis;
      }

      embed.setDescription(text);
    }

    embed.setTimestamp(timestamp * 1000);
    if (likes !== 0) {
      embed.addFields({ name: 'Likes', value: String(likes), inline: true });
    }
    if (retweets !== 0) {
      embed.addFields({ name: 'Retweets', value: String(retweets), inline: true });
    }

    /**
     * @param {import('types/bot/features/noExpandedExpand/twitterView.js').MediaInfo} media
     * @returns {import('types').Url}
     */
    const getMediaImage = media => media.type === 'image' ? media.url : media.thumbnail_url;
    const [firstMedia, ...restMediaList] = media;
    if (firstMedia != null) {
      embed.setImage(getMediaImage(firstMedia));
    }

    /** @type {import('discord.js').APIEmbed[]} */
    const embeds = [];
    /** @type {import('discord.js').AttachmentBuilder[]} */
    const attachments = [];

    embeds.push(embed.toJSON());
    attachments.push(new AttachmentBuilder(await fs.readFile('./assets/logo/twitter_24x24.png'), { name: 'logo.png' }));

    for (const media of restMediaList) {
      const embed = new EmbedBuilder({ url });
      embed.setImage(getMediaImage(media));
      embeds.push(embed.toJSON());
    }
    // append more images if qrtURL exists
    if (qrtURL != null) {
      const { hooks: [[, hook] = []] } = await import('./index.js');

      if (hook != null) {
        const result = await hook(qrtURL);

        for (const { url: imageUrl } of result.embeds.map(embed => embed.image ?? { url: null })) {
          if (imageUrl == null) continue;

          const embed = new EmbedBuilder({ url });
          embed.setImage(imageUrl);
          embeds.push(embed.toJSON());
        }
      }
    }

    return { embeds, attachments };
  }
  catch (e) {
    if (e instanceof Error) {
      logError(e, `noExpandedExpand#X#${retrieveFromVx.name}:`);
      return { embeds: [], attachments: [] };
    }
    throw e;
  }
};
