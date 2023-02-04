const URL_REGEX = /\bhttps?:\/\/\S+/g;

/** @type {(content: string) => content is Url} */
const isUrl = content => URL_REGEX.test(content);

module.exports = { URL_REGEX, isUrl };
