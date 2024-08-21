import i18next from 'i18next';
import { getEnv } from '../bot/lib/util.js';
import ja from './ja.json' with { type: 'json' };

await i18next.init({
  lng: getEnv('LANG'),
  resources: { ja },
});

export default i18next;
