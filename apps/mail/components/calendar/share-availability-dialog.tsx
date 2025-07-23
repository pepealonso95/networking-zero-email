'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Share, ExternalLink, QrCode } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface AvailabilitySlot {
  id: string;
  title: string;
  description?: string;
  duration: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  meetingType: 'google-meet' | 'phone' | 'in-person' | 'custom';
  isActive: boolean;
}

interface ShareAvailabilityDialogProps {
  slot: AvailabilitySlot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export function ShareAvailabilityDialog({ slot, open, onOpenChange }: ShareAvailabilityDialogProps) {
  const [copied, setCopied] = useState(false);
  
  const bookingUrl = `${window.location.origin}/book/${slot.id}`;
  const embedCode = `<iframe src="${bookingUrl}" width="100%" height="600" frameborder="0"></iframe>`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast.success('Booking link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success('Embed code copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy embed code');
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" showOverlay>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="h-5 w-5" />
            Share Availability Slot
          </DialogTitle>
          <DialogDescription>
            Share your booking link or embed it on your website
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Slot Preview */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{slot.title}</CardTitle>
                  {slot.description && (
                    <CardDescription className="mt-1">{slot.description}</CardDescription>
                  )}
                </div>
                <Badge variant={slot.isActive ? 'default' : 'secondary'}>
                  {slot.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Schedule:</span>
                  <div className="text-muted-foreground">
                    {DAYS_OF_WEEK[slot.dayOfWeek]}, {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Duration:</span>
                  <div className="text-muted-foreground">{slot.duration} minutes</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Link */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Booking Link</CardTitle>
              <CardDescription>
                Share this link with people who want to book time with you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={bookingUrl}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  onClick={handleCopyUrl}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(bookingUrl, '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const subject = `Book time with me - ${slot.title}`;
                    const body = `Hi,\n\nI'd like to schedule time with you. Please use this link to book a convenient time slot:\n\n${bookingUrl}\n\nBest regards`;
                    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                  }}
                  className="gap-2"
                >
                  📧 Email Link
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Embed Code */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Embed on Website</CardTitle>
              <CardDescription>
                Add this iframe code to your website to embed the booking form
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>HTML Embed Code</Label>
                <div className="relative">
                  <Input
                    value={embedCode}
                    readOnly
                    className="font-mono text-xs pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyEmbed}
                    className="absolute right-1 top-1 h-8 w-8"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  You can customize the width and height attributes as needed
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Social Sharing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Social Media</CardTitle>
              <CardDescription>
                Share your booking link on social platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const text = `Book time with me: ${slot.title}`;
                    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(bookingUrl)}`;
                    window.open(url, '_blank');
                  }}
                  className="gap-2"
                >
                  🐦 Twitter
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(bookingUrl)}`;
                    window.open(url, '_blank');
                  }}
                  className="gap-2"
                >
                  💼 LinkedIn
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingUrl)}`;
                    window.open(url, '_blank');
                  }}
                  className="gap-2"
                >
                  📘 Facebook
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                QR Code
              </CardTitle>
              <CardDescription>
                Generate a QR code for easy mobile access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => {
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(bookingUrl)}`;
                  window.open(qrUrl, '_blank');
                }}
                className="gap-2"
              >
                <QrCode className="h-4 w-4" />
                Generate QR Code
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}