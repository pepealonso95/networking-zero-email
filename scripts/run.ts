import { sendEmailsCommand } from './send-emails/index';
import { makeUsersProCommand } from './make-users-pro/index';
import { debugUserBillingCommand } from './debug-user-billing/index';
import { listAutumnProductsCommand } from './list-autumn-products/index';
import { subcommands, run } from 'cmd-ts';

const app = subcommands({
  name: 'scripts',
  cmds: {
    'send-emails': sendEmailsCommand,
    'make-users-pro': makeUsersProCommand,
    'debug-user-billing': debugUserBillingCommand,
    'list-autumn-products': listAutumnProductsCommand,
  },
});

await run(app, process.argv.slice(2));
process.exit(0);
