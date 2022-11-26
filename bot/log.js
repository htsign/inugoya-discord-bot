const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault('Asia/Tokyo');

exports.log = (...values) => {
  const now = dayjs().tz();
  console.log(now.format('YYYY/MM/DD HH:mm:ss.SSS'), ...values);
};
