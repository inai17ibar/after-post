import { z } from 'zod';
import { TEMPLATE_IDS } from './templates';

export const EVENT_ID_PATTERN = /^[a-z0-9-]{3,40}$/;

const templateIdSchema = z.enum(TEMPLATE_IDS);

export const createEventSchema = z.object({
  eventId: z.string().regex(EVENT_ID_PATTERN, 'eventIdは英小文字・数字・ハイフンで3〜40文字にしてください'),
  name: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(80).default(''),
  venue: z.string().trim().max(80).default(''),
  date: z.string().trim().max(40).default(''),
  hashtags: z.array(z.string().trim().min(1).max(40)).max(5).default([]),
  leadCopy: z.string().trim().max(400).default(''),
  description: z.string().trim().max(400).default(''),
  campaignText: z.string().trim().max(400).default(''),
  moments: z.array(z.string().trim().min(1).max(20)).max(12).default([]),
  moodTags: z.array(z.string().trim().min(1).max(20)).max(12).default([]),
  templateIds: z.array(templateIdSchema).min(1).max(TEMPLATE_IDS.length).default([...TEMPLATE_IDS]),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

const logActionSchema = z.enum([
  'page_view',
  'start_clicked',
  'moment_selected',
  'mood_selected',
  'text_submitted',
  'template_selected',
  'card_generated',
  'image_saved',
  'copy_clicked',
  'share_clicked',
]);

export const logEventSchema = z.object({
  sessionId: z.string().trim().min(1).max(100),
  action: logActionSchema,
  source: z.string().trim().max(40).optional(),
  templateId: z.string().trim().max(40).optional(),
  moodTag: z.string().trim().max(40).optional(),
  momentType: z.string().trim().max(40).optional(),
  comment: z.string().trim().max(280).optional(),
});

export type LogEventInput = z.infer<typeof logEventSchema>;
