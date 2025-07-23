'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Video, Phone, Users, MapPin } from 'lucide-react';
import { useTRPC } from '@/providers/query-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const MEETING_TYPES = [
  { value: 'google-meet', label: 'Google Meet', icon: Video },
  { value: 'phone', label: 'Phone Call', icon: Phone },
  { value: 'in-person', label: 'In Person', icon: Users },
  { value: 'custom', label: 'Custom', icon: MapPin },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
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
}

interface EditAvailabilitySlotDialogProps {
  slot: AvailabilitySlot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAvailabilitySlotDialog({ slot, open, onOpenChange }: EditAvailabilitySlotDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 30,
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    timeZone: 'UTC',
    buffer: 0,
    maxBookings: 1,
    isActive: true,
    allowWeekends: false,
    bookingWindow: 30,
    meetingType: 'google-meet' as const,
    autoConfirm: true,
  });

  // Update form data when slot changes
  useEffect(() => {
    if (slot) {
      setFormData({
        title: slot.title,
        description: slot.description || '',
        duration: slot.duration,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        timeZone: slot.timeZone,
        buffer: slot.buffer,
        maxBookings: slot.maxBookings,
        isActive: slot.isActive,
        allowWeekends: slot.allowWeekends,
        bookingWindow: slot.bookingWindow,
        meetingType: slot.meetingType,
        autoConfirm: slot.autoConfirm,
      });
    }
  }, [slot]);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateSlotMutation = useMutation({
    mutationFn: (data: Partial<typeof formData>) =>
      trpc.calendar.updateAvailabilitySlot.mutate({ slotId: slot.id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar.getAvailabilitySlots'] });
      toast.success('Availability slot updated successfully');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating slot:', error);
      toast.error('Failed to update availability slot');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSlotMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" showOverlay>
        <DialogHeader>
          <DialogTitle>Edit Availability Slot</DialogTitle>
          <DialogDescription>
            Update your recurring time slot settings
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Slot Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., 30-minute Meeting, Coffee Chat"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of what this slot is for"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration *</Label>
                  <Select
                    value={formData.duration.toString()}
                    onValueChange={(value) => setFormData({ ...formData, duration: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Meeting Type *</Label>
                  <Select
                    value={formData.meetingType}
                    onValueChange={(value: any) => setFormData({ ...formData, meetingType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEETING_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Day of Week *</Label>
                <Select
                  value={formData.dayOfWeek.toString()}
                  onValueChange={(value) => setFormData({ ...formData, dayOfWeek: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buffer">Buffer Time (minutes)</Label>
                  <Input
                    id="buffer"
                    type="number"
                    min="0"
                    max="60"
                    value={formData.buffer}
                    onChange={(e) => setFormData({ ...formData, buffer: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Time between bookings
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxBookings">Max Bookings per Slot</Label>
                  <Input
                    id="maxBookings"
                    type="number"
                    min="1"
                    value={formData.maxBookings}
                    onChange={(e) => setFormData({ ...formData, maxBookings: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bookingWindow">Booking Window (days)</Label>
                <Input
                  id="bookingWindow"
                  type="number"
                  min="1"
                  max="365"
                  value={formData.bookingWindow}
                  onChange={(e) => setFormData({ ...formData, bookingWindow: parseInt(e.target.value) || 30 })}
                />
                <p className="text-xs text-muted-foreground">
                  How far in advance people can book
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-confirm bookings</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically approve booking requests
                    </p>
                  </div>
                  <Switch
                    checked={formData.autoConfirm}
                    onCheckedChange={(checked) => setFormData({ ...formData, autoConfirm: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Make this slot available for booking
                    </p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateSlotMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateSlotMutation.isPending}
            >
              {updateSlotMutation.isPending ? 'Updating...' : 'Update Slot'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}