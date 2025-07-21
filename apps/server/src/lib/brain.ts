import { ReSummarizeThread, SummarizeMessage, SummarizeThread } from './brain.fallback.prompts';
import { env } from 'cloudflare:workers';
import { EPrompts } from '../types';

export const enableBrainFunction = async (connection: { id: string; providerId: string }) => {
  // TODO: Connect to actual zero-worker service when available
  // For now, just mark the connection as subscribed in KV storage
  await env.subscribed_accounts.put(connection.id, 'enabled');
  console.log(`[BRAIN] Enabled brain for connection ${connection.id}`);
  return { success: true };
};

export const disableBrainFunction = async (connection: { id: string; providerId: string }) => {
  // TODO: Connect to actual zero-worker service when available  
  // For now, just remove the subscription from KV storage
  await env.subscribed_accounts.delete(connection.id);
  console.log(`[BRAIN] Disabled brain for connection ${connection.id}`);
  return { success: true };
};

const getPromptName = (connectionId: string, prompt: EPrompts) => {
  return `${connectionId}-${prompt}`;
};

export const getPrompt = async (promptName: string, fallback: string) => {
  const existingPrompt = await env.prompts_storage.get(promptName);
  if (!existingPrompt) {
    await env.prompts_storage.put(promptName, fallback);
    return fallback;
  }
  return existingPrompt;
};

export const getPrompts = async ({ connectionId }: { connectionId: string }) => {
  const prompts: Record<EPrompts, string> = {
    [EPrompts.SummarizeMessage]: '',
    [EPrompts.ReSummarizeThread]: '',
    [EPrompts.SummarizeThread]: '',
    // [EPrompts.ThreadLabels]: '',
    // [EPrompts.Chat]: '',
  };
  const fallbackPrompts = {
    [EPrompts.SummarizeMessage]: SummarizeMessage,
    [EPrompts.ReSummarizeThread]: ReSummarizeThread,
    [EPrompts.SummarizeThread]: SummarizeThread,
    // [EPrompts.ThreadLabels]: '',
    // [EPrompts.Chat]: '',
  };
  for (const promptType of Object.values(EPrompts)) {
    const promptName = getPromptName(connectionId, promptType);
    const prompt = await getPrompt(promptName, fallbackPrompts[promptType]);
    prompts[promptType] = prompt;
  }
  return prompts;
};
