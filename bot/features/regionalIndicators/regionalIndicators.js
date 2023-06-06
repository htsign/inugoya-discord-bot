import { log } from '../../lib/log.js';

const codeRegionalIndicatorA = '🇦'.codePointAt(0) ?? 0;
const codeLowerA = 'a'.codePointAt(0) ?? 0;
const codeLowerZ = 'z'.codePointAt(0) ?? 0;
const cpDiff = codeRegionalIndicatorA - codeLowerA;

const code0 = '0'.codePointAt(0) ?? 0;
const code9 = '9'.codePointAt(0) ?? 0;
const numberEmojis = Array.from({ length: 10 }, (_, i) => `${i}\u20e3`);

/** @type {(codePoint: number) => boolean} */
const isLowerAlphabet = cp => codeLowerA <= cp && cp <= codeLowerZ;
/** @type {(codePoint: number) => boolean} */
const isNumber = cp => code0 <= cp && cp <= code9;

/**
 * @param {string} text
 * @returns {import('types/bot/features/regionalIndicators').RegionalIndicatorsResult}
 */
export const toEmojis = text => {
  if (text.length !== new Set(text).size) {
    return { success: false, message: '重複文字が含まれています。' };
  }

  const codePoints = Array.from(text.toLowerCase(), c => c.codePointAt(0) ?? 0);

  if (codePoints.some(cp => !(isLowerAlphabet(cp) || isNumber(cp)))) {
    return { success: false, message: 'アルファベットまたは算用数字以外が含まれています。' };
  }

  /** @type {(codePoint: number) => string} */
  const toEmoji = cp => {
    if (isLowerAlphabet(cp)) {
      return String.fromCodePoint(cpDiff + cp);
    }
    else if (isNumber(cp)) {
      const emojiString = numberEmojis[cp - code0];

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
