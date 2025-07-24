'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Edit, Trash2, Video, MapPin, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTRPC } from '@/providers/query-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EditEventDialog } from './edit-event-dialog';

interface EventSidebarProps {
  eventId: string;
  onClose: () => void;
  onEventUpdate: () => void;
}

export function EventSidebar({ eventId, onClose, onEventUpdate }: EventSidebarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  const { data: event, isLoading, error } = useQuery({
    ...trpc.calendar.getEvent.queryOptions({ eventId }),
    enabled: !!eventId,
  });

  // Delete event mutation
  const { mutateAsync: deleteEvent } = useMutation({
    ...trpc.calendar.deleteEvent.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar.getEvents'] });
      toast.success('Event deleted successfully');
      onEventUpdate();
      onClose();
    },
    onError: (error: any) => {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event', {
        description: error?.message || 'An unexpected error occurred'
      });
    },
  });

  if (isLoading) {
    return (
      <div className="border rounded-lg bg-card p-4 h-full">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-20 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg bg-card p-4 h-full">
        <div className="text-center text-muted-foreground">
          Error loading event: {error.message}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="border rounded-lg bg-card p-4 h-full">
        <div className="text-center text-muted-foreground">
          Event not found
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    setShowEditDialog(true);
  };

  const handleDelete = async () => {
    if (!event) return;
    
    // Show confirmation
    if (!confirm(`Are you sure you want to delete "${event.title}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteEvent({ eventId: eventId });
    } catch (error) {
      // Error handling is done in the mutation onError callback
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="border rounded-lg bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Event Details</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
        <Button 
          className="w-full gap-2"
          onClick={handleEdit}
          disabled={isDeleting}
        >
          <Edit className="h-4 w-4" />
          Edit Event
        </Button>
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? 'Deleting...' : 'Delete Event'}
        </Button>
      </div>
      </div>

      {/* Edit Dialog */}
      {event && (
        <EditEventDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          event={event}
          onEventUpdated={onEventUpdate}
        />
      )}
    </>
  );
}