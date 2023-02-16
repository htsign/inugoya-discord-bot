const codeRegionalIndicatorA = '🇦'.codePointAt(0) ?? 0;
const codeLowerA = 'a'.codePointAt(0) ?? 0;
const codeLowerZ = 'z'.codePointAt(0) ?? 0;
const cpDiff = codeRegionalIndicatorA - codeLowerA;

/**
 * @param {string} text
 * @returns {RegionalIndicatorsResult}
 */
const toEmojis = text => {
  if (text.length !== new Set(text).size) {
    return { success: false, message: '重複文字が含まれています。' };
  }

  const codePoints = Array.from(text.toLowerCase(), c => c.codePointAt(0) ?? 0);

  if (codePoints.some(cp => cp < codeLowerA || codeLowerZ < cp)) {
    return { success: false, message: 'アルファベット以外が含まれています。' };
  }

  return { success: true, values: codePoints.map(cp => String.fromCodePoint(cpDiff + cp)) };
};

module.exports = {
  toEmojis,
};
