'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Mail, Phone, MessageSquare, Check, AlertCircle } from 'lucide-react';
import { format, addDays, startOfDay, isBefore, isAfter, addMinutes, setHours, setMinutes } from 'date-fns';
import { useTRPC } from '@/providers/query-provider';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  bookingWindow: number;
  meetingType: 'google-meet' | 'phone' | 'in-person' | 'custom';
  questions?: any;
  autoConfirm: boolean;
}

export default function BookingPage() {
  const { slotId } = useParams();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    bookerName: '',
    bookerEmail: '',
    bookerPhone: '',
    message: '',
    responses: {} as Record<string, string>,
  });
  const [step, setStep] = useState<'loading' | 'select-time' | 'form' | 'success' | 'error'>('loading');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);

  const trpc = useTRPC();

  // Mock slot data - in real implementation, this would come from a public API endpoint
  const slot: AvailabilitySlot = {
    id: slotId as string,
    title: '30-minute Meeting',
    description: 'Let\'s discuss your project needs and how I can help.',
    duration: 30,
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '17:00',
    timeZone: 'America/New_York',
    buffer: 15,
    maxBookings: 1,
    isActive: true,
    bookingWindow: 30,
    meetingType: 'google-meet',
    autoConfirm: true,
  };

  const submitBookingMutation = useMutation({
    mutationFn: (data: any) =>
      trpc.calendar.submitMeetingRequest.mutate(data),
    onSuccess: () => {
      setStep('success');
    },
    onError: (error) => {
      console.error('Error submitting booking:', error);
      setStep('error');
      toast.error('Failed to submit booking request');
    },
  });

  useEffect(() => {
    if (slot) {
      setStep('select-time');
      generateAvailableTimes();
    }
  }, [slot]);

  const generateAvailableTimes = () => {
    const times: string[] = [];
    const [startHour, startMinute] = slot.startTime.split(':').map(Number);
    const [endHour, endMinute] = slot.endTime.split(':').map(Number);
    
    let currentTime = setMinutes(setHours(new Date(), startHour), startMinute);
    const endTime = setMinutes(setHours(new Date(), endHour), endMinute);
    
    while (isBefore(currentTime, endTime)) {
      times.push(format(currentTime, 'HH:mm'));
      currentTime = addMinutes(currentTime, slot.duration + slot.buffer);
    }
    
    setAvailableTimes(times);
  };

  const generateAvailableDates = () => {
    const dates = [];
    const today = startOfDay(new Date());
    
    for (let i = 0; i < slot.bookingWindow; i++) {
      const date = addDays(today, i);
      if (date.getDay() === slot.dayOfWeek) {
        dates.push(date);
      }
    }
    
    return dates.slice(0, 10); // Show max 10 available dates
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      setStep('form');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedTime) return;
    
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const requestedTime = setMinutes(setHours(selectedDate, hours), minutes);
    
    submitBookingMutation.mutate({
      availabilitySlotId: slot.id,
      bookerName: formData.bookerName,
      bookerEmail: formData.bookerEmail,
      bookerPhone: formData.bookerPhone,
      requestedTime: requestedTime.toISOString(),
      message: formData.message,
      responses: formData.responses,
    });
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

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-8 w-8 animate-pulse mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <div className="rounded-full bg-green-100 dark:bg-green-900 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Booking Confirmed!</h2>
            <p className="text-muted-foreground mb-4">
              Your meeting request has been {slot.autoConfirm ? 'confirmed' : 'submitted for approval'}. 
              You'll receive a confirmation email shortly.
            </p>
            <div className="text-sm text-muted-foreground">
              <p><strong>Date:</strong> {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
              <p><strong>Time:</strong> {selectedTime && formatTime(selectedTime)}</p>
              <p><strong>Duration:</strong> {slot.duration} minutes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <div className="rounded-full bg-red-100 dark:bg-red-900 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Booking Failed</h2>
            <p className="text-muted-foreground mb-4">
              Sorry, there was an error processing your booking request. Please try again.
            </p>
            <Button onClick={() => setStep('select-time')}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableDates = generateAvailableDates();

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">{slot.title}</h1>
          {slot.description && (
            <p className="text-muted-foreground">{slot.description}</p>
          )}
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {slot.duration} minutes
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {DAYS_OF_WEEK[slot.dayOfWeek]}s
            </div>
            <Badge variant="outline">
              {slot.meetingType.replace('-', ' ')}
            </Badge>
          </div>
        </div>

        {step === 'select-time' && (
          <div className="space-y-6">
            {/* Date Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select a Date</CardTitle>
                <CardDescription>
                  Choose from available {DAYS_OF_WEEK[slot.dayOfWeek]} dates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableDates.map((date) => (
                    <Button
                      key={date.toISOString()}
                      variant={selectedDate?.toDateString() === date.toDateString() ? 'default' : 'outline'}
                      onClick={() => handleDateSelect(date)}
                      className="h-auto py-3 flex flex-col"
                    >
                      <div className="font-medium">{format(date, 'MMM d')}</div>
                      <div className="text-xs opacity-75">{format(date, 'EEEE')}</div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Time Selection */}
            {selectedDate && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select a Time</CardTitle>
                  <CardDescription>
                    Available times for {format(selectedDate, 'EEEE, MMMM d')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {availableTimes.map((time) => (
                      <Button
                        key={time}
                        variant={selectedTime === time ? 'default' : 'outline'}
                        onClick={() => handleTimeSelect(time)}
                        className="h-10"
                      >
                        {formatTime(time)}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Continue Button */}
            {selectedDate && selectedTime && (
              <div className="flex justify-center">
                <Button onClick={handleContinue} size="lg" className="gap-2">
                  Continue to Details
                  <Calendar className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'form' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Details</CardTitle>
              <CardDescription>
                Please provide your information to complete the booking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Selected Time Summary */}
                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium mb-2">Booking Summary</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Date:</strong> {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                    <p><strong>Time:</strong> {selectedTime && formatTime(selectedTime)}</p>
                    <p><strong>Duration:</strong> {slot.duration} minutes</p>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        value={formData.bookerName}
                        onChange={(e) => setFormData({ ...formData, bookerName: e.target.value })}
                        placeholder="Enter your full name"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.bookerEmail}
                        onChange={(e) => setFormData({ ...formData, bookerEmail: e.target.value })}
                        placeholder="Enter your email"
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.bookerPhone}
                      onChange={(e) => setFormData({ ...formData, bookerPhone: e.target.value })}
                      placeholder="Enter your phone number"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message (optional)</Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Anything you'd like to share about this meeting?"
                      className="pl-10 pt-3"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('select-time')}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitBookingMutation.isPending}
                    className="flex-1"
                  >
                    {submitBookingMutation.isPending ? 'Booking...' : 'Confirm Booking'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}