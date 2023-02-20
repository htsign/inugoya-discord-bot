import dayjs from './dayjsSetup';

/**
 * @param  {...any} values
 */
export function log(...values) {
  const now = dayjs().tz();
  console.log(now.format('YYYY/MM/DD HH:mm:ss.SSS'), ...values);
}
