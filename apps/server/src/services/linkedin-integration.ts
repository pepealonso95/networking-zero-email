/**
 * LinkedIn Integration Service for Lead Generation
 * 
 * IMPORTANT LEGAL NOTICE:
 * - This service provides multiple approaches to LinkedIn data access
 * - Always comply with LinkedIn's Terms of Service
 * - Consider using official LinkedIn Partner APIs when possible
 * - Respect rate limits and user privacy
 */

import { z } from 'zod';

export interface LinkedInLead {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  headline?: string;
  location?: string;
  company?: string;
  jobTitle?: string;
  industry?: string;
  linkedinUrl?: string;
  profilePicture?: string;
  education?: Array<{
    school?: string;
    degree?: string;
    field?: string;
    startDate?: string;
    endDate?: string;
  }>;
  experience?: Array<{
    company?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  }>;
  skills?: string[];
  connections?: number;
  source: 'linkedin_official' | 'linkedin_sales_nav' | 'linkedin_scraping' | 'linkedin_alternative';
  extractedAt: string;
}

export interface LinkedInSearchCriteria {
  // Education filters
  schools?: string[]; // ["Stanford University", "Harvard", "MIT"]
  degrees?: string[]; // ["MBA", "Bachelor", "PhD"]
  fieldOfStudy?: string[]; // ["Computer Science", "Engineering"]
  
  // Company/Work filters
  currentCompanies?: string[]; // ["Google", "Apple", "Meta"]
  pastCompanies?: string[];
  industries?: string[]; // ["Technology", "Software", "Internet"]
  jobTitles?: string[]; // ["Software Engineer", "Product Manager"]
  seniority?: string[]; // ["Director", "VP", "Senior", "Junior"]
  
  // Location filters  
  locations?: string[]; // ["San Francisco Bay Area", "New York", "Remote"]
  
  // Other filters
  keywords?: string[];
  connectionLevel?: '1st' | '2nd' | '3rd+' | 'all';
  limit?: number;
}

/**
 * Strategy 1: Official LinkedIn Partner API (Recommended but requires approval)
 */
export class LinkedInOfficialAPIService {
  private apiKey: string;
  private partnerToken: string;
  
  constructor(apiKey: string, partnerToken: string) {
    this.apiKey = apiKey;
    this.partnerToken = partnerToken;
  }

  async searchPeople(criteria: LinkedInSearchCriteria): Promise<LinkedInLead[]> {
    // This would use official LinkedIn Partner API
    // Requires LinkedIn Partner Program approval
    console.log('🏢 LinkedIn Official API search:', criteria);
    
    throw new Error('LinkedIn Official API requires Partner Program approval. Please apply at https://partner.linkedin.com/');
  }
}

/**
 * Strategy 2: Sales Navigator Integration (User must provide their own account)
 */
export class LinkedInSalesNavService {
  private sessionCookie?: string;
  private csrfToken?: string;
  
  constructor(sessionCookie?: string, csrfToken?: string) {
    this.sessionCookie = sessionCookie;
    this.csrfToken = csrfToken;
  }

  async searchPeople(criteria: LinkedInSearchCriteria): Promise<LinkedInLead[]> {
    if (!this.sessionCookie) {
      throw new Error('LinkedIn Sales Navigator requires user authentication. Please provide session cookies.');
    }

    console.log('🎯 LinkedIn Sales Navigator search:', criteria);
    
    // Build Sales Navigator search URL
    const searchParams = this.buildSalesNavSearchParams(criteria);
    const searchUrl = `https://www.linkedin.com/sales/search/people?${searchParams}`;
    
    try {
      // This would require the user's Sales Navigator session
      const response = await fetch(searchUrl, {
        headers: {
          'Cookie': this.sessionCookie,
          'Csrf-Token': this.csrfToken || '',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/vnd.linkedin.normalized+json+2.1',
        }
      });

      if (!response.ok) {
        throw new Error(`Sales Navigator search failed: ${response.status}`);
      }

      const data = await response.json();
      return this.parseSalesNavResults(data);
      
    } catch (error) {
      console.error('Sales Navigator search error:', error);
      throw error;
    }
  }

  private buildSalesNavSearchParams(criteria: LinkedInSearchCriteria): string {
    const params = new URLSearchParams();
    
    // Education
    if (criteria.schools?.length) {
      params.append('schools', criteria.schools.join(','));
    }
    
    // Company
    if (criteria.currentCompanies?.length) {
      params.append('company', criteria.currentCompanies.join(','));
    }
    
    // Location
    if (criteria.locations?.length) {
      params.append('geoRegion', criteria.locations.join(','));
    }
    
    // Keywords
    if (criteria.keywords?.length) {
      params.append('keywords', criteria.keywords.join(' '));
    }
    
    if (criteria.limit) {
      params.append('count', criteria.limit.toString());
    }
    
    return params.toString();
  }

  private parseSalesNavResults(data: any): LinkedInLead[] {
    // Parse Sales Navigator API response
    if (!data.elements) return [];
    
    return data.elements.map((person: any): LinkedInLead => ({
      firstName: person.firstName,
      lastName: person.lastName, 
      fullName: `${person.firstName} ${person.lastName}`,
      headline: person.headline,
      location: person.geoLocation?.name,
      company: person.currentPositions?.[0]?.companyName,
      jobTitle: person.currentPositions?.[0]?.title,
      linkedinUrl: `https://www.linkedin.com/in/${person.publicIdentifier}`,
      profilePicture: person.profilePicture?.['100x100'],
      education: person.educations?.map((edu: any) => ({
        school: edu.school?.name,
        degree: edu.degree,
        field: edu.fieldOfStudy,
        startDate: edu.startDate?.year?.toString(),
        endDate: edu.endDate?.year?.toString(),
      })),
      experience: person.positions?.map((pos: any) => ({
        company: pos.companyName,
        title: pos.title,
        startDate: pos.startDate?.year?.toString(),
        endDate: pos.endDate?.year?.toString(),
      })),
      source: 'linkedin_sales_nav',
      extractedAt: new Date().toISOString(),
    }));
  }
}

/**
 * Strategy 3: Alternative Data Providers (Post-Proxycurl era)
 */
export class LinkedInAlternativeService {
  private provider: 'scrap_in' | 'bright_data' | 'apollo' | 'people_data_labs';
  private apiKey: string;
  
  constructor(provider: 'scrap_in' | 'bright_data' | 'apollo' | 'people_data_labs', apiKey: string) {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  async searchPeople(criteria: LinkedInSearchCriteria): Promise<LinkedInLead[]> {
    console.log(`🔄 Using ${this.provider} as LinkedIn alternative:`, criteria);
    
    switch (this.provider) {
      case 'scrap_in':
        return this.searchWithScrapIn(criteria);
      case 'bright_data':
        return this.searchWithBrightData(criteria);
      case 'apollo':
        return this.searchWithApollo(criteria);
      case 'people_data_labs':
        return this.searchWithPDL(criteria);
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  private async searchWithScrapIn(criteria: LinkedInSearchCriteria): Promise<LinkedInLead[]> {
    // ScrapIn API (GDPR compliant alternative)
    const endpoint = 'https://api.scrapin.io/enrichment/profile';
    
    // Convert criteria to ScrapIn format
    const searchQuery = this.buildLinkedInSearchQuery(criteria);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          linkedinUrl: searchQuery, // ScrapIn works with LinkedIn URLs
          includeSkills: true,
          includeEducation: true,
          includeExperience: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`ScrapIn API error: ${response.status}`);
      }

      const data = await response.json();
      return [this.convertToLinkedInLead(data, 'linkedin_alternative')];
      
    } catch (error) {
      console.error('ScrapIn search error:', error);
      throw error;
    }
  }

  private async searchWithBrightData(criteria: LinkedInSearchCriteria): Promise<LinkedInLead[]> {
    // Bright Data for large-scale LinkedIn data
    console.log('Using Bright Data for LinkedIn search');
    // Implementation would require Bright Data's LinkedIn dataset API
    return [];
  }

  private async searchWithApollo(criteria: LinkedInSearchCriteria): Promise<LinkedInLead[]> {
    // Apollo.io as alternative (already implemented in main service)
    console.log('Using Apollo as LinkedIn alternative');
    return [];
  }

  private async searchWithPDL(criteria: LinkedInSearchCriteria): Promise<LinkedInLead[]> {
    // People Data Labs (already implemented)
    console.log('Using PDL as LinkedIn alternative');
    return [];
  }

  private buildLinkedInSearchQuery(criteria: LinkedInSearchCriteria): string {
    // Build LinkedIn search URL from criteria
    // This is a simplified version - real implementation would be more sophisticated
    const baseUrl = 'https://www.linkedin.com/search/results/people/';
    const params = new URLSearchParams();
    
    if (criteria.schools?.length) {
      params.append('school', criteria.schools[0]);
    }
    
    if (criteria.currentCompanies?.length) {
      params.append('company', criteria.currentCompanies[0]);
    }
    
    if (criteria.locations?.length) {
      params.append('location', criteria.locations[0]);
    }
    
    return `${baseUrl}?${params.toString()}`;
  }

  private convertToLinkedInLead(data: any, source: LinkedInLead['source']): LinkedInLead {
    return {
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: data.fullName,
      headline: data.headline,
      location: data.location,
      company: data.company,
      jobTitle: data.jobTitle,
      linkedinUrl: data.linkedinUrl,
      profilePicture: data.profilePicture,
      education: data.education,
      experience: data.experience,
      skills: data.skills,
      source,
      extractedAt: new Date().toISOString(),
    };
  }
}

/**
 * Main LinkedIn Service - Combines all strategies with fallbacks
 */
export class LinkedInLeadService {
  private officialAPI?: LinkedInOfficialAPIService;
  private salesNavAPI?: LinkedInSalesNavService;
  private alternativeAPI?: LinkedInAlternativeService;

  constructor(options: {
    // Official API (requires partner approval)
    linkedinPartnerKey?: string;
    linkedinPartnerToken?: string;
    
    // Sales Navigator (requires user session)
    salesNavCookie?: string;
    salesNavCsrf?: string;
    
    // Alternative providers
    alternativeProvider?: 'scrap_in' | 'bright_data' | 'apollo' | 'people_data_labs';
    alternativeApiKey?: string;
  }) {
    if (options.linkedinPartnerKey && options.linkedinPartnerToken) {
      this.officialAPI = new LinkedInOfficialAPIService(
        options.linkedinPartnerKey, 
        options.linkedinPartnerToken
      );
    }
    
    if (options.salesNavCookie) {
      this.salesNavAPI = new LinkedInSalesNavService(
        options.salesNavCookie,
        options.salesNavCsrf
      );
    }
    
    if (options.alternativeProvider && options.alternativeApiKey) {
      this.alternativeAPI = new LinkedInAlternativeService(
        options.alternativeProvider,
        options.alternativeApiKey
      );
    }
  }

  async searchStanfordTechInSF(): Promise<LinkedInLead[]> {
    const criteria: LinkedInSearchCriteria = {
      schools: ['Stanford University'],
      industries: ['Technology', 'Software', 'Computer Software', 'Internet'],
      locations: ['San Francisco Bay Area', 'San Francisco', 'Palo Alto', 'Mountain View'],
      keywords: ['tech', 'software', 'engineer', 'product'],
      limit: 25
    };

    return this.searchPeople(criteria);
  }

  async searchPeople(criteria: LinkedInSearchCriteria): Promise<LinkedInLead[]> {
    const results: LinkedInLead[] = [];
    const errors: string[] = [];

    // Try Official LinkedIn API first (most reliable)
    if (this.officialAPI) {
      try {
        console.log('🏢 Trying LinkedIn Official API...');
        const officialResults = await this.officialAPI.searchPeople(criteria);
        results.push(...officialResults);
        if (results.length > 0) return results;
      } catch (error) {
        errors.push(`Official API: ${error}`);
      }
    }

    // Try Sales Navigator (high quality but requires auth)  
    if (this.salesNavAPI) {
      try {
        console.log('🎯 Trying LinkedIn Sales Navigator...');
        const salesNavResults = await this.salesNavAPI.searchPeople(criteria);
        results.push(...salesNavResults);
        if (results.length > 0) return results;
      } catch (error) {
        errors.push(`Sales Navigator: ${error}`);
      }
    }

    // Try alternative providers (fallback)
    if (this.alternativeAPI) {
      try {
        console.log('🔄 Trying alternative LinkedIn provider...');
        const altResults = await this.alternativeAPI.searchPeople(criteria);
        results.push(...altResults);
        if (results.length > 0) return results;
      } catch (error) {
        errors.push(`Alternative provider: ${error}`);
      }
    }

    if (results.length === 0) {
      console.warn('All LinkedIn search methods failed:', errors);
      throw new Error(`LinkedIn search failed: ${errors.join('; ')}`);
    }

    return results;
  }

  getAvailableMethods(): string[] {
    const methods: string[] = [];
    if (this.officialAPI) methods.push('LinkedIn Official API');
    if (this.salesNavAPI) methods.push('LinkedIn Sales Navigator');
    if (this.alternativeAPI) methods.push('Alternative Provider');
    return methods;
  }
}

// Helper function to convert LinkedIn leads to standard Lead format
export function convertLinkedInLeadToStandardLead(linkedinLead: LinkedInLead): any {
  return {
    email: '', // LinkedIn doesn't provide emails directly
    firstName: linkedinLead.firstName,
    lastName: linkedinLead.lastName,
    fullName: linkedinLead.fullName,
    company: linkedinLead.company,
    jobTitle: linkedinLead.jobTitle,
    linkedinUrl: linkedinLead.linkedinUrl,
    location: linkedinLead.location,
    source: linkedinLead.source,
    confidence: 0.9, // LinkedIn data is generally high quality
    verified: false, // Need email verification
    educationHistory: linkedinLead.education,
    workHistory: linkedinLead.experience,
    metadata: {
      headline: linkedinLead.headline,
      skills: linkedinLead.skills,
      connections: linkedinLead.connections,
      profilePicture: linkedinLead.profilePicture,
      extractedAt: linkedinLead.extractedAt,
    },
  };
}