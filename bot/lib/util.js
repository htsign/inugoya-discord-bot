const URL_REGEX = /^https?:\/\/\S+$/;
const URL_REGEX_GLOBAL = /\bhttps?:\/\/\S+/g;

/** @type {(content: string) => content is Url} */
const isUrl = content => URL_REGEX.test(content);

module.exports = { URL_REGEX_GLOBAL, isUrl };
