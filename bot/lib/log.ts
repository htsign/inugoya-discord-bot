import { writeFile } from 'node:fs/promises';
import dayjs from './dayjsSetup.ts';

/**
 * @param {unknown} value
 * @returns {string}
 */
const formatter = (value: unknown): string => {
  const set = new WeakSet<object>();

  const core = (value: unknown, inner: boolean, depth: number): string => {
    if (value == null) return 'null';

    switch (typeof value) {
      case 'string':
        return inner ? `'${value}'` : value;
      case 'number':
        return String(value);
      case 'bigint':
        return `${value}n`;
      case 'boolean':
        return String(value);
      case 'symbol':
        return `Symbol(${value.description ?? ''})`;
      case 'function':
        return `function (${value.name})`;
      default: /* object */ {
        if (set.has(value)) return '<Circular>';
        set.add(value);

        if (Array.isArray(value)) {
          return `[ ${value.map(x => core(x, true, depth + 1)).join(', ')} ]`;
        }
        const content = Object.entries(value).map(([key, val]) => `${'  '.repeat(depth)}${key}: ${core(val, true, depth + 1)},`).join('\n');
        return `{\n${content}\n}`;
      }
    }
  };
  return core(value, false, 1);
};

export function log(...values: unknown[]): Promise<void> {
  const now = dayjs().tz();
  const strings = [
    now.format('YYYY/MM/DD HH:mm:ss.SSS'),
    ...values.map(formatter),
  ];

  const wp = writeFile(`logs/${now.format('YYYY-MM-DD')}.log`, `${strings.join(' ')}\n`, { encoding: 'utf-8', flag: 'a' });
  console.log(...strings);

  return wp;
}

export function logError(error: Error, ...values: unknown[]): Promise<void> {
  return log(...values, error.stack ?? `${error.name}: ${error.message}`);
}
