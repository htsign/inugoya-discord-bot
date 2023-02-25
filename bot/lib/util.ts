export const URL_REGEX_GLOBAL = /\bhttps?:\/\/\S+/g;

export const getEnv = (key: string, name: string = 'token'): string => {
  const token = process.env[key];
  if (token == null) {
    throw new Error(`${name} is empty`);
  }
  return token;
};

export const isUrl = (content: string): content is Url => /^https?:\/\/\S+$/.test(content);

export const peek = <T>(value: T): T => {
  console.log(value);
  return value;
};

export const toQueryString = (queries: {}) => Object.entries(queries).map(([key, val]): string => `${key}=${val}`).join('&');
