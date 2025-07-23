'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, MapPin, Users, Video } from 'lucide-react';
import { format } from 'date-fns';
import { useTRPC } from '@/providers/query-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStartTime?: Date;
  initialEndTime?: Date;
  onEventCreated?: () => void;
}

export function CreateEventDialog({ open, onOpenChange, initialStartTime, initialEndTime, onEventCreated }: CreateEventDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: format(new Date(), 'HH:mm'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    endTime: format(new Date(Date.now() + 60 * 60 * 1000), 'HH:mm'),
    isAllDay: false,
    withMeet: false,
    attendees: '',
  });

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Update form data when initial times are provided
  useEffect(() => {
    if (initialStartTime && initialEndTime && open) {
      setFormData(prev => ({
        ...prev,
        startDate: format(initialStartTime, 'yyyy-MM-dd'),
        startTime: format(initialStartTime, 'HH:mm'),
        endDate: format(initialEndTime, 'yyyy-MM-dd'),
        endTime: format(initialEndTime, 'HH:mm'),
      }));
    }
  }, [initialStartTime, initialEndTime, open]);

  const createEventMutation = useMutation({
    mutationFn: (eventData: any) => trpc.calendar.createEvent.mutate(eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar.getEvents'] });
      toast.success('Event created successfully');
      onEventCreated?.();
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error('Error creating event:', error);
      if (error?.message?.includes('Google Calendar access expired') || error?.message?.includes('reconnect')) {
        toast.error('Google Calendar access expired', {
          description: 'Please reconnect your Google account',
          action: {
            label: 'Reconnect',
            onClick: async () => {
              await authClient.linkSocial({
                provider: 'google',
                callbackURL: `${window.location.origin}/calendar`,
              });
            },
          },
        });
      } else {
        toast.error('Failed to create event');
      }
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      startTime: format(new Date(), 'HH:mm'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      endTime: format(new Date(Date.now() + 60 * 60 * 1000), 'HH:mm'),
      isAllDay: false,
      withMeet: false,
      attendees: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse attendees
    const attendeesList = formData.attendees
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0)
      .map(email => ({ email, name: email.split('@')[0] }));

    // Create ISO datetime strings
    const startDateTime = formData.isAllDay 
      ? `${formData.startDate}T00:00:00.000Z`
      : `${formData.startDate}T${formData.startTime}:00.000Z`;
    
    const endDateTime = formData.isAllDay 
      ? `${formData.endDate}T23:59:59.999Z`
      : `${formData.endDate}T${formData.endTime}:00.000Z`;

    const eventData = {
      title: formData.title,
      description: formData.description || undefined,
      location: formData.location || undefined,
      startTime: startDateTime,
      endTime: endDateTime,
      isAllDay: formData.isAllDay,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      attendees: attendeesList.length > 0 ? attendeesList : undefined,
      withMeet: formData.withMeet,
    };

    createEventMutation.mutate(eventData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-background border shadow-lg" showOverlay>
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>
            Add a new event to your calendar
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter event title"
              required
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Calendar className="h-4 w-4 mt-3 text-muted-foreground" />
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                {!formData.isAllDay && (
                  <div className="flex gap-2">
                    <Clock className="h-4 w-4 mt-3 text-muted-foreground" />
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>End</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Calendar className="h-4 w-4 mt-3 text-muted-foreground" />
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
                {!formData.isAllDay && (
                  <div className="flex gap-2">
                    <Clock className="h-4 w-4 mt-3 text-muted-foreground" />
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* All day toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="all-day"
              checked={formData.isAllDay}
              onCheckedChange={(checked) => setFormData({ ...formData, isAllDay: checked })}
            />
            <Label htmlFor="all-day">All day event</Label>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add event description"
              rows={3}
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="flex gap-2">
              <MapPin className="h-4 w-4 mt-3 text-muted-foreground" />
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Add location"
              />
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <Label htmlFor="attendees">Attendees</Label>
            <div className="flex gap-2">
              <Users className="h-4 w-4 mt-3 text-muted-foreground" />
              <Input
                id="attendees"
                value={formData.attendees}
                onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                placeholder="Enter email addresses, separated by commas"
              />
            </div>
          </div>

          {/* Google Meet toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="with-meet"
              checked={formData.withMeet}
              onCheckedChange={(checked) => setFormData({ ...formData, withMeet: checked })}
            />
            <Label htmlFor="with-meet" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Add Google Meet
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createEventMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createEventMutation.isPending}>
              {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}