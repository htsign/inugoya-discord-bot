import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import './bot/features/commands';
import './bot/features/launched';
import './bot/features/hage';
import './bot/features/weeklyAwards';
import './bot/features/noExpandedExpand';
import './bot/features/vcAttention';
import './bot/features/shortenUrl';
import './bot/features/discordUrlExpand';

import { instance as processManager } from '@lib/processManager';

process.on('SIGINT', () => {
  console.log('SIGINT received');
  processManager.killAll();
  process.exit();
});
