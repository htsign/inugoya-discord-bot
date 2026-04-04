import { log } from '#lib/log.ts';
import type { RegionalIndicatorsResult } from '#types/bot/features/regionalIndicators';

const codeRegionalIndicatorA = '🇦'.codePointAt(0) ?? 0;
const codeLowerA = 'a'.codePointAt(0) ?? 0;
const codeLowerZ = 'z'.codePointAt(0) ?? 0;
const cpDiff = codeRegionalIndicatorA - codeLowerA;

const code0 = '0'.codePointAt(0) ?? 0;
const code9 = '9'.codePointAt(0) ?? 0;
const numberEmojis = Array.from({ length: 10 }, (_, i) => `${i}\u20e3`);

const isLowerAlphabet: (codePoint: number) => boolean = cp => codeLowerA <= cp && cp <= codeLowerZ;
const isNumber: (codePoint: number) => boolean = cp => code0 <= cp && cp <= code9;

export const toEmojis = (text: string): RegionalIndicatorsResult => {
  if (text.length !== new Set(text).size) {
    return { success: false, message: '重複文字が含まれています。' };
  }

  const codePoints = Array.from(text.toLowerCase(), c => c.codePointAt(0) ?? 0);

  if (codePoints.some(cp => !(isLowerAlphabet(cp) || isNumber(cp)))) {
    return { success: false, message: 'アルファベットまたは算用数字以外が含まれています。' };
  }

  const toEmoji = (codePoint: number): string => {
    if (isLowerAlphabet(codePoint)) {
      return String.fromCodePoint(cpDiff + codePoint);
    }
    if (isNumber(codePoint)) {
      const emojiString = numberEmojis[codePoint - code0];

      if (emojiString == null) {
        throw new Error('invalid index access');
      }
      return emojiString;
    }
    throw new Error('unexpected procedure');
  };

  log(`${toEmojis.name}:`, text);
  return { success: true, values: codePoints.map(toEmoji) };
};
