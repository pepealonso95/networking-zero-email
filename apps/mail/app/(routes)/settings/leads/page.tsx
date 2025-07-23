import { useState } from 'react';
import { type MetaFunction } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ExternalLinkIcon, 
  KeyIcon,
  ShieldIcon,
  InfoIcon,
  EyeIcon,
  EyeOffIcon
} from 'lucide-react';
import { useTRPC } from '@/providers/query-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const meta: MetaFunction = () => {
  return [
    { title: 'Lead Generation Settings - Zero Email' },
    { name: 'description', content: 'Configure your lead generation API keys and settings' },
  ];
};

interface APIService {
  name: string;
  key: 'hunterApiKey' | 'apolloApiKey' | 'snovApiKey' | 'pdlApiKey' | 'linkedinSalesNavCookie' | 'linkedinAlternativeApiKey';
  displayName: string;
  description: string;
  freeLimit: string;
  setupUrl: string;
  instructions: string[];
  connected: boolean;
  priority?: 'high' | 'medium' | 'low';
  isLinkedIn?: boolean;
}

export default function LeadGenerationSettingsPage() {
  const [formData, setFormData] = useState({
    hunterApiKey: '',
    apolloApiKey: '',
    snovApiKey: '',
    pdlApiKey: '',
    linkedinSalesNavCookie: '',
    linkedinAlternativeApiKey: '',
    linkedinAlternativeProvider: 'scrap_in' as 'scrap_in' | 'bright_data' | 'apollo',
    defaultSearchLimit: 10,
    enableAutoEnrichment: true,
  });
  
  const [showKeys, setShowKeys] = useState({
    hunterApiKey: false,
    apolloApiKey: false,
    snovApiKey: false,
    pdlApiKey: false,
    linkedinSalesNavCookie: false,
    linkedinAlternativeApiKey: false,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get current settings
  const { data: settings, isLoading } = useQuery(trpc.settings.get.queryOptions());
  
  // Save settings mutation
  const { mutateAsync: saveSettings } = useMutation(trpc.settings.save.mutationOptions());

  // Initialize form data when settings load
  useState(() => {
    if (settings?.settings?.leadGeneration) {
      setFormData({
        hunterApiKey: settings.settings.leadGeneration.hunterApiKey || '',
        apolloApiKey: settings.settings.leadGeneration.apolloApiKey || '',
        snovApiKey: settings.settings.leadGeneration.snovApiKey || '',
        pdlApiKey: settings.settings.leadGeneration.pdlApiKey || '',
        linkedinSalesNavCookie: settings.settings.leadGeneration.linkedinSalesNavCookie || '',
        linkedinAlternativeApiKey: settings.settings.leadGeneration.linkedinAlternativeApiKey || '',
        linkedinAlternativeProvider: settings.settings.leadGeneration.linkedinAlternativeProvider || 'scrap_in',
        defaultSearchLimit: settings.settings.leadGeneration.defaultSearchLimit || 10,
        enableAutoEnrichment: settings.settings.leadGeneration.enableAutoEnrichment ?? true,
      });
    }
  });

  const apiServices: APIService[] = [
    {
      name: 'pdl',
      key: 'pdlApiKey',
      displayName: 'People Data Labs (PDL)',
      description: 'Professional history & education data with country of origin inference',
      freeLimit: '100 API calls/month',
      setupUrl: 'https://dashboard.peopledatalabs.com/api',
      priority: 'high',
      instructions: [
        'Visit https://dashboard.peopledatalabs.com/api',
        'Sign up for a free account',
        'Go to Account → API Keys',
        'Generate and copy your API key',
        'Best for education and country origin filtering',
      ],
      connected: !!formData.pdlApiKey,
    },
    {
      name: 'linkedin-sales-nav',
      key: 'linkedinSalesNavCookie',
      displayName: 'LinkedIn Sales Navigator',
      description: 'Premium LinkedIn data with advanced search capabilities',
      freeLimit: 'Premium subscription required',
      setupUrl: 'https://www.linkedin.com/sales/ssi',
      priority: 'high',
      isLinkedIn: true,
      instructions: [
        '1. Subscribe to LinkedIn Sales Navigator',
        '2. Open browser Developer Tools (F12)',
        '3. Go to Application/Storage → Cookies → linkedin.com',
        '4. Find and copy the "li_at" cookie value',
        '5. Paste the cookie value below',
        'Note: Cookie expires and needs periodic refresh',
      ],
      connected: !!formData.linkedinSalesNavCookie,
    },
    {
      name: 'linkedin-alternative',
      key: 'linkedinAlternativeApiKey',
      displayName: 'LinkedIn Alternative (ScrapIn)',
      description: 'LinkedIn data via GDPR-compliant third-party providers',
      freeLimit: 'Varies by provider',
      setupUrl: 'https://scrapin.io/pricing',
      priority: 'medium',
      isLinkedIn: true,
      instructions: [
        'Visit https://scrapin.io/pricing',
        'Sign up for an account',
        'Go to API section in dashboard',
        'Generate and copy your API key',
        'Alternative to direct LinkedIn access',
      ],
      connected: !!formData.linkedinAlternativeApiKey,
    },
    {
      name: 'hunter',
      key: 'hunterApiKey',
      displayName: 'Hunter.io',
      description: 'Email finder and verifier',
      freeLimit: '25 searches/month',
      setupUrl: 'https://hunter.io/api_keys',
      priority: 'medium',
      instructions: [
        'Visit https://hunter.io/api_keys',
        'Sign up for a free account',
        'Go to Account → API Keys',
        'Copy your API key',
      ],
      connected: !!formData.hunterApiKey,
    },
    {
      name: 'apollo',
      key: 'apolloApiKey', 
      displayName: 'Apollo.io',
      description: 'People and company search',
      freeLimit: 'Limited credits',
      setupUrl: 'https://developer.apollo.io/keys/',
      priority: 'medium',
      instructions: [
        'Visit https://developer.apollo.io/keys/',
        'Create a free account',
        'Go to API Keys section',
        'Generate and copy your API key',
      ],
      connected: !!formData.apolloApiKey,
    },
    {
      name: 'snov',
      key: 'snovApiKey',
      displayName: 'Snov.io',
      description: 'Email discovery and verification',
      freeLimit: '50 credits/month',
      setupUrl: 'https://app.snov.io/api-setting',
      priority: 'low',
      instructions: [
        'Visit https://app.snov.io/api-setting',
        'Sign up for a free account',
        'Go to Settings → API & Webhooks',
        'Create and copy your API key',
      ],
      connected: !!formData.snovApiKey,
    },
  ];

  const handleInputChange = (key: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const toggleShowKey = (keyName: keyof typeof showKeys) => {
    setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSettings({
        leadGeneration: {
          hunterApiKey: formData.hunterApiKey || undefined,
          apolloApiKey: formData.apolloApiKey || undefined,
          snovApiKey: formData.snovApiKey || undefined,
          pdlApiKey: formData.pdlApiKey || undefined,
          linkedinSalesNavCookie: formData.linkedinSalesNavCookie || undefined,
          linkedinAlternativeApiKey: formData.linkedinAlternativeApiKey || undefined,
          linkedinAlternativeProvider: formData.linkedinAlternativeProvider,
          defaultSearchLimit: formData.defaultSearchLimit,
          enableAutoEnrichment: formData.enableAutoEnrichment,
        },
      });
      
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Lead generation settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const connectedServices = apiServices.filter(service => service.connected).length;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded"></div>
          <div className="h-4 w-96 bg-muted rounded"></div>
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Lead Generation Settings</h1>
          <p className="text-muted-foreground">
            Configure your API keys for lead generation services. All keys are encrypted and stored securely.
          </p>
        </div>

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldIcon className="h-5 w-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              {connectedServices} of {apiServices.length} services connected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {apiServices.map(service => (
                <Badge 
                  key={service.name} 
                  variant={service.connected ? 'default' : 'secondary'}
                  className="flex items-center gap-1"
                >
                  {service.connected ? (
                    <CheckCircleIcon className="h-3 w-3" />
                  ) : (
                    <XCircleIcon className="h-3 w-3" />
                  )}
                  {service.displayName}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* API Services Configuration */}
        <div className="grid gap-6">
          {apiServices.map(service => (
            <Card key={service.name}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {service.displayName}
                      {service.priority === 'high' && (
                        <Badge variant="destructive" className="text-xs">RECOMMENDED</Badge>
                      )}
                      {service.connected ? (
                        <Badge variant="default" className="text-xs">Connected</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not Connected</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {service.description} • {service.freeLimit}
                    </CardDescription>
                  </div>
                  <a
                    href={service.setupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Get API Key
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Instructions */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <InfoIcon className="h-4 w-4" />
                    Setup Instructions
                  </h4>
                  <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                    {service.instructions.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>

                {/* LinkedIn-specific inputs or regular API key input */}
                {service.name === 'linkedin-alternative' ? (
                  <div className="space-y-4">
                    {/* Provider Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="linkedinAlternativeProvider">Provider</Label>
                      <Select 
                        value={formData.linkedinAlternativeProvider} 
                        onValueChange={(value) => handleInputChange('linkedinAlternativeProvider', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scrap_in">ScrapIn (Recommended)</SelectItem>
                          <SelectItem value="bright_data">Bright Data</SelectItem>
                          <SelectItem value="apollo">Apollo.io</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Choose your preferred LinkedIn data provider
                      </p>
                    </div>
                    
                    {/* API Key */}
                    <div className="space-y-2">
                      <Label htmlFor={service.key} className="flex items-center gap-2">
                        <KeyIcon className="h-4 w-4" />
                        API Key
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id={service.key}
                            type={showKeys[service.key] ? 'text' : 'password'}
                            value={formData[service.key]}
                            onChange={(e) => handleInputChange(service.key, e.target.value)}
                            placeholder="Enter your API key"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowKey(service.key)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showKeys[service.key] ? (
                              <EyeOffIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : service.name === 'linkedin-sales-nav' ? (
                  <div className="space-y-2">
                    <Label htmlFor={service.key} className="flex items-center gap-2">
                      <KeyIcon className="h-4 w-4" />
                      Sales Navigator Cookie
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={service.key}
                          type={showKeys[service.key] ? 'text' : 'password'}
                          value={formData[service.key]}
                          onChange={(e) => handleInputChange(service.key, e.target.value)}
                          placeholder="li_at cookie value"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowKey(service.key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showKeys[service.key] ? (
                            <EyeOffIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <InfoIcon className="h-3 w-3" />
                      Warning: Cookies expire and need periodic refresh
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor={service.key} className="flex items-center gap-2">
                      <KeyIcon className="h-4 w-4" />
                      API Key
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={service.key}
                          type={showKeys[service.key] ? 'text' : 'password'}
                          value={formData[service.key]}
                          onChange={(e) => handleInputChange(service.key, e.target.value)}
                          placeholder="Enter your API key"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowKey(service.key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showKeys[service.key] ? (
                            <EyeOffIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {formData[service.key] && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircleIcon className="h-3 w-3" />
                    {service.isLinkedIn ? 'LinkedIn integration configured' : 'API key configured'}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Configure default search behavior and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defaultSearchLimit">Default Search Limit</Label>
                <Input
                  id="defaultSearchLimit"
                  type="number"
                  min="1"
                  max="50"
                  value={formData.defaultSearchLimit}
                  onChange={(e) => handleInputChange('defaultSearchLimit', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of leads to return per search (1-50)
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableAutoEnrichment">Auto-enrich Leads</Label>
                  <Switch
                    id="enableAutoEnrichment"
                    checked={formData.enableAutoEnrichment}
                    onCheckedChange={(checked) => handleInputChange('enableAutoEnrichment', checked)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically enrich lead data when adding to CRM
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {/* Security Notice */}
        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              <ShieldIcon className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Security & Privacy</p>
                <p className="text-muted-foreground mt-1">
                  All API keys are encrypted before storage and are only used for lead generation requests. 
                  Your keys are never shared with third parties or used for any other purpose.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}