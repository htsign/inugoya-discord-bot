export const SUNDAY = 0;
export const MONDAY = 1;
export const TUESDAY = 2;
export const WEDNESDAY = 3;
export const THURSDAY = 4;
export const FRIDAY = 5;
export const SATURDAY = 6;

export const weekdays = [SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY] as const;
export type Weekday = typeof weekdays[number];

export const fromNumber = (n: number): Weekday => {
  switch (n) {
    case 0:
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      return n;
    default:
      throw new RangeError('out of range');
  }
};

export const jpString = (weekday: Weekday): string => {
  return (['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'] as const)[weekday];
};
