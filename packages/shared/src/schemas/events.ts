import { z } from 'zod';

export const LogStreamTypeSchema = z.enum(['stdout', 'stderr', 'system']);

export const LogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  stream: LogStreamTypeSchema,
  message: z.string(),
  raw: z.string().optional(),
  pid: z.number().optional(),
  isError: z.boolean().optional(),
});

export const LogBatchSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  command: z.string(),
  entries: z.array(LogEntrySchema),
  timestamp: z.number(),
});

export const ProcessExitSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  command: z.string(),
  code: z.number().nullable(),
  signal: z.string().nullable(),
  timestamp: z.number(),
});

export const BrowserCheckTriggerSchema = z.object({
  projectId: z.string(),
  targetUrl: z.string().url(),
  forceCheck: z.boolean().optional(),
});

export const AgentRunTriggerSchema = z.object({
  incidentId: z.string(),
  projectId: z.string(),
  autoApplyFix: z.boolean().default(false),
  createPR: z.boolean().default(true),
});
