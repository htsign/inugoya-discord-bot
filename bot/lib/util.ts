import dotenv from 'dotenv';

export const URL_REGEX_GLOBAL = /\bhttps?:\/\/\S+/g;
const configOutput = dotenv.config();

export const getEnv = (key: string, name: string = 'token'): string => {
  const token = configOutput.parsed?.[key] ?? process.env[key];
  if (token == null) {
    throw new Error(`${name} is empty`);
  }
  return token;
};

export const isUrl = (content: string): content is Url => /^https?:\/\/\S+$/.test(content);
