import { setDefaultResultOrder } from 'node:dns';

setDefaultResultOrder('ipv4first');

import './locales/init.ts';
import './bot/features/commands.ts';
import './bot/features/launched/index.ts';
import './bot/features/hage/index.ts';
import './bot/features/weeklyAwards/index.ts';
import './bot/features/earthquake/index.ts';
import './bot/features/instagram/index.ts';
import './bot/features/noExpandedExpand/index.ts';
import './bot/features/vcAttention/index.ts';
import './bot/features/shortenUrl/index.ts';
import './bot/features/discordUrlExpand/index.ts';

import { instance as processManager } from './bot/lib/processManager.ts';

process.on('SIGINT', () => {
  console.log('SIGINT received');
  processManager.killAll();
  process.exit();
});
