import { z } from 'zod';

export const serializedFileSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number(),
  lastModified: z.number(),
  base64: z.string(),
});

export const deserializeFiles = async (serializedFiles: z.infer<typeof serializedFileSchema>[]) => {
  return await Promise.all(
    serializedFiles.map((data) => {
      const file = Buffer.from(data.base64, 'base64');
      const blob = new Blob([file], { type: data.type });
      const newFile = new File([blob], data.name, {
        type: data.type,
        lastModified: data.lastModified,
      });
      return newFile;
    }),
  );
};

export const createDraftData = z.object({
  to: z.string(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string(),
  message: z.string(),
  attachments: z.array(serializedFileSchema).transform(deserializeFiles).optional(),
  id: z.string().nullable(),
});

export type CreateDraftData = z.infer<typeof createDraftData>;

export const defaultUserSettings = {
  language: 'en',
  timezone: 'UTC',
  dynamicContent: false,
  externalImages: true,
  customPrompt: '',
  trustedSenders: [],
  isOnboarded: false,
  colorTheme: 'system',
  leadGeneration: {
    hunterApiKey: '',
    apolloApiKey: '',
    snovApiKey: '',
    pdlApiKey: '',
    linkedinSalesNavCookie: '',
    linkedinAlternativeApiKey: '',
    linkedinAlternativeProvider: 'scrap_in' as 'scrap_in' | 'bright_data' | 'apollo',
    defaultSearchLimit: 10,
    enableAutoEnrichment: true,
  },
} satisfies UserSettings;

export const userSettingsSchema = z.object({
  language: z.string(),
  timezone: z.string(),
  dynamicContent: z.boolean().optional(),
  externalImages: z.boolean(),
  customPrompt: z.string(),
  isOnboarded: z.boolean().optional(),
  trustedSenders: z.string().array().optional(),
  colorTheme: z.enum(['light', 'dark', 'system']).default('system'),
  leadGeneration: z.object({
    hunterApiKey: z.string().optional(),
    apolloApiKey: z.string().optional(),
    snovApiKey: z.string().optional(),
    pdlApiKey: z.string().optional(),
    linkedinSalesNavCookie: z.string().optional(),
    linkedinAlternativeApiKey: z.string().optional(),
    linkedinAlternativeProvider: z.enum(['scrap_in', 'bright_data', 'apollo']).default('scrap_in'),
    defaultSearchLimit: z.number().min(1).max(50).default(10),
    enableAutoEnrichment: z.boolean().default(true),
  }).optional(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;
