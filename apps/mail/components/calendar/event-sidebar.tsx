'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Edit, Trash2, Video, MapPin, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface EventSidebarProps {
  eventId: string;
  onClose: () => void;
  onEventUpdate: () => void;
}

export function EventSidebar({ eventId, onClose, onEventUpdate }: EventSidebarProps) {
  const [event, setEvent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch event details
    // For now, using mock data
    setEvent({
      id: eventId,
      title: 'Team Meeting',
      description: 'Weekly team sync to discuss project progress and upcoming milestones.',
      startTime: new Date(),
      endTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
      location: 'Conference Room A',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      attendees: [
        { email: 'john@example.com', name: 'John Doe', status: 'accepted' },
        { email: 'jane@example.com', name: 'Jane Smith', status: 'tentative' },
      ],
      source: 'google',
      status: 'confirmed',
    });
    setIsLoading(false);
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="w-80 border-l bg-background p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-20 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="w-80 border-l bg-background p-4">
        <div className="text-center text-muted-foreground">
          Event not found
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    // TODO: Implement delete functionality
    console.log('Delete event:', eventId);
    onEventUpdate();
    onClose();
  };

  return (
    <div className="w-80 border-l bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Event Details</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Title and source */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{event.title}</h2>
          <Badge variant="outline">{event.source}</Badge>
        </div>

        {/* Time */}
        <div className="flex items-start gap-3">
          <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="text-sm">
            <div>{format(new Date(event.startTime), 'EEEE, MMMM d, yyyy')}</div>
            <div className="text-muted-foreground">
              {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
            </div>
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="text-sm">{event.location}</div>
          </div>
        )}

        {/* Meeting link */}
        {event.meetingLink && (
          <div className="flex items-start gap-3">
            <Video className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="text-sm">
              <a
                href={event.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Join meeting
              </a>
            </div>
          </div>
        )}

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Attendees ({event.attendees.length})
            </div>
            <div className="space-y-2">
              {event.attendees.map((attendee: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div>
                    <div>{attendee.name || attendee.email}</div>
                    {attendee.name && (
                      <div className="text-xs text-muted-foreground">{attendee.email}</div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {attendee.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Description */}
        {event.description && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Description</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t p-4 space-y-2">
        <Button className="w-full gap-2">
          <Edit className="h-4 w-4" />
          Edit Event
        </Button>
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete Event
        </Button>
      </div>
    </div>
  );
}