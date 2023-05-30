import { setDefaultResultOrder } from 'node:dns';
setDefaultResultOrder('ipv4first');

import './bot/features/commands.js';
import './bot/features/hage/index.js';
import './bot/features/weeklyAwards/index.js';
import './bot/features/noExpandedExpand/index.js';
import './bot/features/vcAttention/index.js';
import './bot/features/shortenUrl/index.js';
import './bot/features/discordUrlExpand/index.js';
