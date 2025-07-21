import {
  streamText,
  generateObject,
  tool,
  type StreamTextOnFinishCallback,
  createDataStreamResponse,
  generateText,
} from 'ai';
import {
  AiChatPrompt,
  getCurrentDateContext,
  GmailSearchAssistantSystemPrompt,
} from '../lib/prompts';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Connection, type ConnectionContext } from 'agents';
import { createSimpleAuth, type SimpleAuth } from '../lib/auth';
import { connectionToDriver } from '../lib/server-utils';
import type { MailManager } from '../lib/driver/types';
import { FOLDERS, parseHeaders } from '../lib/utils';
import { AIChatAgent } from 'agents/ai-chat-agent';
import { tools as authTools } from './agent/tools';
import { processToolCalls } from './agent/utils';
import { connection } from '../db/schema';
import { env } from 'cloudflare:workers';
import { createOpenAI } from '@ai-sdk/openai';
import { McpAgent } from 'agents/mcp';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { z } from 'zod';

export class ZeroAgent extends AIChatAgent<typeof env> {
  driver: MailManager | null = null;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    console.log('[ZeroAgent] Constructor - API Key present:', !!env.OPENAI_API_KEY);
  }

  private getDataStreamResponse(onFinish: StreamTextOnFinishCallback<{}>) {
    console.log('[ZeroAgent] getDataStreamResponse - Starting chat flow');
    const dataStreamResponse = createDataStreamResponse({
      execute: async (dataStream) => {
        try {
          console.log('[ZeroAgent] Execute - Getting connection ID');
          const connectionId = (await this.ctx.storage.get('connectionId')) as string;
          console.log('[ZeroAgent] Execute - Connection ID:', connectionId);
          
          if (!connectionId || !this.driver) {
            console.log('[ZeroAgent] Unauthorized no driver or connectionId [1]', {
              connectionId,
              hasDriver: !!this.driver
            });
            await this.setupAuth();
            if (!connectionId || !this.driver) {
              console.log('[ZeroAgent] Unauthorized no driver or connectionId [2]', {
                connectionId,
                hasDriver: !!this.driver
              });
              throw new Error('Unauthorized no driver or connectionId [2]');
            }
          }
          
          console.log('[ZeroAgent] Execute - Setting up tools');
          const tools = { ...authTools(this.driver, connectionId), buildGmailSearchQuery };
          const processedMessages = await processToolCalls(
            {
              messages: this.messages,
              dataStream,
              tools,
            },
            {},
          );

          console.log('[ZeroAgent] Execute - Messages processed:', processedMessages.length);
          console.log('[ZeroAgent] Execute - API Key check:', {
            hasApiKey: !!this.env.OPENAI_API_KEY,
            keyPrefix: this.env.OPENAI_API_KEY?.substring(0, 10) + '...'
          });

          // Create OpenAI client with API key from environment
          const openai = createOpenAI({
            apiKey: this.env.OPENAI_API_KEY,
          });

          console.log('[ZeroAgent] Execute - OpenAI client created, starting stream');

                     const result = streamText({
             model: openai('gpt-4o'),
             messages: processedMessages,
             tools,
             onFinish: (finishData) => {
               console.log('[ZeroAgent] Stream finished:', {
                 usage: finishData.usage,
                 finishReason: finishData.finishReason,
                 text: finishData.text?.substring(0, 100) + '...'
               });
               onFinish(finishData as any);
             },
             system: AiChatPrompt('', '', ''),
           });

          console.log('[ZeroAgent] Execute - Merging into data stream');
          result.mergeIntoDataStream(dataStream);
                 } catch (error) {
           console.error('[ZeroAgent] Execute - Error in data stream:', {
             error: error instanceof Error ? error.message : String(error),
             stack: error instanceof Error ? error.stack : undefined,
             name: error instanceof Error ? error.name : 'Unknown'
           });
           
           // Provide more specific error messages for common issues
           if (error instanceof Error) {
             if (error.message.includes('quota') || error.message.includes('billing')) {
               throw new Error('OpenAI API quota exceeded. Please check your billing details at https://platform.openai.com/account/billing');
             } else if (error.message.includes('401')) {
               throw new Error('OpenAI API authentication failed. Please check your API key configuration.');
             } else if (error.message.includes('429')) {
               throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
             }
           }
           
           throw error;
         }
      },
    });

    return dataStreamResponse;
  }

  private async setupAuth() {
    console.log('[ZeroAgent] setupAuth - Starting authentication setup');
    if (this.name) {
      console.log('[ZeroAgent] setupAuth - Name found:', this.name);
      const db = createDb(env.HYPERDRIVE.connectionString);
      const _connection = await db.query.connection.findFirst({
        where: eq(connection.userId, this.name),
      });
      if (_connection) {
        console.log('[ZeroAgent] setupAuth - Connection found:', _connection.id);
        await this.ctx.storage.put('connectionId', _connection.id);
        this.driver = connectionToDriver(_connection);
        console.log('[ZeroAgent] setupAuth - Driver created successfully');
      } else {
        console.log('[ZeroAgent] setupAuth - No connection found for user:', this.name);
      }
    } else {
      console.log('[ZeroAgent] setupAuth - No name provided');
    }
  }

  async onConnect() {
    console.log('[ZeroAgent] onConnect - Connection established');
    await this.setupAuth();
  }

  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    console.log('[ZeroAgent] onChatMessage - New chat message received');
    console.log('[ZeroAgent] onChatMessage - Messages count:', this.messages.length);
    console.log('[ZeroAgent] onChatMessage - Last message:', this.messages[this.messages.length - 1]?.role);
    return this.getDataStreamResponse(onFinish);
  }
}

export class ZeroMCP extends McpAgent<typeof env, {}, { cookie: string }> {
  auth: SimpleAuth;
  server = new McpServer({
    name: 'zero-mcp',
    version: '1.0.0',
    description: 'Zero MCP',
  });

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.auth = createSimpleAuth();
  }

  async init(): Promise<void> {
    const session = await this.auth.api.getSession({ headers: parseHeaders(this.props.cookie) });
    if (!session) {
      throw new Error('Unauthorized');
    }
    const db = createDb(env.HYPERDRIVE.connectionString);
    const _connection = await db.query.connection.findFirst({
      where: eq(connection.email, session.user.email),
    });
    if (!_connection) {
      throw new Error('Unauthorized');
    }
    const driver = connectionToDriver(_connection);

    this.server.tool(
      'buildGmailSearchQuery',
      {
        query: z.string(),
      },
      async (s) => {
        // Create OpenAI client with API key from environment
        const openai = createOpenAI({
          apiKey: env.OPENAI_API_KEY,
        });
        
        const result = await generateText({
          model: openai('gpt-4o'),
          system: GmailSearchAssistantSystemPrompt(),
          prompt: s.query,
        });
        return {
          content: [
            {
              type: 'text',
              text: result.text,
            },
          ],
        };
      },
    );

    this.server.tool(
      'listThreads',
      {
        folder: z.string().default(FOLDERS.INBOX),
        query: z.string().optional(),
        maxResults: z.number().optional().default(5),
        labelIds: z.array(z.string()).optional(),
        pageToken: z.string().optional(),
      },
      async (s) => {
        const result = await driver.list({
          folder: s.folder,
          query: s.query,
          maxResults: s.maxResults,
          labelIds: s.labelIds,
          pageToken: s.pageToken,
        });
        const content = await Promise.all(
          result.threads.map(async (thread) => {
            const loadedThread = await driver.get(thread.id);
            return [
              {
                type: 'text' as const,
                text: `Subject: ${loadedThread.latest?.subject} | ID: ${thread.id} | Received: ${loadedThread.latest?.receivedOn}`,
              },
            ];
          }),
        );
        return {
          content: content.length
            ? content.flat()
            : [
                {
                  type: 'text' as const,
                  text: 'No threads found',
                },
              ],
        };
      },
    );

    this.server.tool(
      'getThread',
      {
        threadId: z.string(),
      },
      async (s) => {
        const thread = await driver.get(s.threadId);
        const response = await env.VECTORIZE.getByIds([s.threadId]);
        if (response.length && response?.[0]?.metadata?.['content']) {
          const content = response[0].metadata['content'] as string;
          const shortResponse = await env.AI.run('@cf/facebook/bart-large-cnn', {
            input_text: content,
          });
          return {
            content: [
              {
                type: 'text',
                text: shortResponse.summary,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: `Subject: ${thread.latest?.subject}`,
            },
          ],
        };
      },
    );

    this.server.tool(
      'markThreadsRead',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        await driver.modifyLabels(s.threadIds, {
          addLabels: [],
          removeLabels: ['UNREAD'],
        });
        return {
          content: [
            {
              type: 'text',
              text: 'Threads marked as read',
            },
          ],
        };
      },
    );

    this.server.tool(
      'markThreadsUnread',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        await driver.modifyLabels(s.threadIds, {
          addLabels: ['UNREAD'],
          removeLabels: [],
        });
        return {
          content: [
            {
              type: 'text',
              text: 'Threads marked as unread',
            },
          ],
        };
      },
    );

    this.server.tool(
      'modifyLabels',
      {
        threadIds: z.array(z.string()),
        addLabelIds: z.array(z.string()),
        removeLabelIds: z.array(z.string()),
      },
      async (s) => {
        await driver.modifyLabels(s.threadIds, {
          addLabels: s.addLabelIds,
          removeLabels: s.removeLabelIds,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Successfully modified ${s.threadIds.length} thread(s)`,
            },
          ],
        };
      },
    );

    this.server.tool('getCurrentDate', async () => {
      return {
        content: [
          {
            type: 'text',
            text: getCurrentDateContext(),
          },
        ],
      };
    });

    this.server.tool('getUserLabels', async () => {
      const labels = await driver.getUserLabels();
      return {
        content: [
          {
            type: 'text',
            text: labels
              .map((label) => `Name: ${label.name} ID: ${label.id} Color: ${label.color}`)
              .join('\n'),
          },
        ],
      };
    });

    this.server.tool(
      'getLabel',
      {
        id: z.string(),
      },
      async (s) => {
        const label = await driver.getLabel(s.id);
        return {
          content: [
            {
              type: 'text',
              text: `Name: ${label.name}`,
            },
            {
              type: 'text',
              text: `ID: ${label.id}`,
            },
          ],
        };
      },
    );

    this.server.tool(
      'createLabel',
      {
        name: z.string(),
        backgroundColor: z.string().optional(),
        textColor: z.string().optional(),
      },
      async (s) => {
        try {
          await driver.createLabel({
            name: s.name,
            color:
              s.backgroundColor && s.textColor
                ? {
                    backgroundColor: s.backgroundColor,
                    textColor: s.textColor,
                  }
                : undefined,
          });
          return {
            content: [
              {
                type: 'text',
                text: 'Label has been created',
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to create label',
              },
            ],
          };
        }
      },
    );

    this.server.tool(
      'bulkDelete',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        try {
          await driver.modifyLabels(s.threadIds, {
            addLabels: ['TRASH'],
            removeLabels: ['INBOX'],
          });
          return {
            content: [
              {
                type: 'text',
                text: 'Threads moved to trash',
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to move threads to trash',
              },
            ],
          };
        }
      },
    );

    this.server.tool(
      'bulkArchive',
      {
        threadIds: z.array(z.string()),
      },
      async (s) => {
        try {
          await driver.modifyLabels(s.threadIds, {
            addLabels: [],
            removeLabels: ['INBOX'],
          });
          return {
            content: [
              {
                type: 'text',
                text: 'Threads archived',
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              {
                type: 'text',
                text: 'Failed to archive threads',
              },
            ],
          };
        }
      },
    );
  }
}

const buildGmailSearchQuery = tool({
  description: 'Build a Gmail search query',
  parameters: z.object({
    query: z.string().describe('The search query to build, provided in natural language'),
  }),
  execute: async ({ query }) => {
    // Create OpenAI client with API key from environment
    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    const result = await generateObject({
      model: openai('gpt-4o'),
      system: GmailSearchAssistantSystemPrompt(),
      prompt: query,
      schema: z.object({
        query: z.string(),
      }),
    });
    return result.object;
  },
});
