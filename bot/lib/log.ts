import { dayjs } from './dayjsSetup';

export const log = (...values: any[]): void => {
  const now = dayjs().tz();
  console.log(now.format('YYYY/MM/DD HH:mm:ss.SSS'), ...values);
};
