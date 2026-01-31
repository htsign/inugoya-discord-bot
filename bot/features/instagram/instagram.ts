import { Events } from 'discord.js';
import { logError } from '../../lib/log.ts';
import { urlsOfText } from '../../lib/util.ts';
import { addHandler } from '../../listeners.ts';

addHandler(Events.MessageCreate, message => {
  const { content, author, guild, channel } = message;

  if (author.bot || guild == null || channel.isVoiceBased() || !('name' in channel)) return;

  const urls = urlsOfText(content);
  const re = /(?<=^https?:\/\/(?:www\.)?)(?=instagram\.com\/.+?$)/;

  const replacedUrls = urls.flatMap(url => {
    if (re.test(url) && !url.includes('/live/')) {
      return [url.replace(re, 'vx')];
    }
    return [];
  });

  if (replacedUrls.length > 0) {
    channel.send(replacedUrls.join('\n')).catch(e => {
      logError(e, 'instagram:', `failed to send to: ${guild.name}/${channel.name}`);
    });
  }
});
