import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';
import { cookiePreferencesRouter } from './routes/cookies';
import { connectionsRouter } from './routes/connections';
import { shortcutRouter } from './routes/shortcut';
import { settingsRouter } from './routes/settings';
import { getContext } from 'hono/context-storage';
import { draftsRouter } from './routes/drafts';
import { labelsRouter } from './routes/label';
import { brainRouter } from './routes/brain';
import { notesRouter } from './routes/notes';
import { mailRouter } from './routes/mail';
import { userRouter } from './routes/user';
import { crmRouter } from './routes/crm';
import { leadsRouter } from './routes/leads';
import { calendarRouter } from './routes/calendar';
import type { HonoContext } from '../ctx';
import { aiRouter } from './routes/ai';
import { router } from './trpc';

export const appRouter = router({
  ai: aiRouter,
  brain: brainRouter,
  calendar: calendarRouter,
  connections: connectionsRouter,
  cookiePreferences: cookiePreferencesRouter,
  crm: crmRouter,
  drafts: draftsRouter,
  labels: labelsRouter,
  leads: leadsRouter,
  mail: mailRouter,
  notes: notesRouter,
  shortcut: shortcutRouter,
  settings: settingsRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;

export type Inputs = inferRouterInputs<AppRouter>;
export type Outputs = inferRouterOutputs<AppRouter>;

export const serverTrpc = () => {
  const c = getContext<HonoContext>();
  return appRouter.createCaller({
    c,
    session: c.var.session,
    db: c.var.db,
    auth: c.var.auth,
    autumn: c.var.autumn,
  });
};
