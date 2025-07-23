import { useState } from 'react';
import { type MetaFunction } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  SearchIcon, 
  SparklesIcon, 
  PlusIcon,
  MailIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  MoreHorizontalIcon,
  FilterIcon,
  DownloadIcon,
  RefreshCwIcon,
  BrainIcon,
  BuildingIcon,
  UserIcon,
  MapPinIcon,
  PhoneIcon
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTRPC } from '@/providers/query-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';

export const meta: MetaFunction = () => {
  return [
    { title: 'Find Leads - Zero Email' },
    { name: 'description', content: 'Generate and manage leads using AI-powered search' },
  ];
};

interface Lead {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  company?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  phoneNumber?: string;
  location?: string;
  source: 'hunter' | 'apollo' | 'snov';
  confidence?: number;
  verified?: boolean;
  addedToCrm: boolean;
  createdAt: string;
}

export default function LeadGenerationPage() {
  const [searchPrompt, setSearchPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<{
    leads: Lead[];
    explanation: string;
    suggestions: string[];
    confidence: number;
    usage: any;
  } | null>(null);

  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get user's settings to check API connections
  const { data: settings } = useQuery(trpc.settings.get.queryOptions());
  
  // Get leads
  const { data: leadsData, refetch: refetchLeads } = useQuery({
    ...trpc.leads.getLeads.queryOptions({ limit: 50 }),
  });

  // Search leads mutation
  const { mutateAsync: searchLeads } = useMutation(trpc.leads.searchLeads.mutationOptions());
  
  // Add to CRM mutation
  const { mutateAsync: addToContacts } = useMutation(trpc.leads.addToContacts.mutationOptions());

  const leadGenSettings = settings?.settings?.leadGeneration;
  const hasApiKeys = leadGenSettings?.hunterApiKey || leadGenSettings?.apolloApiKey || leadGenSettings?.snovApiKey || leadGenSettings?.pdlApiKey;

  const handleSearch = async () => {
    if (!searchPrompt.trim()) {
      toast.error('Please enter a search prompt');
      return;
    }

    if (!hasApiKeys) {
      toast.error('No API keys configured. Please add your API keys in settings.');
      navigate('/settings/leads');
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchLeads({
        prompt: searchPrompt,
        limit: leadGenSettings?.defaultSearchLimit || 10,
      });

      if (result.success) {
        setSearchResults(result.data);
        await refetchLeads();
        toast.success(`Found ${result.data.leads.length} leads!`);
      } else {
        toast.error(result.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToContacts = async (leadIds: string[]) => {
    try {
      const result = await addToContacts({ leadIds });
      
      if (result.success) {
        const successCount = result.results.filter(r => r.success).length;
        toast.success(`Successfully added ${successCount} leads to CRM`);
        setSelectedLeads([]);
        await refetchLeads();
      } else {
        toast.error(result.error || 'Failed to add leads to CRM');
      }
    } catch (error) {
      console.error('Failed to add to CRM:', error);
      toast.error('Failed to add leads to CRM');
    }
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (!leadsData?.leads) return;
    
    const availableLeads = leadsData.leads.filter(lead => !lead.addedToCrm);
    if (selectedLeads.length === availableLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(availableLeads.map(lead => lead.id));
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'hunter': return 'bg-blue-100 text-blue-800';
      case 'apollo': return 'bg-purple-100 text-purple-800';
      case 'snov': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const connectedServices = [
    leadGenSettings?.hunterApiKey ? 'Hunter.io' : null,
    leadGenSettings?.apolloApiKey ? 'Apollo.io' : null,
    leadGenSettings?.snovApiKey ? 'Snov.io' : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 flex flex-col max-w-6xl mx-auto p-6 space-y-6 min-h-0 overflow-hidden">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Find Leads</h1>
          <p className="text-muted-foreground">
            Use AI to discover potential customers and business contacts
          </p>
        </div>

        {/* Connection Status */}
        {!hasApiKeys ? (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <XCircleIcon className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800">No API Keys Configured</p>
                  <p className="text-orange-700 text-sm mt-1">
                    To start finding leads, you need to configure at least one API service.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 border-orange-600 text-orange-800 hover:bg-orange-100"
                    onClick={() => navigate('/settings/leads')}
                  >
                    Configure API Keys
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">
                    Connected to {connectedServices.join(', ')}
                  </p>
                  <p className="text-green-700 text-sm">
                    Ready to search for leads using your configured API services.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainIcon className="h-5 w-5" />
              AI-Powered Lead Search
            </CardTitle>
            <CardDescription>
              Describe the type of leads you're looking for in natural language
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g., marketing directors at SaaS companies in San Francisco"
                  value={searchPrompt}
                  onChange={(e) => setSearchPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                  disabled={isSearching || !hasApiKeys}
                  readOnly={false}
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !hasApiKeys || !searchPrompt.trim()}
                className="flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <RefreshCwIcon className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4" />
                    Generate Leads
                  </>
                )}
              </Button>
            </div>

            {/* Search Examples */}
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Try these examples:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  'Marketing managers at tech startups',
                  'Sales directors in the healthcare industry',
                  'CTOs at companies with 50-200 employees',
                  'Founders of AI companies in New York'
                ].map(example => (
                  <button
                    key={example}
                    onClick={() => setSearchPrompt(example)}
                    className="px-2 py-1 bg-muted hover:bg-muted/80 rounded text-xs"
                    disabled={isSearching}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scrollable Results Section */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="space-y-6">
              {/* Search Results Summary */}
              {searchResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SparklesIcon className="h-5 w-5" />
                Search Results
                <Badge variant="secondary">{searchResults.confidence}% confidence</Badge>
              </CardTitle>
              <CardDescription>
                {searchResults.explanation}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {searchResults.suggestions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Suggestions to improve results:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {searchResults.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-1 h-1 bg-muted-foreground rounded-full mt-2" />
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {searchResults.usage && (
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>API Usage:</span>
                    {Object.entries(searchResults.usage).map(([service, count]) => (
                      <span key={service} className="flex items-center gap-1">
                        {service}: {count as number}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
                </Card>
              )}

              {/* Leads Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Your Leads</CardTitle>
                      <CardDescription>
                        {leadsData?.total || 0} total leads
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {selectedLeads.length > 0 && (
                        <Button
                          onClick={() => handleAddToContacts(selectedLeads)}
                          className="flex items-center gap-2"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add {selectedLeads.length} to CRM
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => refetchLeads()}
                        className="flex items-center gap-2"
                      >
                        <RefreshCwIcon className="h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
            {leadsData?.leads && leadsData.leads.length > 0 ? (
              <div className="space-y-3">
                {/* Bulk Actions */}
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLeads.length === leadsData.leads.filter(l => !l.addedToCrm).length}
                    onChange={handleSelectAll}
                    className="h-4 w-4"
                  />
                  <span className="text-muted-foreground">
                    {selectedLeads.length} of {leadsData.leads.filter(l => !l.addedToCrm).length} selected
                  </span>
                </div>
                
                <Separator />

                {/* Lead Cards */}
                <div className="grid gap-4">
                  {leadsData.leads.map((lead) => (
                    <Card key={lead.id} className={`${lead.addedToCrm ? 'opacity-60' : ''}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {!lead.addedToCrm && (
                              <input
                                type="checkbox"
                                checked={selectedLeads.includes(lead.id)}
                                onChange={() => handleSelectLead(lead.id)}
                                className="h-4 w-4 mt-1"
                              />
                            )}
                            
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-medium flex items-center gap-2">
                                    <UserIcon className="h-4 w-4" />
                                    {lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || lead.email}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">{lead.email}</p>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Badge className={getSourceColor(lead.source)} variant="secondary">
                                    {lead.source}
                                  </Badge>
                                  {lead.verified && (
                                    <Badge variant="default" className="text-xs">
                                      Verified
                                    </Badge>
                                  )}
                                  {lead.addedToCrm && (
                                    <Badge variant="outline" className="text-xs">
                                      In CRM
                                    </Badge>
                                  )}
                                  {lead.confidence && (
                                    <Badge variant="outline" className="text-xs">
                                      {lead.confidence}% match
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                                {lead.company && (
                                  <div className="flex items-center gap-2">
                                    <BuildingIcon className="h-3 w-3" />
                                    {lead.company}
                                  </div>
                                )}
                                {lead.jobTitle && (
                                  <div className="flex items-center gap-2">
                                    <UserIcon className="h-3 w-3" />
                                    {lead.jobTitle}
                                  </div>
                                )}
                                {lead.location && (
                                  <div className="flex items-center gap-2">
                                    <MapPinIcon className="h-3 w-3" />
                                    {lead.location}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {!lead.addedToCrm && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddToContacts([lead.id])}
                                className="flex items-center gap-1"
                              >
                                <PlusIcon className="h-3 w-3" />
                                Add to CRM
                              </Button>
                            )}
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontalIcon className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => window.open(`mailto:${lead.email}`, '_blank')}
                                >
                                  <MailIcon className="h-4 w-4 mr-2" />
                                  Send Email
                                </DropdownMenuItem>
                                {lead.linkedinUrl && (
                                  <DropdownMenuItem
                                    onClick={() => window.open(lead.linkedinUrl, '_blank')}
                                  >
                                    <ExternalLinkIcon className="h-4 w-4 mr-2" />
                                    View LinkedIn
                                  </DropdownMenuItem>
                                )}
                                {lead.phoneNumber && (
                                  <DropdownMenuItem
                                    onClick={() => window.open(`tel:${lead.phoneNumber}`, '_blank')}
                                  >
                                    <PhoneIcon className="h-4 w-4 mr-2" />
                                    Call
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <SearchIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No leads found</h3>
                <p className="text-muted-foreground mb-4">
                  Use the search above to find your first leads
                </p>
                {!hasApiKeys && (
                  <Button onClick={() => navigate('/settings/leads')}>
                    Configure API Keys
                  </Button>
                )}
              </div>
            )}
          </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}