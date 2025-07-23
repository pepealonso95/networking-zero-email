import { privateProcedure, router } from '../trpc';
import { lead, leadSearch, contact, contactInteraction, userSettings } from '../../db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { LeadGenerationService } from '../../services/lead-generation-apis';
import { LeadAIProcessor } from '../../services/lead-ai-processor';

// Input schemas
const processPromptSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
});

const searchLeadsSchema = z.object({
  prompt: z.string().min(1),
  limit: z.number().min(1).max(50).default(10),
});

const addToContactsSchema = z.object({
  leadIds: z.array(z.string()),
});

const updateLeadSchema = z.object({
  leadId: z.string(),
  data: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    company: z.string().optional(),
    jobTitle: z.string().optional(),
    linkedinUrl: z.string().url().optional(),
    phoneNumber: z.string().optional(),
    location: z.string().optional(),
  }),
});

export const leadsRouter = router({
  // Process user prompt with AI
  processPrompt: privateProcedure
    .input(processPromptSchema)
    .mutation(async ({ ctx, input }) => {
      const { session } = ctx;
      const aiProcessor = new LeadAIProcessor();
      
      try {
        const processedPrompt = await aiProcessor.processPrompt(input.prompt);
        return {
          success: true,
          data: processedPrompt,
        };
      } catch (error) {
        console.error('Prompt processing failed:', error);
        return {
          success: false,
          error: 'Failed to process prompt. Please try again.',
        };
      }
    }),

  // Search for leads
  searchLeads: privateProcedure
    .input(searchLeadsSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const userId = session.user.id;

      try {
        // Get user's API keys from settings
        const [userSettingsData] = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, userId))
          .limit(1);

        const leadGenSettings = userSettingsData?.settings?.leadGeneration;
        
        if (!leadGenSettings?.hunterApiKey && 
            !leadGenSettings?.apolloApiKey && 
            !leadGenSettings?.snovApiKey && 
            !leadGenSettings?.pdlApiKey && 
            !leadGenSettings?.linkedinSalesNavCookie && 
            !leadGenSettings?.linkedinAlternativeApiKey) {
          return {
            success: false,
            error: 'No API keys configured. Please add your lead generation API keys in settings.',
          };
        }

        // Process the prompt with AI
        const aiProcessor = new LeadAIProcessor();
        const processedPrompt = await aiProcessor.processPrompt(input.prompt);

        // Create lead search record
        const searchId = crypto.randomUUID();
        await db.insert(leadSearch).values({
          id: searchId,
          userId,
          originalPrompt: input.prompt,
          processedCriteria: processedPrompt.criteria,
          status: 'processing',
          createdAt: new Date(),
        });

        // Initialize lead generation service
        const leadService = new LeadGenerationService({
          hunterApiKey: leadGenSettings.hunterApiKey,
          apolloApiKey: leadGenSettings.apolloApiKey,
          snovApiKey: leadGenSettings.snovApiKey,
          pdlApiKey: leadGenSettings.pdlApiKey,
          linkedinSalesNavCookie: leadGenSettings.linkedinSalesNavCookie,
          linkedinAlternativeApiKey: leadGenSettings.linkedinAlternativeApiKey,
          linkedinAlternativeProvider: leadGenSettings.linkedinAlternativeProvider,
        });

        // Use AI-powered search for PDL API to get more varied and accurate results
        let searchResult;
        if (leadGenSettings.pdlApiKey) {
          try {
            // Use AI-powered search directly with the original prompt for better variety
            const aiModel = aiProcessor.getAIModel();
            searchResult = await leadService.searchLeadsWithAI(input.prompt, aiModel);
          } catch (pdlError: any) {
            console.log('PDL AI search failed, falling back to structured search:', pdlError.message);
            // Fallback to structured search if PDL fails (quota exceeded, etc.)
            searchResult = await leadService.searchLeads(processedPrompt.criteria);
          }
        } else {
          // Fallback to structured search for other APIs
          searchResult = await leadService.searchLeads(processedPrompt.criteria);
        }

        const { leads, usage, reasoning } = searchResult;

        // Save leads to database
        const savedLeads = [];
        for (const leadData of leads) {
          const leadId = crypto.randomUUID();
          
          const [savedLead] = await db.insert(lead).values({
            id: leadId,
            userId,
            email: leadData.email,
            firstName: leadData.firstName,
            lastName: leadData.lastName,
            fullName: leadData.fullName,
            company: leadData.company,
            jobTitle: leadData.jobTitle,
            linkedinUrl: leadData.linkedinUrl,
            phoneNumber: leadData.phoneNumber,
            location: leadData.location,
            source: leadData.source,
            confidence: leadData.confidence,
            verified: leadData.verified,
            countryOfOrigin: leadData.countryOfOrigin,
            educationHistory: leadData.educationHistory,
            workHistory: leadData.workHistory,
            inferredOrigin: leadData.inferredOrigin,
            metadata: leadData.metadata,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();
          
          savedLeads.push(savedLead);
        }

        // Update search record with results
        await db.update(leadSearch)
          .set({
            resultsCount: leads.length,
            apiUsage: usage,
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(leadSearch.id, searchId));

        return {
          success: true,
          data: {
            searchId,
            leads: savedLeads,
            usage,
            processedCriteria: processedPrompt.criteria,
            explanation: reasoning || processedPrompt.explanation,
            suggestions: processedPrompt.suggestions,
            confidence: processedPrompt.confidence,
          },
        };
      } catch (error) {
        console.error('Lead search failed:', error);
        
        // Update search record with error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const searchResults = await db.select().from(leadSearch)
          .where(and(eq(leadSearch.userId, userId), eq(leadSearch.originalPrompt, input.prompt)))
          .orderBy(desc(leadSearch.createdAt))
          .limit(1);
          
        if (searchResults.length > 0) {
          await db.update(leadSearch)
            .set({
              status: 'failed',
              error: errorMessage,
              completedAt: new Date(),
            })
            .where(eq(leadSearch.id, searchResults[0].id));
        }

        return {
          success: false,
          error: `Search failed: ${errorMessage}`,
        };
      }
    }),

  // Get user's leads
  getLeads: privateProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      source: z.enum(['hunter', 'apollo', 'snov', 'pdl', 'linkedin_official', 'linkedin_sales_nav', 'linkedin_scraping', 'linkedin_alternative']).optional(),
      addedToCrm: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const userId = session.user.id;
      const { limit, offset, source, addedToCrm } = input;

      let whereConditions = [eq(lead.userId, userId)];
      
      if (source) {
        whereConditions.push(eq(lead.source, source));
      }
      
      if (addedToCrm !== undefined) {
        whereConditions.push(eq(lead.addedToCrm, addedToCrm));
      }

      const leads = await db
        .select()
        .from(lead)
        .where(and(...whereConditions))
        .orderBy(desc(lead.createdAt))
        .limit(limit)
        .offset(offset);

      const total = await db
        .select({ count: sql<number>`count(*)` })
        .from(lead)
        .where(and(...whereConditions));

      return {
        leads,
        total: total[0]?.count || 0,
        hasMore: (offset + limit) < (total[0]?.count || 0),
      };
    }),

  // Get search history
  getSearchHistory: privateProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const userId = session.user.id;

      const searches = await db
        .select()
        .from(leadSearch)
        .where(eq(leadSearch.userId, userId))
        .orderBy(desc(leadSearch.createdAt))
        .limit(input.limit);

      return { searches };
    }),

  // Add leads to CRM contacts
  addToContacts: privateProcedure
    .input(addToContactsSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const userId = session.user.id;

      try {
        const results = [];

        for (const leadId of input.leadIds) {
          // Get lead data
          const [leadData] = await db
            .select()
            .from(lead)
            .where(and(eq(lead.id, leadId), eq(lead.userId, userId)))
            .limit(1);

          if (!leadData) {
            results.push({ leadId, success: false, error: 'Lead not found' });
            continue;
          }

          // Check if contact with this email already exists
          const [existingContact] = await db
            .select()
            .from(contact)
            .where(and(eq(contact.email, leadData.email), eq(contact.userId, userId)))
            .limit(1);

          let contactId: string;

          if (existingContact) {
            // Update existing contact with lead data
            contactId = existingContact.id;
            await db.update(contact)
              .set({
                firstName: leadData.firstName || existingContact.firstName,
                lastName: leadData.lastName || existingContact.lastName,
                fullName: leadData.fullName || existingContact.fullName,
                company: leadData.company || existingContact.company,
                jobTitle: leadData.jobTitle || existingContact.jobTitle,
                phone: leadData.phoneNumber || existingContact.phone,
                linkedinUrl: leadData.linkedinUrl || existingContact.linkedinUrl,
                notes: `Lead imported from ${leadData.source}. ${existingContact.notes || ''}`.trim(),
                updatedAt: new Date(),
              })
              .where(eq(contact.id, contactId));
          } else {
            // Create new contact
            contactId = crypto.randomUUID();
            await db.insert(contact).values({
              id: contactId,
              userId,
              email: leadData.email,
              firstName: leadData.firstName,
              lastName: leadData.lastName,
              fullName: leadData.fullName || `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim(),
              company: leadData.company,
              jobTitle: leadData.jobTitle,
              phone: leadData.phoneNumber,
              linkedinUrl: leadData.linkedinUrl,
              notes: `Lead imported from ${leadData.source}`,
              priority: 'medium',
              status: 'active',
              leadSource: `Lead Generation (${leadData.source})`,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Create interaction record
          const interactionId = crypto.randomUUID();
          await db.insert(contactInteraction).values({
            id: interactionId,
            contactId,
            userId,
            type: 'note',
            subject: 'Lead Added to CRM',
            content: `Lead imported from ${leadData.source} with ${leadData.confidence || 'unknown'}% confidence${leadData.verified ? ' (email verified)' : ''}`,
            metadata: {
              leadId: leadData.id,
              source: leadData.source,
              originalPrompt: 'Lead generation import',
              confidence: leadData.confidence,
              verified: leadData.verified,
            },
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Update lead to mark as added to CRM
          await db.update(lead)
            .set({
              addedToCrm: true,
              contactId: contactId,
              updatedAt: new Date(),
            })
            .where(eq(lead.id, leadId));

          results.push({ leadId, success: true, contactId });
        }

        return { success: true, results };
      } catch (error) {
        console.error('Failed to add leads to contacts:', error);
        return {
          success: false,
          error: 'Failed to add leads to CRM. Please try again.',
        };
      }
    }),

  // Update lead information
  updateLead: privateProcedure
    .input(updateLeadSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const userId = session.user.id;

      try {
        const [updatedLead] = await db
          .update(lead)
          .set({
            ...input.data,
            fullName: input.data.firstName || input.data.lastName 
              ? `${input.data.firstName || ''} ${input.data.lastName || ''}`.trim()
              : undefined,
            updatedAt: new Date(),
          })
          .where(and(eq(lead.id, input.leadId), eq(lead.userId, userId)))
          .returning();

        if (!updatedLead) {
          return { success: false, error: 'Lead not found' };
        }

        return { success: true, data: updatedLead };
      } catch (error) {
        console.error('Failed to update lead:', error);
        return { success: false, error: 'Failed to update lead' };
      }
    }),

  // Delete leads
  deleteLeads: privateProcedure
    .input(z.object({
      leadIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const userId = session.user.id;

      try {
        const deleted = await db
          .delete(lead)
          .where(and(
            eq(lead.userId, userId),
            sql`${lead.id} = ANY(${input.leadIds})`
          ))
          .returning();

        return { 
          success: true, 
          deletedCount: deleted.length,
        };
      } catch (error) {
        console.error('Failed to delete leads:', error);
        return { success: false, error: 'Failed to delete leads' };
      }
    }),

  // Get lead statistics
  getStats: privateProcedure
    .query(async ({ ctx }) => {
      const { db, session } = ctx;
      const userId = session.user.id;

      const totalLeads = await db
        .select({ count: sql<number>`count(*)` })
        .from(lead)
        .where(eq(lead.userId, userId));

      const leadsBySource = await db
        .select({
          source: lead.source,
          count: sql<number>`count(*)`,
        })
        .from(lead)
        .where(eq(lead.userId, userId))
        .groupBy(lead.source);

      const recentSearches = await db
        .select({ count: sql<number>`count(*)` })
        .from(leadSearch)
        .where(and(
          eq(leadSearch.userId, userId),
          sql`${leadSearch.createdAt} >= NOW() - INTERVAL '7 days'`
        ));

      const addedToCrm = await db
        .select({ count: sql<number>`count(*)` })
        .from(lead)
        .where(and(eq(lead.userId, userId), eq(lead.addedToCrm, true)));

      return {
        totalLeads: totalLeads[0]?.count || 0,
        leadsBySource: leadsBySource || [],
        recentSearches: recentSearches[0]?.count || 0,
        addedToCrm: addedToCrm[0]?.count || 0,
      };
    }),
});