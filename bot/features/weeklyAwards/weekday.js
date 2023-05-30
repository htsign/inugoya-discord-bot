/** @typedef {typeof SUNDAY | typeof MONDAY | typeof TUESDAY | typeof WEDNESDAY | typeof THURSDAY | typeof FRIDAY | typeof SATURDAY} Weekday */

/** @type {0} */
export const SUNDAY = 0;
/** @type {1} */
export const MONDAY = 1;
/** @type {2} */
export const TUESDAY = 2;
/** @type {3} */
export const WEDNESDAY = 3;
/** @type {4} */
export const THURSDAY = 4;
/** @type {5} */
export const FRIDAY = 5;
/** @type {6} */
export const SATURDAY = 6;

/**
 * @param {number} n
 * @returns {Weekday}
 */
export const fromNumber = n => {
  switch (n) {
    case 0: return SUNDAY;
    case 1: return MONDAY;
    case 2: return TUESDAY;
    case 3: return WEDNESDAY;
    case 4: return THURSDAY;
    case 5: return FRIDAY;
    case 6: return SATURDAY;
    default:
      throw new RangeError('out of range');
  }
};

/**
 * @param {Weekday} weekday
 * @returns {string}
 */
export const jpString = weekday => {
  switch (weekday) {
    case SUNDAY   : return '日曜';
    case MONDAY   : return '月曜';
    case TUESDAY  : return '火曜';
    case WEDNESDAY: return '水曜';
    case THURSDAY : return '木曜';
    case FRIDAY   : return '金曜';
    case SATURDAY : return '土曜';
  }
};
