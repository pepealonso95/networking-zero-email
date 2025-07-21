import { privateProcedure, activeDriverProcedure, router } from '../trpc';
import { contact, contactInteraction, contactTag, contactTagRelation } from '../../db/schema';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createContactEmailSync } from '../../services/contact-email-sync';
import { getEmbeddingVector } from '../../routes/agent/tools';
import { env } from 'cloudflare:workers';

// Zod schemas for validation
const createContactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  twitterHandle: z.string().optional(),
  website: z.string().url().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  leadSource: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateContactSchema = createContactSchema.partial().extend({
  id: z.string(),
});

const createInteractionSchema = z.object({
  contactId: z.string(),
  type: z.enum(['email', 'phone', 'meeting', 'note', 'other']),
  direction: z.enum(['inbound', 'outbound']).optional(),
  subject: z.string().optional(),
  content: z.string().optional(),
  emailThreadId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

const createTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().default('#6366f1'),
  description: z.string().optional(),
});

// Helper function to determine next action based on email interactions
function determineNextAction(interactions: any[], lastContactedAt: Date | string | null): string {
  // If no interactions, suggest initial outreach
  if (!interactions.length && !lastContactedAt) {
    return 'Reach out';
  }

  // Get the most recent interaction
  const mostRecent = interactions[0];
  if (!mostRecent) {
    // No recent interactions but had contact before - suggest touch base
    if (lastContactedAt) {
      const contactDate = typeof lastContactedAt === 'string' ? new Date(lastContactedAt) : lastContactedAt;
      const daysSinceContact = Math.floor(
        (Date.now() - contactDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceContact > 30) {
        return 'Touch base again';
      }
      return 'Follow up';
    }
    return 'Reach out';
  }

  const daysSinceInteraction = Math.floor(
    (Date.now() - new Date(mostRecent.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // If it's an email interaction
  if (mostRecent.type === 'email') {
    // If they sent something recently (inbound), need to respond
    if (mostRecent.direction === 'inbound') {
      if (daysSinceInteraction <= 2) {
        return 'Respond';
      } else if (daysSinceInteraction <= 7) {
        return 'Respond soon';
      } else {
        return 'Overdue response';
      }
    }
    
    // If we sent something recently (outbound), waiting for response
    if (mostRecent.direction === 'outbound') {
      if (daysSinceInteraction <= 3) {
        return 'Waiting for response';
      } else if (daysSinceInteraction <= 14) {
        return 'Follow up if needed';
      } else {
        return 'Touch base again';
      }
    }
  }

  // For other interaction types or fallback
  if (daysSinceInteraction > 30) {
    return 'Touch base again';
  } else if (daysSinceInteraction > 14) {
    return 'Follow up';
  }
  
  return 'Stay in touch';
}

export const crmRouter = router({
  // Contact CRUD operations
  contacts: router({
    list: privateProcedure
      .input(
        z.object({
          search: z.string().optional(),
          priority: z.enum(['high', 'medium', 'low']).optional(),
          status: z.enum(['active', 'inactive', 'archived']).optional(),
          company: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(async ({ ctx, input }) => {
        const { search, priority, status, company, limit, offset } = input;
        const userId = ctx.session.user.id;

        let whereConditions = [eq(contact.userId, userId)];

        if (search) {
          whereConditions.push(
            or(
              ilike(contact.fullName, `%${search}%`),
              ilike(contact.email, `%${search}%`),
              ilike(contact.company, `%${search}%`),
              ilike(contact.notes, `%${search}%`),
            )!,
          );
        }

        if (priority) {
          whereConditions.push(eq(contact.priority, priority));
        }

        if (status) {
          whereConditions.push(eq(contact.status, status));
        }

        if (company) {
          whereConditions.push(ilike(contact.company, `%${company}%`));
        }

        const contacts = await ctx.db
          .select()
          .from(contact)
          .where(and(...whereConditions))
          .orderBy(desc(contact.lastContactedAt), desc(contact.updatedAt))
          .limit(limit)
          .offset(offset);

        // Get recent interactions for each contact to determine next action
        const contactsWithActions = await Promise.all(
          contacts.map(async (contact) => {
            const recentInteractions = await ctx.db
              .select()
              .from(contactInteraction)
              .where(eq(contactInteraction.contactId, contact.id))
              .orderBy(desc(contactInteraction.createdAt))
              .limit(3);

            const nextAction = determineNextAction(recentInteractions, contact.lastContactedAt);
            const lastInteraction = recentInteractions[0] || null;
            
            return {
              ...contact,
              nextAction,
              lastInteraction,
            };
          })
        );

        const total = await ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(contact)
          .where(and(...whereConditions));

        return {
          contacts: contactsWithActions,
          total: total[0]?.count || 0,
          hasMore: (offset + limit) < (total[0]?.count || 0),
        };
      }),

    get: privateProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        
        const contactData = await ctx.db
          .select()
          .from(contact)
          .where(and(eq(contact.id, input.id), eq(contact.userId, userId)))
          .limit(1);

        if (!contactData[0]) {
          throw new Error('Contact not found');
        }

        // Get recent interactions
        const interactions = await ctx.db
          .select()
          .from(contactInteraction)
          .where(eq(contactInteraction.contactId, input.id))
          .orderBy(desc(contactInteraction.createdAt))
          .limit(10);

        return {
          contact: contactData[0],
          interactions,
        };
      }),

    create: privateProcedure
      .input(createContactSchema)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        const contactId = crypto.randomUUID();

        // Generate full name if not provided
        const fullName = input.fullName || 
          [input.firstName, input.lastName].filter(Boolean).join(' ') ||
          input.email.split('@')[0];

        const newContact = await ctx.db
          .insert(contact)
          .values({
            id: contactId,
            userId,
            fullName,
            ...input,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        return { contact: newContact[0] };
      }),

    update: privateProcedure
      .input(updateContactSchema)
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const userId = ctx.session.user.id;

        const updatedContact = await ctx.db
          .update(contact)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(and(eq(contact.id, id), eq(contact.userId, userId)))
          .returning();

        if (!updatedContact[0]) {
          throw new Error('Contact not found or unauthorized');
        }

        return { contact: updatedContact[0] };
      }),

    delete: privateProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;

        const deleted = await ctx.db
          .delete(contact)
          .where(and(eq(contact.id, input.id), eq(contact.userId, userId)))
          .returning();

        return { success: deleted.length > 0 };
      }),

    syncEmails: activeDriverProcedure
      .input(
        z.object({
          contactId: z.string().optional(), // If not provided, sync all contacts
          forceHistoric: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { driver, db, session } = ctx;
        const userId = session.user.id;

        try {
          const syncService = createContactEmailSync({
            db,
            driver,
            userId,
          });

          await syncService.syncContactEmails(input.contactId, input.forceHistoric);

          return { success: true, message: 'Email sync completed successfully' };
        } catch (error) {
          console.error('Email sync failed:', error);
          throw new Error(`Email sync failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }),
  }),

  // Interaction management
  interactions: router({
    list: privateProcedure
      .input(
        z.object({
          contactId: z.string(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        const { contactId, limit, offset } = input;

        const interactions = await ctx.db
          .select()
          .from(contactInteraction)
          .where(and(
            eq(contactInteraction.contactId, contactId),
            eq(contactInteraction.userId, userId),
          ))
          .orderBy(desc(contactInteraction.createdAt))
          .limit(limit)
          .offset(offset);

        return { interactions };
      }),

    create: privateProcedure
      .input(createInteractionSchema)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        const interactionId = crypto.randomUUID();

        const newInteraction = await ctx.db
          .insert(contactInteraction)
          .values({
            id: interactionId,
            userId,
            ...input,
            scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
            completedAt: input.completedAt ? new Date(input.completedAt) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Update contact's lastContactedAt if interaction is completed
        if (input.completedAt) {
          await ctx.db
            .update(contact)
            .set({
              lastContactedAt: new Date(input.completedAt),
              updatedAt: new Date(),
            })
            .where(and(
              eq(contact.id, input.contactId),
              eq(contact.userId, userId),
            ));
        }

        return { interaction: newInteraction[0] };
      }),

    delete: privateProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;

        const deleted = await ctx.db
          .delete(contactInteraction)
          .where(and(
            eq(contactInteraction.id, input.id),
            eq(contactInteraction.userId, userId),
          ))
          .returning();

        return { success: deleted.length > 0 };
      }),
  }),

  // Tag management
  tags: router({
    list: privateProcedure.query(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      const tags = await ctx.db
        .select()
        .from(contactTag)
        .where(eq(contactTag.userId, userId))
        .orderBy(contactTag.name);

      return { tags };
    }),

    create: privateProcedure
      .input(createTagSchema)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        const tagId = crypto.randomUUID();

        const newTag = await ctx.db
          .insert(contactTag)
          .values({
            id: tagId,
            userId,
            ...input,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        return { tag: newTag[0] };
      }),

    delete: privateProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;

        const deleted = await ctx.db
          .delete(contactTag)
          .where(and(
            eq(contactTag.id, input.id),
            eq(contactTag.userId, userId),
          ))
          .returning();

        return { success: deleted.length > 0 };
      }),
  }),

  // Smart suggestions using vector embeddings
  getSmartSuggestions: activeDriverProcedure
    .input(z.object({ 
      contactId: z.string(),
      contextQuery: z.string().optional().default('What should I do next with this contact?')
    }))
    .query(async ({ ctx, input }) => {
      const { contactId, contextQuery } = input;
      const userId = ctx.session.user.id;
      const connectionId = ctx.activeConnection.id;

      try {
        // Get contact details
        const contactData = await ctx.db
          .select()
          .from(contact)
          .where(and(eq(contact.id, contactId), eq(contact.userId, userId)))
          .limit(1);

        if (!contactData[0]) {
          throw new Error('Contact not found');
        }

        const contactInfo = contactData[0];
        
        // Get recent interactions
        const interactions = await ctx.db
          .select()
          .from(contactInteraction)
          .where(eq(contactInteraction.contactId, contactId))
          .orderBy(desc(contactInteraction.createdAt))
          .limit(5);

        // If no vector search available in development, provide basic suggestions
        if (env.NODE_ENV === 'development') {
          const basicNextAction = determineNextAction(interactions, contactInfo.lastContactedAt);
          
          return {
            suggestions: [
              {
                action: basicNextAction,
                reason: "Based on recent interaction patterns",
                confidence: 0.7,
                type: "basic"
              }
            ],
            contextualInsights: [
              `Contact: ${contactInfo.fullName || contactInfo.email}`,
              `Last contacted: ${contactInfo.lastContactedAt ? new Date(contactInfo.lastContactedAt).toLocaleDateString() : 'Never'}`,
              `Total interactions: ${interactions.length}`
            ]
          };
        }

        // Build context for vector search
        const searchContext = `
          Contact: ${contactInfo.fullName || contactInfo.email}
          Company: ${contactInfo.company || 'N/A'}
          Recent interactions: ${interactions.map(i => 
            `${i.type} ${i.direction || ''} - ${i.subject || ''} (${new Date(i.createdAt).toLocaleDateString()})`
          ).join(', ')}
          Query: ${contextQuery}
        `;

        // Get embedding for context
        const embedding = await getEmbeddingVector(searchContext, 'vectorize-load');
        if (!embedding) {
          // Fallback to basic suggestions
          const basicNextAction = determineNextAction(interactions, contactInfo.lastContactedAt);
          return {
            suggestions: [{
              action: basicNextAction,
              reason: "Vector analysis unavailable, using pattern analysis",
              confidence: 0.6,
              type: "fallback"
            }]
          };
        }

        // Query vector database for similar email interactions
        const vectorResults = await env.VECTORIZE.query(embedding, {
          topK: 3,
          returnMetadata: 'all',
          filter: {
            connection: connectionId,
          },
        });

        // Analyze vector results to generate smart suggestions
        const vectorInsights = vectorResults.matches.map(match => 
          match.metadata?.['content'] as string || ''
        ).filter(Boolean);

        // Use AI to generate contextual suggestions based on email patterns
        let aiSuggestions: any = null;
        try {
          const suggestionPrompt = `
            Based on this contact information and email history patterns, suggest 2-3 specific next actions:
            
            Contact: ${contactInfo.fullName || contactInfo.email}
            Company: ${contactInfo.company || 'N/A'}
            Priority: ${contactInfo.priority}
            Status: ${contactInfo.status}
            
            Recent interactions:
            ${interactions.map(i => `- ${i.type} ${i.direction || ''}: ${i.subject || 'No subject'} (${new Date(i.createdAt).toLocaleDateString()})`).join('\n')}
            
            Similar email patterns from your history:
            ${vectorInsights.slice(0, 2).join('\n\n')}
            
            Provide 2-3 specific, actionable suggestions with reasons. Format as JSON:
            {
              "suggestions": [
                {"action": "specific action", "reason": "why this makes sense", "confidence": 0.8}
              ]
            }
          `;

          const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
            messages: [
              { role: 'system', content: 'You are a CRM assistant that provides specific, actionable next steps for business contacts.' },
              { role: 'user', content: suggestionPrompt }
            ],
          });

          if (aiResponse.response) {
            try {
              aiSuggestions = JSON.parse(aiResponse.response);
            } catch (parseError) {
              console.warn('Failed to parse AI response as JSON:', parseError);
            }
          }
        } catch (aiError) {
          console.warn('AI suggestion generation failed:', aiError);
        }

        // Combine AI suggestions with pattern-based analysis
        const basicNextAction = determineNextAction(interactions, contactInfo.lastContactedAt);
        const suggestions = aiSuggestions?.suggestions || [];
        
        // Add fallback suggestion if AI didn't provide any
        if (suggestions.length === 0) {
          suggestions.push({
            action: basicNextAction,
            reason: "Based on interaction timing and patterns",
            confidence: 0.7,
            type: "pattern-based"
          });
        }

        return {
          suggestions: suggestions.map((s: any) => ({
            ...s,
            type: s.type || "ai-generated"
          })),
          contextualInsights: [
            `${vectorInsights.length} similar email patterns analyzed`,
            `Contact priority: ${contactInfo.priority}`,
            `Days since last contact: ${contactInfo.lastContactedAt ? 
              Math.floor((Date.now() - new Date(contactInfo.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24)) : 'Never contacted'}`,
          ]
        };

      } catch (error) {
        console.error('Smart suggestions failed:', error);
        // Fallback to basic pattern analysis
        const interactions = await ctx.db
          .select()
          .from(contactInteraction)
          .where(eq(contactInteraction.contactId, contactId))
          .orderBy(desc(contactInteraction.createdAt))
          .limit(3);
        
        const contactInfo = await ctx.db
          .select()
          .from(contact)
          .where(and(eq(contact.id, contactId), eq(contact.userId, userId)))
          .limit(1);

        const basicNextAction = determineNextAction(interactions, contactInfo[0]?.lastContactedAt || null);
        
        return {
          suggestions: [{
            action: basicNextAction,
            reason: "Fallback analysis due to vector search error",
            confidence: 0.5,
            type: "fallback"
          }],
          contextualInsights: [`Error occurred, using basic pattern analysis`]
        };
      }
    }),

  // Dashboard/Stats
  stats: privateProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Total contacts
    const totalContacts = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(contact)
      .where(eq(contact.userId, userId));

    // Contacts by status
    const contactsByStatus = await ctx.db
      .select({
        status: contact.status,
        count: sql<number>`count(*)`,
      })
      .from(contact)
      .where(eq(contact.userId, userId))
      .groupBy(contact.status);

    // Recent interactions count
    const recentInteractions = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(contactInteraction)
      .where(and(
        eq(contactInteraction.userId, userId),
        sql`${contactInteraction.createdAt} >= NOW() - INTERVAL '30 days'`,
      ));

    // Contacts that need follow-up (no contact in 30+ days)
    const needsFollowUp = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(contact)
      .where(and(
        eq(contact.userId, userId),
        eq(contact.status, 'active'),
        or(
          sql`${contact.lastContactedAt} IS NULL`,
          sql`${contact.lastContactedAt} <= NOW() - INTERVAL '30 days'`,
        ),
      ));

    return {
      totalContacts: totalContacts[0]?.count || 0,
      contactsByStatus: contactsByStatus || [],
      recentInteractions: recentInteractions[0]?.count || 0,
      needsFollowUp: needsFollowUp[0]?.count || 0,
    };
  }),
});