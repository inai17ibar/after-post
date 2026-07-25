import { Hono } from 'hono';
import { createEventSchema, logEventSchema } from './lib/validation';
import { generateAdminToken } from './lib/token';
import { TEMPLATE_CATALOG } from './lib/templates';
import { getDashboardStats } from './lib/analytics';
import { moderateComment } from './lib/moderation';

type Bindings = { DB: D1Database };

// 同一 session_id × 同一 event_id で直近1時間に受け付けるログ件数の上限
const MAX_LOGS_PER_SESSION_PER_HOUR = 60;

interface EventRow {
  id: string;
  name: string;
  subtitle: string;
  venue: string;
  event_date: string;
  hashtags: string;
  lead_copy: string;
  description: string;
  campaign_text: string;
  moments: string;
  mood_tags: string;
  templates: string;
}

function serializePublicEvent(row: EventRow) {
  return {
    eventId: row.id,
    eventName: row.name,
    eventSubTitle: row.subtitle,
    venue: row.venue,
    date: row.event_date,
    hashtags: JSON.parse(row.hashtags) as string[],
    leadCopy: row.lead_copy,
    description: row.description,
    campaignText: row.campaign_text,
    moments: JSON.parse(row.moments) as string[],
    moodTags: JSON.parse(row.mood_tags) as string[],
    templates: JSON.parse(row.templates) as unknown[],
  };
}

function bearerToken(header: string | undefined | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

const app = new Hono<{ Bindings: Bindings }>();

app.post('/events', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  const existing = await c.env.DB.prepare('SELECT id FROM events WHERE id = ?').bind(input.eventId).first();
  if (existing) {
    return c.json({ error: 'event_id_taken' }, 409);
  }

  const adminToken = generateAdminToken();
  const templates = TEMPLATE_CATALOG.filter((entry) => input.templateIds.includes(entry.templateId));

  await c.env.DB.prepare(
    `INSERT INTO events (id, admin_token, name, subtitle, venue, event_date, hashtags, lead_copy, description, campaign_text, moments, mood_tags, templates, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  )
    .bind(
      input.eventId,
      adminToken,
      input.name,
      input.subtitle,
      input.venue,
      input.date,
      JSON.stringify(input.hashtags),
      input.leadCopy,
      input.description,
      input.campaignText,
      JSON.stringify(input.moments),
      JSON.stringify(input.moodTags),
      JSON.stringify(templates),
    )
    .run();

  return c.json(
    {
      eventId: input.eventId,
      publicUrl: `/e/${input.eventId}/`,
      adminToken,
      adminUrl: `/admin/${input.eventId}/${adminToken}/`,
    },
    201,
  );
});

app.get('/events/:eventId', async (c) => {
  const eventId = c.req.param('eventId');
  const row = await c.env.DB.prepare(
    `SELECT id, name, subtitle, venue, event_date, hashtags, lead_copy, description, campaign_text, moments, mood_tags, templates
     FROM events WHERE id = ?`,
  )
    .bind(eventId)
    .first<EventRow>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json(serializePublicEvent(row));
});

app.post('/events/:eventId/logs', async (c) => {
  const eventId = c.req.param('eventId');
  const exists = await c.env.DB.prepare('SELECT 1 FROM events WHERE id = ?').bind(eventId).first();
  if (!exists) return c.json({ error: 'not_found' }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = logEventSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
  const log = parsed.data;

  const recent = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM event_logs
     WHERE event_id = ? AND session_id = ? AND created_at >= datetime('now', '-1 hour')`,
  )
    .bind(eventId, log.sessionId)
    .first<{ count: number }>();
  if ((recent?.count ?? 0) >= MAX_LOGS_PER_SESSION_PER_HOUR) {
    return c.json({ error: 'rate_limited' }, 429);
  }

  let comment: string | null = null;
  if (log.comment) {
    comment = moderateComment(log.comment).comment.slice(0, 280) || null;
  }

  await c.env.DB.prepare(
    `INSERT INTO event_logs (event_id, session_id, action, source, template_id, mood_tag, moment_type, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      eventId,
      log.sessionId,
      log.action,
      log.source ?? null,
      log.templateId ?? null,
      log.moodTag ?? null,
      log.momentType ?? null,
      comment,
    )
    .run();

  return c.json({ ok: true }, 202);
});

app.get('/admin/:eventId/dashboard', async (c) => {
  const eventId = c.req.param('eventId');
  const token = bearerToken(c.req.header('Authorization'));

  const row = await c.env.DB.prepare('SELECT admin_token, is_demo FROM events WHERE id = ?')
    .bind(eventId)
    .first<{ admin_token: string; is_demo: number }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (!token || token !== row.admin_token) return c.json({ error: 'forbidden' }, 403);

  const stats = await getDashboardStats(c.env.DB, eventId, row.is_demo === 1);
  return c.json(stats);
});

export default app;
