import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import api from '../../src/app';

type Bindings = { DB: D1Database };

const app = new Hono<{ Bindings: Bindings }>();
app.route('/api', api);

export const onRequest = handle(app);
