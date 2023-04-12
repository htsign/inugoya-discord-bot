/** @type {0} */
const SUNDAY = 0;
/** @type {1} */
const MONDAY = 1;
/** @type {2} */
const TUESDAY = 2;
/** @type {3} */
const WEDNESDAY = 3;
/** @type {4} */
const THURSDAY = 4;
/** @type {5} */
const FRIDAY = 5;
/** @type {6} */
const SATURDAY = 6;

/**
 * @param {number} n
 * @returns {Weekday}
 */
const fromNumber = n => {
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
const jpString = weekday => {
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

module.exports = {
  SUNDAY,
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  FRIDAY,
  SATURDAY,
  fromNumber,
  jpString,
};
