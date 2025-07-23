import { z } from 'zod';
import { calendarEvent, availabilitySlot, meetingRequest, calendarSync, connection } from '../../db/schema';
import { privateProcedure, publicProcedure, router } from '../trpc';
import { GoogleCalendarService } from '../../services/google-calendar';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { TRPCError } from '@trpc/server';

// Validation schemas
const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isAllDay: z.boolean().default(false),
  timeZone: z.string().default('UTC'),
  attendees: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
  })).optional(),
  recurrence: z.object({
    freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    interval: z.number().default(1),
    count: z.number().optional(),
    until: z.string().datetime().optional(),
    byDay: z.array(z.string()).optional(),
  }).optional(),
  withMeet: z.boolean().default(false),
});

const availabilitySlotSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  duration: z.number().min(15).max(480), // 15 minutes to 8 hours
  dayOfWeek: z.number().min(0).max(6), // 0-6 (Sunday-Saturday)
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  timeZone: z.string().default('UTC'),
  buffer: z.number().min(0).default(0),
  maxBookings: z.number().min(1).default(1),
  isActive: z.boolean().default(true),
  allowWeekends: z.boolean().default(false),
  bookingWindow: z.number().min(1).max(365).default(30),
  meetingType: z.enum(['google-meet', 'phone', 'in-person', 'custom']).default('google-meet'),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    type: z.enum(['text', 'email', 'phone', 'select']),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
  })).optional(),
  autoConfirm: z.boolean().default(true),
});

const meetingRequestSchema = z.object({
  availabilitySlotId: z.string(),
  bookerName: z.string().min(1, "Name is required"),
  bookerEmail: z.string().email("Valid email is required"),
  bookerPhone: z.string().optional(),
  requestedTime: z.string().datetime(),
  message: z.string().optional(),
  responses: z.record(z.string(), z.string()).optional(),
});

export const calendarRouter = router({
  // Check Google Calendar connection status
  getConnectionStatus: privateProcedure
    .query(async ({ ctx }) => {
      const { session, db } = ctx;
      const user = session.user;

      const googleConnection = await db.select()
        .from(connection)
        .where(
          and(
            eq(connection.userId, user.id),
            eq(connection.providerId, 'google')
          )
        )
        .limit(1);

      return {
        hasGoogleConnection: googleConnection.length > 0,
        hasValidToken: googleConnection.length > 0 && !!googleConnection[0].accessToken,
        connectionId: googleConnection[0]?.id || null,
      };
    }),
  // Get user's calendar events for a specific date range
  getEvents: privateProcedure
    .input(z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      includeGoogleEvents: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const user = session?.user;
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Please sign in to access your calendar',
        });
      }

      const events = await db.select()
        .from(calendarEvent)
        .where(
          and(
            eq(calendarEvent.userId, user.id),
            gte(calendarEvent.startTime, new Date(input.startDate)),
            lte(calendarEvent.endTime, new Date(input.endDate))
          )
        )
        .orderBy(calendarEvent.startTime);

      // If user wants Google events and is connected
      if (input.includeGoogleEvents) {
        try {
          const googleConnection = await db.select()
            .from(connection)
            .where(
              and(
                eq(connection.userId, user.id),
                eq(connection.providerId, 'google')
              )
            )
            .limit(1);

          if (googleConnection.length === 0) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'Google Calendar not connected. Please connect your Google account to sync calendar events.',
            });
          }

          if (!googleConnection[0].accessToken) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Google Calendar access expired. Please reconnect your Google account.',
            });
          }

          if (googleConnection.length > 0 && googleConnection[0].accessToken) {
            const calendarService = new GoogleCalendarService(
              googleConnection[0].accessToken,
              googleConnection[0].refreshToken || undefined
            );

            const googleEvents = await calendarService.getEvents('primary', {
              timeMin: input.startDate,
              timeMax: input.endDate,
            });

            // Merge Google events with local events (avoiding duplicates)
            const allEvents = [...events];
            for (const gEvent of googleEvents.events) {
              const existsLocally = events.some(e => e.googleEventId === gEvent.id);
              if (!existsLocally) {
                allEvents.push({
                  id: `google-${gEvent.id}`,
                  userId: user.id,
                  googleEventId: gEvent.id || null,
                  calendarId: 'primary',
                  title: gEvent.summary,
                  description: gEvent.description || null,
                  location: gEvent.location || null,
                  startTime: new Date(gEvent.start.dateTime || gEvent.start.date || ''),
                  endTime: new Date(gEvent.end.dateTime || gEvent.end.date || ''),
                  isAllDay: Boolean(gEvent.start.date),
                  timeZone: gEvent.start.timeZone || 'UTC',
                  source: 'google' as const,
                  meetingLink: gEvent.conferenceData?.entryPoints?.[0]?.uri || null,
                  attendees: gEvent.attendees || null,
                  recurrence: gEvent.recurrence || null,
                  status: gEvent.status || 'confirmed',
                  visibility: 'private' as const,
                  lastSyncAt: new Date(),
                  metadata: gEvent,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }
            }

            return allEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
          }
        } catch (error) {
          console.error('Error fetching Google Calendar events:', error);
          // If it's an auth error, clear the invalid tokens and throw specific error
          if (error instanceof Error && (
            error.message.includes('invalid_grant') || 
            error.message.includes('unauthorized') ||
            error.message.includes('Could not determine client ID') ||
            error.message.includes('invalid_request')
          )) {
            // Clear invalid tokens from database
            await db.update(connection)
              .set({ 
                accessToken: null, 
                refreshToken: null,
                updatedAt: new Date()
              })
              .where(
                and(
                  eq(connection.userId, user.id),
                  eq(connection.providerId, 'google')
                )
              );
            
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Google Calendar access expired. Please reconnect your Google account.',
            });
          }
        }
      }

      return events;
    }),

  // Create a new calendar event
  createEvent: privateProcedure
    .input(eventSchema)
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const user = session.user;

      // Create event locally first
      const eventId = nanoid();
      let meetingLink: string | null = null;

      try {
        // Get Google connection for potential Google Calendar sync
        const googleConnection = await db.select()
          .from(connection)
          .where(
            and(
              eq(connection.userId, user.id),
              eq(connection.providerId, 'google')
            )
          )
          .limit(1);

        let googleEventId: string | null = null;

        if (googleConnection.length > 0 && googleConnection[0].accessToken) {
          const calendarService = new GoogleCalendarService(
            googleConnection[0].accessToken,
            googleConnection[0].refreshToken || undefined
          );

          // Create event in Google Calendar with optional Google Meet
          const googleEvent = await calendarService.createEvent('primary', {
            summary: input.title,
            description: input.description,
            location: input.location,
            start: {
              dateTime: input.isAllDay ? undefined : input.startTime,
              date: input.isAllDay ? input.startTime.split('T')[0] : undefined,
              timeZone: input.timeZone,
            },
            end: {
              dateTime: input.isAllDay ? undefined : input.endTime,
              date: input.isAllDay ? input.endTime.split('T')[0] : undefined,
              timeZone: input.timeZone,
            },
            attendees: input.attendees,
            recurrence: input.recurrence ? [`RRULE:FREQ=${input.recurrence.freq};INTERVAL=${input.recurrence.interval}${input.recurrence.count ? `;COUNT=${input.recurrence.count}` : ''}${input.recurrence.until ? `;UNTIL=${input.recurrence.until.replace(/[:-]/g, '').replace(/\.\d{3}/, '')}` : ''}${input.recurrence.byDay ? `;BYDAY=${input.recurrence.byDay.join(',')}` : ''}`] : undefined,
          }, input.withMeet || false);

          googleEventId = googleEvent.id || null;
          meetingLink = googleEvent.conferenceData?.entryPoints?.[0]?.uri || null;
        }

        // Save to local database
        const [newEvent] = await db.insert(calendarEvent).values({
          id: eventId,
          userId: user.id,
          googleEventId,
          calendarId: 'primary',
          title: input.title,
          description: input.description,
          location: input.location,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
          isAllDay: input.isAllDay,
          timeZone: input.timeZone,
          source: googleEventId ? 'google' : 'zero',
          meetingLink,
          attendees: input.attendees || null,
          recurrence: input.recurrence || null,
          status: 'confirmed',
          visibility: 'private',
          lastSyncAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();

        return newEvent;
      } catch (error) {
        console.error('Error creating calendar event:', error);
        if (error instanceof TRPCError) {
          throw error;
        }
        if (error instanceof Error && (
          error.message.includes('invalid_grant') || 
          error.message.includes('unauthorized') ||
          error.message.includes('Could not determine client ID') ||
          error.message.includes('invalid_request')
        )) {
          // Clear invalid tokens from database
          await db.update(connection)
            .set({ 
              accessToken: null, 
              refreshToken: null,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(connection.userId, user.id),
                eq(connection.providerId, 'google')
              )
            );
          
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Google Calendar access expired. Please reconnect your Google account.',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create calendar event',
        });
      }
    }),

  // Update an existing calendar event
  updateEvent: privateProcedure
    .input(z.object({
      eventId: z.string(),
      ...eventSchema.partial().shape,
    }))
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const user = session.user;

      const { eventId, ...updateData } = input;

      // Get existing event
      const [existingEvent] = await db.select()
        .from(calendarEvent)
        .where(
          and(
            eq(calendarEvent.id, eventId),
            eq(calendarEvent.userId, user.id)
          )
        )
        .limit(1);

      if (!existingEvent) throw new Error('Event not found');

      try {
        // Update in Google Calendar if it exists there
        if (existingEvent.googleEventId) {
          const googleConnection = await db.select()
            .from(connection)
            .where(
              and(
                eq(connection.userId, user.id),
                eq(connection.providerId, 'google')
              )
            )
            .limit(1);

          if (googleConnection.length > 0 && googleConnection[0].accessToken) {
            const calendarService = new GoogleCalendarService(
              googleConnection[0].accessToken,
              googleConnection[0].refreshToken || undefined
            );

            await calendarService.updateEvent('primary', existingEvent.googleEventId, {
              summary: updateData.title,
              description: updateData.description,
              location: updateData.location,
              start: updateData.startTime ? {
                dateTime: updateData.isAllDay ? undefined : updateData.startTime,
                date: updateData.isAllDay ? updateData.startTime.split('T')[0] : undefined,
                timeZone: updateData.timeZone,
              } : undefined,
              end: updateData.endTime ? {
                dateTime: updateData.isAllDay ? undefined : updateData.endTime,
                date: updateData.isAllDay ? updateData.endTime.split('T')[0] : undefined,
                timeZone: updateData.timeZone,
              } : undefined,
              attendees: updateData.attendees,
            }, updateData.withMeet);
          }
        }

        // Update in local database
        const [updatedEvent] = await db.update(calendarEvent)
          .set({
            ...(updateData.title && { title: updateData.title }),
            ...(updateData.description !== undefined && { description: updateData.description }),
            ...(updateData.location !== undefined && { location: updateData.location }),
            ...(updateData.startTime && { startTime: new Date(updateData.startTime) }),
            ...(updateData.endTime && { endTime: new Date(updateData.endTime) }),
            ...(updateData.isAllDay !== undefined && { isAllDay: updateData.isAllDay }),
            ...(updateData.timeZone && { timeZone: updateData.timeZone }),
            ...(updateData.attendees !== undefined && { attendees: updateData.attendees }),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(calendarEvent.id, eventId),
              eq(calendarEvent.userId, user.id)
            )
          )
          .returning();

        return updatedEvent;
      } catch (error) {
        console.error('Error updating calendar event:', error);
        if (error instanceof TRPCError) {
          throw error;
        }
        if (error instanceof Error && (
          error.message.includes('invalid_grant') || 
          error.message.includes('unauthorized') ||
          error.message.includes('Could not determine client ID') ||
          error.message.includes('invalid_request')
        )) {
          // Clear invalid tokens from database
          await db.update(connection)
            .set({ 
              accessToken: null, 
              refreshToken: null,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(connection.userId, user.id),
                eq(connection.providerId, 'google')
              )
            );
          
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Google Calendar access expired. Please reconnect your Google account.',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update calendar event',
        });
      }
    }),

  // Delete a calendar event
  deleteEvent: privateProcedure
    .input(z.object({
      eventId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const user = session.user;

      // Get existing event
      const [existingEvent] = await db.select()
        .from(calendarEvent)
        .where(
          and(
            eq(calendarEvent.id, input.eventId),
            eq(calendarEvent.userId, user.id)
          )
        )
        .limit(1);

      if (!existingEvent) throw new Error('Event not found');

      try {
        // Delete from Google Calendar if it exists there
        if (existingEvent.googleEventId) {
          const googleConnection = await db.select()
            .from(connection)
            .where(
              and(
                eq(connection.userId, user.id),
                eq(connection.providerId, 'google')
              )
            )
            .limit(1);

          if (googleConnection.length > 0 && googleConnection[0].accessToken) {
            const calendarService = new GoogleCalendarService(
              googleConnection[0].accessToken,
              googleConnection[0].refreshToken || undefined
            );

            await calendarService.deleteEvent('primary', existingEvent.googleEventId);
          }
        }

        // Delete from local database
        await db.delete(calendarEvent)
          .where(
            and(
              eq(calendarEvent.id, input.eventId),
              eq(calendarEvent.userId, user.id)
            )
          );

        return { success: true };
      } catch (error) {
        console.error('Error deleting calendar event:', error);
        if (error instanceof TRPCError) {
          throw error;
        }
        if (error instanceof Error && (
          error.message.includes('invalid_grant') || 
          error.message.includes('unauthorized') ||
          error.message.includes('Could not determine client ID') ||
          error.message.includes('invalid_request')
        )) {
          // Clear invalid tokens from database
          await db.update(connection)
            .set({ 
              accessToken: null, 
              refreshToken: null,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(connection.userId, user.id),
                eq(connection.providerId, 'google')
              )
            );
          
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Google Calendar access expired. Please reconnect your Google account.',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete calendar event',
        });
      }
    }),

  // Availability slots management
  getAvailabilitySlots: privateProcedure
    .query(async ({ ctx }) => {
      const { session, db } = ctx;
      const user = session.user;

      return await db.select()
        .from(availabilitySlot)
        .where(eq(availabilitySlot.userId, user.id))
        .orderBy(availabilitySlot.dayOfWeek, availabilitySlot.startTime);
    }),

  createAvailabilitySlot: privateProcedure
    .input(availabilitySlotSchema)
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const user = session.user;

      const [newSlot] = await db.insert(availabilitySlot).values({
        id: nanoid(),
        userId: user.id,
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return newSlot;
    }),

  updateAvailabilitySlot: privateProcedure
    .input(z.object({
      slotId: z.string(),
      ...availabilitySlotSchema.partial().shape,
    }))
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const user = session.user;

      const { slotId, ...updateData } = input;

      const [updatedSlot] = await db.update(availabilitySlot)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(availabilitySlot.id, slotId),
            eq(availabilitySlot.userId, user.id)
          )
        )
        .returning();

      return updatedSlot;
    }),

  deleteAvailabilitySlot: privateProcedure
    .input(z.object({
      slotId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const user = session.user;

      await db.delete(availabilitySlot)
        .where(
          and(
            eq(availabilitySlot.id, input.slotId),
            eq(availabilitySlot.userId, user.id)
          )
        );

      return { success: true };
    }),

  // Meeting requests (public booking)
  getMeetingRequests: privateProcedure
    .query(async ({ ctx }) => {
      const { session, db } = ctx;
      const user = session.user;

      return await db.select()
        .from(meetingRequest)
        .where(eq(meetingRequest.userId, user.id))
        .orderBy(desc(meetingRequest.createdAt));
    }),

  // Public endpoint for booking (no auth required)
  submitMeetingRequest: publicProcedure
    .input(meetingRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      // Validate availability slot exists and is active
      const [slot] = await db.select()
        .from(availabilitySlot)
        .where(
          and(
            eq(availabilitySlot.id, input.availabilitySlotId),
            eq(availabilitySlot.isActive, true)
          )
        )
        .limit(1);

      if (!slot) throw new Error('Availability slot not found or inactive');

      // Create meeting request
      const [request] = await db.insert(meetingRequest).values({
        id: nanoid(),
        userId: slot.userId,
        availabilitySlotId: input.availabilitySlotId,
        bookerName: input.bookerName,
        bookerEmail: input.bookerEmail,
        bookerPhone: input.bookerPhone,
        requestedTime: new Date(input.requestedTime),
        duration: slot.duration,
        timeZone: slot.timeZone,
        message: input.message,
        responses: input.responses,
        status: slot.autoConfirm ? 'confirmed' : 'pending',
        createdAt: new Date(),
        confirmedAt: slot.autoConfirm ? new Date() : null,
      }).returning();

      // If auto-confirm is enabled, create the calendar event
      if (slot.autoConfirm) {
        // This would trigger event creation - simplified for now
        // TODO: Implement auto event creation with Google Calendar integration
      }

      return request;
    }),

  confirmMeetingRequest: privateProcedure
    .input(z.object({
      requestId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const user = session.user;

      const [request] = await db.select()
        .from(meetingRequest)
        .where(
          and(
            eq(meetingRequest.id, input.requestId),
            eq(meetingRequest.userId, user.id)
          )
        )
        .limit(1);

      if (!request) throw new Error('Meeting request not found');

      // Update request status
      const [updatedRequest] = await db.update(meetingRequest)
        .set({
          status: 'confirmed',
          confirmedAt: new Date(),
        })
        .where(eq(meetingRequest.id, input.requestId))
        .returning();

      // TODO: Create calendar event and send confirmation emails

      return updatedRequest;
    }),

  // Sync with Google Calendar
  syncGoogleCalendar: privateProcedure
    .mutation(async ({ ctx }) => {
      const { session, db } = ctx;
      const user = session.user;

      const googleConnection = await db.select()
        .from(connection)
        .where(
          and(
            eq(connection.userId, user.id),
            eq(connection.providerId, 'google')
          )
        )
        .limit(1);

      if (!googleConnection.length || !googleConnection[0].accessToken) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Google Calendar not connected. Please connect your Google account to sync calendar events.',
        });
      }

      try {
        const calendarService = new GoogleCalendarService(
          googleConnection[0].accessToken,
          googleConnection[0].refreshToken || undefined
        );

        // Get or create sync record
        let [syncRecord] = await db.select()
          .from(calendarSync)
          .where(eq(calendarSync.userId, user.id))
          .limit(1);

        if (!syncRecord) {
          [syncRecord] = await db.insert(calendarSync).values({
            id: nanoid(),
            userId: user.id,
            googleCalendarId: 'primary',
            syncStatus: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();
        }

        // Perform sync
        const syncResult = await calendarService.syncCalendarEvents(
          'primary',
          syncRecord.syncToken || undefined,
          syncRecord.lastSyncAt?.toISOString()
        );

        // Update sync record
        await db.update(calendarSync)
          .set({
            syncToken: syncResult.nextSyncToken,
            lastSyncAt: new Date(),
            syncStatus: 'active',
            syncError: null,
            updatedAt: new Date(),
          })
          .where(eq(calendarSync.id, syncRecord.id));

        return {
          eventsCount: syncResult.events.length,
          deletedCount: syncResult.deleted?.length || 0,
        };
      } catch (error) {
        console.error('Error syncing Google Calendar:', error);
        if (error instanceof TRPCError) {
          throw error;
        }
        if (error instanceof Error && (
          error.message.includes('invalid_grant') || 
          error.message.includes('unauthorized') ||
          error.message.includes('Could not determine client ID') ||
          error.message.includes('invalid_request')
        )) {
          // Clear invalid tokens from database
          await db.update(connection)
            .set({ 
              accessToken: null, 
              refreshToken: null,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(connection.userId, user.id),
                eq(connection.providerId, 'google')
              )
            );
          
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Google Calendar access expired. Please reconnect your Google account.',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sync Google Calendar',
        });
      }
    }),
});