'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Clock, Calendar, Share, Copy } from 'lucide-react';
import { CreateAvailabilitySlotDialog } from './create-availability-slot-dialog';
import { EditAvailabilitySlotDialog } from './edit-availability-slot-dialog';
import { ShareAvailabilityDialog } from './share-availability-dialog';
import { useTRPC } from '@/providers/query-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

interface AvailabilitySlot {
  id: string;
  title: string;
  description?: string;
  duration: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timeZone: string;
  buffer: number;
  maxBookings: number;
  isActive: boolean;
  allowWeekends: boolean;
  bookingWindow: number;
  meetingType: 'google-meet' | 'phone' | 'in-person' | 'custom';
  questions?: any;
  autoConfirm: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function AvailabilitySlots() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [sharingSlot, setSharingSlot] = useState<AvailabilitySlot | null>(null);
  
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Fetch availability slots
  const { data: slots = [], isLoading } = useQuery({
    ...trpc.calendar.getAvailabilitySlots.queryOptions(),
  });

  // Toggle slot active status
  const toggleSlotMutation = useMutation({
    mutationFn: ({ slotId, isActive }: { slotId: string; isActive: boolean }) =>
      trpc.calendar.updateAvailabilitySlot.mutate({ slotId, isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar.getAvailabilitySlots'] });
      toast.success('Availability slot updated');
    },
    onError: (error) => {
      console.error('Error updating slot:', error);
      toast.error('Failed to update availability slot');
    },
  });

  // Delete slot
  const deleteSlotMutation = useMutation({
    mutationFn: (slotId: string) =>
      trpc.calendar.deleteAvailabilitySlot.mutate({ slotId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar.getAvailabilitySlots'] });
      toast.success('Availability slot deleted');
    },
    onError: (error) => {
      console.error('Error deleting slot:', error);
      toast.error('Failed to delete availability slot');
    },
  });

  const handleToggleActive = (slot: AvailabilitySlot) => {
    toggleSlotMutation.mutate({ slotId: slot.id, isActive: !slot.isActive });
  };

  const handleDelete = (slot: AvailabilitySlot) => {
    if (confirm(`Are you sure you want to delete "${slot.title}"?`)) {
      deleteSlotMutation.mutate(slot.id);
    }
  };

  const handleCopyBookingLink = (slot: AvailabilitySlot) => {
    const bookingUrl = `${window.location.origin}/book/${slot.id}`;
    navigator.clipboard.writeText(bookingUrl);
    toast.success('Booking link copied to clipboard');
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getMeetingTypeIcon = (type: string) => {
    switch (type) {
      case 'google-meet':
        return '📹';
      case 'phone':
        return '📞';
      case 'in-person':
        return '🤝';
      default:
        return '💬';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Availability Slots</h2>
          <p className="text-muted-foreground">
            Create recurring time slots that others can book
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Slot
        </Button>
      </div>

      {/* Slots list */}
      {slots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No availability slots yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first availability slot to start accepting bookings
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Availability Slot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {slots.map((slot) => (
            <Card key={slot.id} className={!slot.isActive ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{slot.title}</CardTitle>
                      <Badge variant={slot.isActive ? 'default' : 'secondary'}>
                        {slot.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        {getMeetingTypeIcon(slot.meetingType)}
                        {slot.meetingType.replace('-', ' ')}
                      </Badge>
                    </div>
                    {slot.description && (
                      <CardDescription>{slot.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSharingSlot(slot)}
                      className="h-8 w-8"
                    >
                      <Share className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingSlot(slot)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(slot)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Schedule details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Schedule</span>
                    </div>
                    <div className="pl-6">
                      <div>{DAYS_OF_WEEK[slot.dayOfWeek]}</div>
                      <div>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Duration</span>
                    </div>
                    <div className="pl-6">
                      {slot.duration} minutes
                      {slot.buffer > 0 && (
                        <div className="text-xs text-muted-foreground">
                          +{slot.buffer}min buffer
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Settings */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Max: {slot.maxBookings} booking{slot.maxBookings !== 1 ? 's' : ''}</span>
                    <span>Window: {slot.bookingWindow} days</span>
                    <span>{slot.autoConfirm ? 'Auto-confirm' : 'Manual approval'}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyBookingLink(slot)}
                      className="gap-1 h-8"
                    >
                      <Copy className="h-3 w-3" />
                      Copy Link
                    </Button>
                    <Switch
                      checked={slot.isActive}
                      onCheckedChange={() => handleToggleActive(slot)}
                      disabled={toggleSlotMutation.isPending}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateAvailabilitySlotDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
      
      {editingSlot && (
        <EditAvailabilitySlotDialog
          slot={editingSlot}
          open={Boolean(editingSlot)}
          onOpenChange={(open) => !open && setEditingSlot(null)}
        />
      )}
      
      {sharingSlot && (
        <ShareAvailabilityDialog
          slot={sharingSlot}
          open={Boolean(sharingSlot)}
          onOpenChange={(open) => !open && setSharingSlot(null)}
        />
      )}
    </div>
  );
}