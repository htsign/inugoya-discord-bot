const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

require('./bot/features/commands');
require('./bot/features/hage');
require('./bot/features/weeklyAwards');
require('./bot/features/noExpandedExpand');
require('./bot/features/vcAttention');
require('./bot/features/shortenUrl');
require('./bot/features/discordUrlExpand');
