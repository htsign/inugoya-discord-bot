export type Weekday =
  | typeof SUNDAY
  | typeof MONDAY
  | typeof TUESDAY
  | typeof WEDNESDAY
  | typeof THURSDAY
  | typeof FRIDAY
  | typeof SATURDAY
  ;

export const SUNDAY = 0;
export const MONDAY = 1;
export const TUESDAY = 2;
export const WEDNESDAY = 3;
export const THURSDAY = 4;
export const FRIDAY = 5;
export const SATURDAY = 6;

export const fromNumber = (n: number): Weekday => {
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

export const jpString = (weekday: Weekday): string => {
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
