import { useState, useEffect, useRef } from 'react';
import { type MetaFunction } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  PlusIcon, 
  SearchIcon,
  MailIcon,
  PhoneIcon,
  BuildingIcon,
  EditIcon,
  TrashIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  BrainIcon,
  LightbulbIcon
} from 'lucide-react';
import { useTRPC } from '@/providers/query-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { useNavigate } from 'react-router';

export const meta: MetaFunction = () => {
  return [
    { title: 'Networking - 0.email' },
    { name: 'description', content: 'Manage your professional network' },
  ];
};

export default function NetworkingPage() {
  const [search, setSearch] = useState('');
  const [editingContact, setEditingContact] = useState<any>(null);
  const [deletingContact, setDeletingContact] = useState<any>(null);
  const [suggestionsFor, setSuggestionsFor] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 300);
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: contactsData, isLoading } = useQuery(trpc.crm.contacts.list.queryOptions({
    search: debouncedSearch || undefined,
    limit: 100,
  }));

  const { mutateAsync: deleteContact } = useMutation(trpc.crm.contacts.delete.mutationOptions());
  const { mutateAsync: syncEmails, isPending: isSyncing } = useMutation(trpc.crm.contacts.syncEmails.mutationOptions());

  // Smart suggestions query
  const { data: smartSuggestions, refetch: refetchSuggestions, isFetching: loadingSuggestions } = useQuery({
    ...trpc.crm.getSmartSuggestions.queryOptions({ 
      contactId: suggestionsFor?.id || '' 
    }),
    enabled: !!suggestionsFor?.id
  });

  // Background sync for detecting new emails (non-blocking)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Start background sync after 5 seconds, then every 30 seconds
    const startBackgroundSync = () => {
      const performBackgroundSync = async () => {
        try {
          // Only sync if there are contacts and user is on the CRM page
          if (contactsData?.contacts?.length) {
            // Run sync in background without awaiting or showing loading
            syncEmails({ forceHistoric: false }).then(() => {
              queryClient.invalidateQueries({ queryKey: ['crm', 'contacts', 'list'] });
            }).catch(() => {
              // Silently fail background sync
            });
          }
        } catch (error) {
          // Silently handle errors in background sync
        }
      };

      // Initial sync after 5 seconds
      const initialTimer = setTimeout(() => {
        performBackgroundSync();
        
        // Then sync every 30 seconds
        syncIntervalRef.current = setInterval(performBackgroundSync, 30000);
      }, 5000);

      return () => {
        clearTimeout(initialTimer);
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    };

    const cleanup = startBackgroundSync();
    
    return cleanup;
  }, [syncEmails, queryClient, contactsData?.contacts?.length]);


  const handleEmailContact = async (contact: any) => {
    console.log('Email button clicked for contact:', contact.email);
    console.log('Contact data:', contact);
    
    // Check if we have a stored thread ID from previous interactions
    if (contact.lastInteraction?.emailThreadId) {
      const threadId = contact.lastInteraction.emailThreadId;
      const folder = contact.lastInteraction.direction === 'outbound' ? 'sent' : 'inbox';
      console.log(`Navigating to existing thread: ${threadId} in ${folder}`);
      navigate(`/mail/${folder}?threadId=${encodeURIComponent(threadId)}`);
      return;
    }
    
    console.log('No existing thread found, attempting sync for contact:', contact.id);
    
    // If no thread ID, do a quick sync to try to find existing threads
    try {
      await syncEmails({ contactId: contact.id, forceHistoric: true }); // Use historic to ensure we find old threads
      
      // Refresh data to get the latest interactions
      const updatedData = await queryClient.refetchQueries({ 
        queryKey: ['crm', 'contacts', 'list'],
        type: 'active' 
      });
      
      // Check if we now have thread information
      const freshContactsData = updatedData[0]?.data as any;
      const updatedContact = freshContactsData?.contacts?.find((c: any) => c.id === contact.id);
      
      console.log('After sync, updated contact:', updatedContact);
      
      if (updatedContact?.lastInteraction?.emailThreadId) {
        const interaction = updatedContact.lastInteraction;
        const folder = interaction.direction === 'outbound' ? 'sent' : 'inbox';
        console.log(`Found thread after sync: ${interaction.emailThreadId} in ${folder}`);
        navigate(`/mail/${folder}?threadId=${encodeURIComponent(interaction.emailThreadId)}`);
        return;
      }
      
      console.log('Still no thread found after sync');
    } catch (error) {
      console.error('Quick sync failed:', error);
    }
    
    // Fallback: navigate to compose page if no thread is found
    console.log('Falling back to compose');
    const contactName = contact.fullName || contact.email;
    navigate(`/mail/compose?to=${encodeURIComponent(contact.email)}&subject=${encodeURIComponent(`Hi ${contactName}`)}`);
  };

  const handleActivityClick = (contact: any) => {
    const lastActivity = formatLastActivity(contact);
    if (lastActivity.isClickable && lastActivity.threadId) {
      // Determine correct folder based on activity summary
      const folder = lastActivity.summary.includes('sent') ? 'sent' : 'inbox';
      navigate(`/mail/${folder}?threadId=${encodeURIComponent(lastActivity.threadId)}`);
    }
  };

  const handleDeleteContact = async () => {
    if (!deletingContact) return;
    
    try {
      await deleteContact({ id: deletingContact.id });
      queryClient.invalidateQueries({ queryKey: ['crm', 'contacts', 'list'] });
      setDeletingContact(null);
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  const handleManualSync = async () => {
    try {
      await syncEmails({ forceHistoric: false });
      queryClient.invalidateQueries({ queryKey: ['crm', 'contacts', 'list'] });
      console.log('Email sync completed - Email buttons will now navigate to specific threads');
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  const handleContactSync = async (contactId: string, contactEmail: string) => {
    try {
      console.log(`Starting manual sync for contact: ${contactEmail}`);
      await syncEmails({ contactId, forceHistoric: true });
      queryClient.invalidateQueries({ queryKey: ['crm', 'contacts', 'list'] });
      console.log(`Sync completed for contact: ${contactEmail}`);
    } catch (error) {
      console.error(`Manual sync failed for contact ${contactEmail}:`, error);
    }
  };

  const formatLastActivity = (contact: any) => {
    const interaction = contact.lastInteraction;
    
    if (!interaction) {
      return {
        summary: 'No activity',
        timestamp: null,
        isClickable: false,
        threadId: null
      };
    }

    const date = new Date(interaction.createdAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    let timeString = '';
    if (diffDays === 0) timeString = 'Today';
    else if (diffDays === 1) timeString = 'Yesterday';
    else if (diffDays < 7) timeString = `${diffDays}d ago`;
    else if (diffDays < 30) timeString = `${Math.floor(diffDays / 7)}w ago`;
    else timeString = `${Math.floor(diffDays / 30)}mo ago`;

    let summary = '';
    if (interaction.type === 'email') {
      summary = interaction.direction === 'outbound' ? 'Email sent' : 'Email received';
      if (interaction.subject) {
        summary += `: ${interaction.subject.length > 30 ? interaction.subject.substring(0, 30) + '...' : interaction.subject}`;
      }
    } else {
      summary = `${interaction.type} (${interaction.direction})`;
    }

    return {
      summary,
      timestamp: timeString,
      isClickable: !!interaction.emailThreadId,
      threadId: interaction.emailThreadId
    };
  };

  return (
    <div className="p-6">
      {/* Credit Link */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Project thanks to{' '}
          <a 
            href="https://0.email" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            Zero Email
          </a>
        </p>
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Professional Network</h1>
          <p className="text-muted-foreground">
            {contactsData?.total || 0} contacts in your network
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleManualSync}
            disabled={isSyncing}
          >
            <RefreshCwIcon className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Emails
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
              </DialogHeader>
              <ContactForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 max-w-sm"
        />
      </div>

      {/* Contacts Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Next Action</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-muted rounded-full animate-pulse"></div>
                      <div>
                        <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
                        <div className="h-3 bg-muted rounded w-24 mt-1 animate-pulse"></div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-6 bg-muted rounded w-16 animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-muted rounded w-16 animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-8 bg-muted rounded w-16 animate-pulse ml-auto"></div>
                  </TableCell>
                </TableRow>
              ))
            ) : contactsData?.contacts?.length ? (
              contactsData.contacts.map((contact) => (
                <TableRow key={contact.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {contact.fullName?.[0] || contact.email[0]}
                      </div>
                      <div>
                        <div className="font-medium">
                          {contact.fullName || contact.email}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center">
                          <MailIcon className="h-3 w-3 mr-1" />
                          {contact.email}
                        </div>
                        {contact.phone && (
                          <div className="text-sm text-muted-foreground flex items-center">
                            <PhoneIcon className="h-3 w-3 mr-1" />
                            {contact.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.company ? (
                      <div className="flex items-center text-sm">
                        <BuildingIcon className="h-3 w-3 mr-1 text-muted-foreground" />
                        {contact.company}
                        {contact.jobTitle && (
                          <div className="text-muted-foreground ml-2">
                            • {contact.jobTitle}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      contact.priority === 'high' ? 'destructive' : 
                      contact.priority === 'medium' ? 'default' : 'secondary'
                    }>
                      {contact.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {(() => {
                      const activity = formatLastActivity(contact);
                      return (
                        <div 
                          className={`space-y-1 ${activity.isClickable ? 'cursor-pointer' : ''}`}
                          onClick={activity.isClickable ? () => handleActivityClick(contact) : undefined}
                        >
                          <div className={`text-xs ${activity.isClickable ? 'text-blue-600 hover:underline' : 'text-muted-foreground'}`}>
                            {activity.summary}
                          </div>
                          {activity.timestamp && (
                            <div className="text-xs text-muted-foreground">
                              {activity.timestamp}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant="outline" className="text-xs">
                      {contact.nextAction || 'Reach out'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSuggestionsFor(contact)}
                      >
                        <LightbulbIcon className="h-3 w-3 mr-1" />
                        Smart Tips
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEmailContact(contact)}
                      >
                        <MailIcon className="h-3 w-3 mr-1" />
                        Email
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                            <EditIcon className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleContactSync(contact.id, contact.email)}>
                            <RefreshCwIcon className="h-4 w-4 mr-2" />
                            Sync Emails
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingContact(contact)}
                            className="text-destructive"
                          >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <PlusIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">No contacts found</h3>
                      <p className="text-muted-foreground text-sm">
                        {search 
                          ? "Try adjusting your search" 
                          : "Get started by adding your first professional contact"
                        }
                      </p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <PlusIcon className="h-4 w-4 mr-2" />
                          Add Contact
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Contact</DialogTitle>
                        </DialogHeader>
                        <ContactForm />
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          {editingContact && (
            <ContactForm 
              contact={editingContact} 
              onSuccess={() => setEditingContact(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete {deletingContact?.fullName || deletingContact?.email}? 
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingContact(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteContact}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Suggestions Dialog */}
      <Dialog open={!!suggestionsFor} onOpenChange={() => setSuggestionsFor(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainIcon className="h-5 w-5" />
              Smart Next Actions for {suggestionsFor?.fullName || suggestionsFor?.email}
            </DialogTitle>
          </DialogHeader>
          
          {loadingSuggestions ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCwIcon className="h-6 w-6 animate-spin" />
              <span className="ml-2">Analyzing email patterns...</span>
            </div>
          ) : smartSuggestions ? (
            <div className="space-y-4">
              {smartSuggestions.suggestions?.map((suggestion: any, index: number) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <LightbulbIcon className="h-4 w-4" />
                        {suggestion.action}
                      </CardTitle>
                      <Badge 
                        variant={suggestion.confidence > 0.8 ? 'default' : suggestion.confidence > 0.6 ? 'secondary' : 'outline'}
                      >
                        {Math.round(suggestion.confidence * 100)}% confident
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      {suggestion.reason}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {suggestion.type || 'ai-generated'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
              
              {smartSuggestions.contextualInsights && smartSuggestions.contextualInsights.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BrainIcon className="h-4 w-4" />
                      Analysis Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {smartSuggestions.contextualInsights.map((insight: string, index: number) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                          <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="default"
                  onClick={() => handleEmailContact(suggestionsFor)}
                  className="flex-1"
                >
                  <MailIcon className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button
                  variant="outline"
                  onClick={() => refetchSuggestions()}
                  disabled={loadingSuggestions}
                >
                  <RefreshCwIcon className={`h-4 w-4 ${loadingSuggestions ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <LightbulbIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                No smart suggestions available for this contact yet.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactForm({ contact, onSuccess }: { contact?: any; onSuccess?: () => void }) {
  const [formData, setFormData] = useState({
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    email: contact?.email || '',
    company: contact?.company || '',
    jobTitle: contact?.jobTitle || '',
    phone: contact?.phone || '',
    linkedinUrl: contact?.linkedinUrl || '',
    priority: (contact?.priority as 'high' | 'medium' | 'low') || 'medium',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  const { mutateAsync: createContact } = useMutation(trpc.crm.contacts.create.mutationOptions());
  const { mutateAsync: updateContact } = useMutation(trpc.crm.contacts.update.mutationOptions());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;
    
    setIsSubmitting(true);
    
    try {
      if (contact) {
        // Update existing contact
        await updateContact({
          id: contact.id,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          company: formData.company,
          jobTitle: formData.jobTitle,
          phone: formData.phone,
          linkedinUrl: formData.linkedinUrl,
          priority: formData.priority,
        });
      } else {
        // Create new contact
        await createContact({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          company: formData.company,
          jobTitle: formData.jobTitle,
          phone: formData.phone,
          linkedinUrl: formData.linkedinUrl,
          priority: formData.priority,
        });
      }
      
      // Success - refresh data and close dialog
      queryClient.invalidateQueries({ queryKey: ['crm', 'contacts', 'list'] });
      
      if (!contact) {
        // Reset form only for new contact creation
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          company: '',
          jobTitle: '',
          phone: '',
          linkedinUrl: '',
          priority: 'medium',
        });
      }
      
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save contact:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            placeholder="First Name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            placeholder="Last Name"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          required
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          placeholder="email@example.com"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          value={formData.company}
          onChange={(e) => handleInputChange('company', e.target.value)}
          placeholder="Company name"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="jobTitle">Job Title</Label>
        <Input
          id="jobTitle"
          value={formData.jobTitle}
          onChange={(e) => handleInputChange('jobTitle', e.target.value)}
          placeholder="Job title"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          placeholder="Phone number"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
        <Input
          id="linkedinUrl"
          type="url"
          value={formData.linkedinUrl}
          onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
          placeholder="https://linkedin.com/in/..."
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Button 
        type="submit" 
        className="w-full" 
        disabled={!formData.email || isSubmitting}
      >
        {isSubmitting 
          ? (contact ? 'Updating...' : 'Adding...') 
          : (contact ? 'Update Contact' : 'Add Contact')
        }
      </Button>
    </form>
  );
}