const dayjs = require('./dayjsSetup.js');

/**
 * @param  {...any} values
 */
exports.log = (...values) => {
  const now = dayjs().tz();
  console.log(now.format('YYYY/MM/DD HH:mm:ss.SSS'), ...values);
};
