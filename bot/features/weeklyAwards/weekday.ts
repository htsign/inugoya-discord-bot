export const enum Weekday {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
};

export const jpString = (weekday: Weekday): string => {
  switch (weekday) {
    case Weekday.SUNDAY   : return '日曜';
    case Weekday.MONDAY   : return '月曜';
    case Weekday.TUESDAY  : return '火曜';
    case Weekday.WEDNESDAY: return '水曜';
    case Weekday.THURSDAY : return '木曜';
    case Weekday.FRIDAY   : return '金曜';
    case Weekday.SATURDAY : return '土曜';
  }
};
