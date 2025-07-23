import { calendar } from '@googleapis/calendar';
import { OAuth2Client } from 'google-auth-library';
import type { calendar_v3 } from '@googleapis/calendar';
import { env } from 'cloudflare:workers';

export interface GoogleCalendarEvent {
  id?: string;
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  recurrence?: string[];
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: {
        type: 'hangoutsMeet';
      };
    };
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'default' | 'public' | 'private';
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: string;
  timeZone?: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

export interface SyncOptions {
  syncToken?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

export class GoogleCalendarService {
  private calendarApi: calendar_v3.Calendar;

  constructor(accessToken: string, refreshToken?: string) {
    const oauth2Client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.calendarApi = calendar({
      version: 'v3',
      auth: oauth2Client,
    });
  }

  async getCalendarList(): Promise<CalendarListEntry[]> {
    try {
      const response = await this.calendarApi.calendarList.list();
      return response.data.items?.map(item => ({
        id: item.id!,
        summary: item.summary!,
        description: item.description,
        primary: item.primary,
        accessRole: item.accessRole!,
        timeZone: item.timeZone,
        backgroundColor: item.backgroundColor,
        foregroundColor: item.foregroundColor,
      })) || [];
    } catch (error) {
      console.error('Error fetching calendar list:', error);
      throw new Error('Failed to fetch calendar list');
    }
  }

  async getEvents(calendarId: string = 'primary', options: SyncOptions = {}): Promise<{
    events: GoogleCalendarEvent[];
    nextSyncToken?: string;
  }> {
    try {
      const params: any = {
        calendarId,
        singleEvents: true,
        orderBy: 'startTime',
        ...options,
      };

      const response = await this.calendarApi.events.list(params);
      
      const events = response.data.items?.map(this.transformGoogleEvent) || [];
      
      return {
        events,
        nextSyncToken: response.data.nextSyncToken,
      };
    } catch (error) {
      console.error('Error fetching events:', error);
      throw new Error('Failed to fetch events');
    }
  }

  async createEvent(
    calendarId: string = 'primary',
    event: GoogleCalendarEvent,
    withMeet: boolean = false
  ): Promise<GoogleCalendarEvent> {
    try {
      const eventData: calendar_v3.Schema$Event = {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        recurrence: event.recurrence,
        status: event.status,
        visibility: event.visibility,
      };

      if (withMeet) {
        eventData.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        };
      }

      const response = await this.calendarApi.events.insert({
        calendarId,
        resource: eventData,
        conferenceDataVersion: withMeet ? 1 : 0,
        sendUpdates: 'all',
      });

      return this.transformGoogleEvent(response.data);
    } catch (error) {
      console.error('Error creating event:', error);
      throw new Error('Failed to create event');
    }
  }

  async updateEvent(
    calendarId: string = 'primary',
    eventId: string,
    event: Partial<GoogleCalendarEvent>,
    withMeet: boolean = false
  ): Promise<GoogleCalendarEvent> {
    try {
      const eventData: calendar_v3.Schema$Event = {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        recurrence: event.recurrence,
        status: event.status,
        visibility: event.visibility,
      };

      if (withMeet && !event.conferenceData) {
        eventData.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        };
      }

      const response = await this.calendarApi.events.update({
        calendarId,
        eventId,
        resource: eventData,
        conferenceDataVersion: withMeet ? 1 : 0,
        sendUpdates: 'all',
      });

      return this.transformGoogleEvent(response.data);
    } catch (error) {
      console.error('Error updating event:', error);
      throw new Error('Failed to update event');
    }
  }

  async deleteEvent(
    calendarId: string = 'primary',
    eventId: string
  ): Promise<void> {
    try {
      await this.calendarApi.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'all',
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      throw new Error('Failed to delete event');
    }
  }

  async getEvent(
    calendarId: string = 'primary',
    eventId: string
  ): Promise<GoogleCalendarEvent> {
    try {
      const response = await this.calendarApi.events.get({
        calendarId,
        eventId,
      });

      return this.transformGoogleEvent(response.data);
    } catch (error) {
      console.error('Error fetching event:', error);
      throw new Error('Failed to fetch event');
    }
  }

  async syncCalendarEvents(
    calendarId: string = 'primary',
    syncToken?: string,
    timeMin?: string,
    timeMax?: string
  ): Promise<{
    events: GoogleCalendarEvent[];
    nextSyncToken?: string;
    deleted?: string[];
  }> {
    try {
      const params: any = {
        calendarId,
        singleEvents: true,
        showDeleted: true,
      };

      if (syncToken) {
        params.syncToken = syncToken;
      } else {
        params.timeMin = timeMin || new Date().toISOString();
        if (timeMax) {
          params.timeMax = timeMax;
        }
      }

      const response = await this.calendarApi.events.list(params);
      
      const events: GoogleCalendarEvent[] = [];
      const deleted: string[] = [];

      response.data.items?.forEach(item => {
        if (item.status === 'cancelled') {
          if (item.id) deleted.push(item.id);
        } else {
          events.push(this.transformGoogleEvent(item));
        }
      });

      return {
        events,
        nextSyncToken: response.data.nextSyncToken,
        deleted,
      };
    } catch (error) {
      console.error('Error syncing calendar events:', error);
      throw new Error('Failed to sync calendar events');
    }
  }

  private transformGoogleEvent(googleEvent: calendar_v3.Schema$Event): GoogleCalendarEvent {
    return {
      id: googleEvent.id,
      summary: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description,
      location: googleEvent.location,
      start: {
        dateTime: googleEvent.start?.dateTime,
        date: googleEvent.start?.date,
        timeZone: googleEvent.start?.timeZone,
      },
      end: {
        dateTime: googleEvent.end?.dateTime,
        date: googleEvent.end?.date,
        timeZone: googleEvent.end?.timeZone,
      },
      attendees: googleEvent.attendees?.map(attendee => ({
        email: attendee.email!,
        displayName: attendee.displayName,
        responseStatus: attendee.responseStatus as any,
      })),
      recurrence: googleEvent.recurrence,
      conferenceData: googleEvent.conferenceData as any,
      status: googleEvent.status as any,
      visibility: googleEvent.visibility as any,
    };
  }
}