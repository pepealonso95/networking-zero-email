'use client';

import { useState, useEffect } from 'react';
import { AvailabilitySlots } from '@/components/calendar/availability-slots';

export default function AvailabilityPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading availability...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <AvailabilitySlots />
    </div>
  );
}