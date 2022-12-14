import dayjs from './dayjsSetup.js';

export const log = (...values: unknown[]) => {
  const now = dayjs().tz();
  console.log(now.format('YYYY/MM/DD HH:mm:ss.SSS'), ...values);
};
