import { z } from 'zod';
import { parseUserRequestToPDLCriteria, type ParsedSearchCriteria } from './lead-criteria-parser.js';
import { LinkedInLeadService, convertLinkedInLeadToStandardLead, type LinkedInSearchCriteria } from './linkedin-integration.js';

// Types for API responses
export interface Lead {
  email: string; // Required - we only accept leads with emails
  firstName?: string;
  lastName?: string;
  fullName?: string;
  company?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  phoneNumber?: string;
  location?: string;
  source: 'hunter' | 'apollo' | 'snov' | 'pdl';
  confidence?: number;
  verified?: boolean;
  countryOfOrigin?: string;
  educationHistory?: Array<{
    school: string;
    degree?: string;
    field?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  }>;
  workHistory?: Array<{
    company: string;
    title: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  }>;
  inferredOrigin?: {
    country: string;
    confidence: number;
    reasoning: string;
  };
  metadata?: Record<string, any>;
}

export interface SearchCriteria {
  company?: string;
  domain?: string;
  jobTitle?: string;
  location?: string;
  industry?: string;
  companySize?: string;
  keywords?: string[];
  seniority?: 'junior' | 'senior' | 'executive';
  department?: string;
  emailType?: 'personal' | 'generic';
  education?: string;
  countryOfOrigin?: string;
  currentLocation?: string;
  limit?: number;
  
  // Enhanced education filters for Apollo
  schools?: string[];
  degrees?: string[];
  majors?: string[];
  
  // Enhanced location filters
  locations?: string[];
  
  // Enhanced company filters  
  companies?: string[];
  companyIndustries?: string[];
  employeeCountRanges?: string[];
  
  // Demographic filters
  namePatterns?: string[];
  demographicIndicators?: string[];
}

export interface ApiUsage {
  hunter?: number;
  apollo?: number;
  snov?: number;
  pdl?: number;
  linkedin?: number;
}

// Colombian demographic detection utility
export class ColombianDetector {
  private static colombianSurnames = [
    // Most common Colombian surnames
    'rodriguez', 'garcia', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'perez',
    'sanchez', 'ramirez', 'cruz', 'flores', 'gomez', 'morales', 'vasquez', 'castillo',
    'jimenez', 'rojas', 'mendoza', 'torres', 'diaz', 'moreno', 'gutierrez', 'ortiz',
    'chavez', 'ruiz', 'herrera', 'medina', 'suarez', 'aguirre', 'silva', 'vargas',
    'restrepo', 'valencia', 'cardenas', 'ospina', 'arias', 'franco', 'giraldo',
    'mesa', 'zapata', 'henao', 'bedoya', 'correa', 'alzate', 'montoya', 'villa',
    'duque', 'velez', 'cano', 'gallego', 'mejia', 'santa', 'uribe', 'marin'
  ];

  private static colombianFirstNames = [
    // Common Colombian first names
    'alejandro', 'alejandra', 'andres', 'andrea', 'carlos', 'carolina', 'daniel', 'daniela',
    'david', 'diana', 'diego', 'gabriela', 'javier', 'jessica', 'jorge', 'juliana',
    'luis', 'luisa', 'maria', 'mario', 'miguel', 'natalia', 'oscar', 'paula',
    'sebastian', 'sofia', 'santiago', 'camila', 'felipe', 'isabella', 'juan', 'valentina'
  ];

  private static colombianCities = [
    'bogota', 'medellin', 'cali', 'barranquilla', 'cartagena', 'cucuta', 'bucaramanga',
    'pereira', 'ibague', 'santa marta', 'manizales', 'villavicencio', 'armenia', 'neiva',
    'soledad', 'soacha', 'pasto', 'monteria', 'valledupar', 'buenaventura'
  ];

  static detectColombianOrigin(person: any): {
    isColombianOrigin: boolean;
    confidence: number;
    indicators: string[];
  } {
    const indicators: string[] = [];
    let score = 0;

    const firstName = person.firstName?.toLowerCase() || '';
    const lastName = person.lastName?.toLowerCase() || '';
    const fullName = person.fullName?.toLowerCase() || '';
    const location = person.location?.toLowerCase() || '';
    
    // Check education history for Colombian schools/locations
    const educationHistory = person.educationHistory || [];
    const workHistory = person.workHistory || [];

    // Name pattern analysis (30 points)
    if (this.colombianSurnames.some(surname => lastName.includes(surname))) {
      score += 30;
      indicators.push('Colombian surname pattern');
    }

    if (this.colombianFirstNames.some(name => firstName.includes(name))) {
      score += 15;
      indicators.push('Colombian first name pattern');
    }

    // Education location analysis (40 points - strongest indicator)
    const colombianEducation = educationHistory.some((edu: any) => {
      const eduLocation = edu.location?.toLowerCase() || '';
      const schoolName = edu.school?.toLowerCase() || '';
      return this.colombianCities.some(city => eduLocation.includes(city)) ||
             schoolName.includes('colombia') ||
             schoolName.includes('nacional') ||
             schoolName.includes('javeriana') ||
             schoolName.includes('andes') ||
             schoolName.includes('externado');
    });

    if (colombianEducation) {
      score += 40;
      indicators.push('Colombian university/education');
    }

    // Work history analysis (25 points)
    const colombianWorkHistory = workHistory.some((work: any) => {
      const workLocation = work.location?.toLowerCase() || '';
      return this.colombianCities.some(city => workLocation.includes(city));
    });

    if (colombianWorkHistory) {
      score += 25;
      indicators.push('Colombian work history');
    }

    // Current location (lower weight, as they may have moved)
    if (this.colombianCities.some(city => location.includes(city))) {
      score += 10;
      indicators.push('Currently in Colombia');
    }

    // Spanish language indicators
    const hasSpanishSkills = person.metadata?.skills?.some((skill: string) => 
      skill.toLowerCase().includes('spanish') || skill.toLowerCase().includes('español')
    );
    
    if (hasSpanishSkills) {
      score += 10;
      indicators.push('Spanish language skills');
    }

    const confidence = Math.min(score, 100);
    const isColombianOrigin = confidence >= 50; // Threshold for Colombian origin

    return {
      isColombianOrigin,
      confidence,
      indicators
    };
  }

  static filterColombianCandidates(leads: Lead[], minConfidence: number = 50): Lead[] {
    return leads
      .map(lead => {
        const detection = this.detectColombianOrigin(lead);
        
        if (detection.isColombianOrigin && detection.confidence >= minConfidence) {
          // Add Colombian origin metadata
          lead.metadata = {
            ...lead.metadata,
            colombianOrigin: {
              confidence: detection.confidence,
              indicators: detection.indicators,
              detected: true
            }
          };
          return lead;
        }
        
        return null;
      })
      .filter((lead): lead is Lead => lead !== null);
  }
}

// Big Tech Company Intelligence
export class BigTechIntelligence {
  private static bigTechCompanies = {
    // FAANG + Major Tech
    'google': {
      names: ['Google', 'Alphabet', 'YouTube', 'DeepMind', 'Waymo', 'Verily'],
      domains: ['google.com', 'alphabet.com', 'youtube.com'],
      employeeRange: '100000+',
      industry: 'computer_software'
    },
    'apple': {
      names: ['Apple', 'Apple Inc'],
      domains: ['apple.com'],
      employeeRange: '100000+',
      industry: 'consumer_electronics'
    },
    'meta': {
      names: ['Meta', 'Facebook', 'Instagram', 'WhatsApp', 'Reality Labs'],
      domains: ['meta.com', 'facebook.com'],
      employeeRange: '50000+',
      industry: 'internet'
    },
    'amazon': {
      names: ['Amazon', 'AWS', 'Amazon Web Services', 'Twitch', 'Whole Foods'],
      domains: ['amazon.com', 'aws.amazon.com'],
      employeeRange: '1000000+',
      industry: 'internet'
    },
    'netflix': {
      names: ['Netflix'],
      domains: ['netflix.com'],
      employeeRange: '10000+',
      industry: 'entertainment'
    },
    'microsoft': {
      names: ['Microsoft', 'LinkedIn', 'GitHub', 'Xbox', 'Azure'],
      domains: ['microsoft.com', 'linkedin.com', 'github.com'],
      employeeRange: '200000+',
      industry: 'computer_software'
    },
    'tesla': {
      names: ['Tesla', 'SpaceX'],
      domains: ['tesla.com', 'spacex.com'],
      employeeRange: '100000+',
      industry: 'automotive'
    },
    'uber': {
      names: ['Uber', 'Uber Technologies'],
      domains: ['uber.com'],
      employeeRange: '25000+',
      industry: 'internet'
    },
    'airbnb': {
      names: ['Airbnb'],
      domains: ['airbnb.com'],
      employeeRange: '5000+',
      industry: 'internet'
    },
    'stripe': {
      names: ['Stripe'],
      domains: ['stripe.com'],
      employeeRange: '4000+',
      industry: 'financial_services'
    },
    // Bay Area Tech
    'salesforce': {
      names: ['Salesforce'],
      domains: ['salesforce.com'],
      employeeRange: '70000+',
      industry: 'computer_software'
    },
    'twitter': {
      names: ['Twitter', 'X Corp'],
      domains: ['twitter.com', 'x.com'],
      employeeRange: '7500+',
      industry: 'internet'
    },
    'snap': {
      names: ['Snap Inc', 'Snapchat'],
      domains: ['snap.com'],
      employeeRange: '5000+',
      industry: 'internet'
    },
    'pinterest': {
      names: ['Pinterest'],
      domains: ['pinterest.com'],
      employeeRange: '3000+',
      industry: 'internet'
    }
  };

  static expandBigTechCriteria(criteria: SearchCriteria): SearchCriteria {
    const expanded = { ...criteria };

    // Check if user mentioned "big tech" or similar terms
    const bigTechKeywords = ['big tech', 'faang', 'tech giants', 'major tech', 'large tech'];
    const mentionsBigTech = criteria.keywords?.some(keyword => 
      bigTechKeywords.some(bigTechTerm => keyword.toLowerCase().includes(bigTechTerm))
    ) || criteria.industry?.toLowerCase().includes('big tech');

    if (mentionsBigTech) {
      // Expand to all big tech companies
      const allBigTechNames = Object.values(this.bigTechCompanies)
        .flatMap(company => company.names);
      
      expanded.companies = [...(expanded.companies || []), ...allBigTechNames];
      expanded.employeeCountRanges = ['10000+', '50000+', '100000+'];
      expanded.companyIndustries = ['computer_software', 'internet', 'consumer_electronics'];
    }

    // Bay Area specific expansion
    if (criteria.location?.toLowerCase().includes('bay area') || 
        criteria.locations?.some(loc => loc.toLowerCase().includes('bay area'))) {
      
      expanded.locations = [
        'San Francisco, CA',
        'Palo Alto, CA', 
        'Mountain View, CA',
        'Menlo Park, CA',
        'Cupertino, CA',
        'Redwood City, CA',
        'San Jose, CA',
        'Sunnyvale, CA',
        'Fremont, CA'
      ];
    }

    return expanded;
  }

  static getBigTechCompanyNames(): string[] {
    return Object.values(this.bigTechCompanies).flatMap(company => company.names);
  }

  static isBigTechCompany(companyName: string): boolean {
    const normalizedName = companyName.toLowerCase();
    return Object.values(this.bigTechCompanies).some(company =>
      company.names.some(name => name.toLowerCase().includes(normalizedName) || 
                               normalizedName.includes(name.toLowerCase()))
    );
  }
}

// Hunter.io API Integration
export class HunterAPIService {
  private apiKey: string;
  private baseUrl = 'https://api.hunter.io/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchDomain(criteria: { domain?: string; company?: string; seniority?: string; department?: string; emailType?: string; limit?: number }): Promise<Lead[]> {
    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        limit: String(criteria.limit || 10)
      });
      
      // Hunter.io requires either domain OR company
      if (criteria.domain) {
        params.append('domain', criteria.domain);
      } else if (criteria.company) {
        params.append('company', criteria.company);
      } else {
        throw new Error('Hunter.io requires either domain or company parameter');
      }
      
      // Add optional Hunter.io specific filters
      if (criteria.seniority) params.append('seniority', criteria.seniority);
      if (criteria.department) params.append('department', criteria.department);
      if (criteria.emailType) params.append('type', criteria.emailType);

      const response = await fetch(`${this.baseUrl}/domain-search?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Hunter API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`Hunter API error: ${data.errors[0].details}`);
      }

      return data.data.emails.map((email: any): Lead => ({
        email: email.value,
        firstName: email.first_name,
        lastName: email.last_name,
        fullName: `${email.first_name || ''} ${email.last_name || ''}`.trim(),
        company: data.data.organization,
        jobTitle: email.position,
        linkedinUrl: email.linkedin,
        phoneNumber: email.phone_number,
        source: 'hunter',
        confidence: email.confidence,
        verified: email.verification?.result === 'deliverable',
        metadata: {
          department: email.department,
          seniority: email.seniority,
          sources: email.sources,
        },
      }));
    } catch (error) {
      console.error('Hunter API error:', error);
      throw error;
    }
  }

  async findEmail(firstName: string, lastName: string, domain: string): Promise<Lead | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Hunter API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`Hunter API error: ${data.errors[0].details}`);
      }

      if (!data.data.email) {
        return null;
      }

      return {
        email: data.data.email,
        firstName: data.data.first_name,
        lastName: data.data.last_name,
        fullName: `${data.data.first_name || ''} ${data.data.last_name || ''}`.trim(),
        source: 'hunter',
        confidence: data.data.confidence,
        verified: data.data.verification?.result === 'deliverable',
        metadata: {
          position: data.data.position,
          department: data.data.department,
          sources: data.data.sources,
        },
      };
    } catch (error) {
      console.error('Hunter email finder error:', error);
      throw error;
    }
  }

  async verifyEmail(email: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/email-verifier?email=${email}&api_key=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`Hunter API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data.result === 'deliverable';
    } catch (error) {
      console.error('Hunter email verification error:', error);
      return false;
    }
  }
}

// Apollo.io API Integration
export class ApolloAPIService {
  private apiKey: string;
  private baseUrl = 'https://api.apollo.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchPeople(criteria: SearchCriteria): Promise<Lead[]> {
    try {
      // Start with basic required parameters (API key goes in header, not body)
      const searchData: any = {
        page: 1,
        per_page: criteria.limit || 10,
      };

      // Add only FREE TIER compatible parameters
      
      // Job title filter (FREE TIER: supported)
      if (criteria.jobTitle) {
        searchData.person_titles = [criteria.jobTitle];
      }

      // Location filters
      const locations = criteria.locations && criteria.locations.length > 0 
        ? criteria.locations 
        : criteria.location ? [criteria.location] : null;
        
      if (locations && locations.length > 0) {
        searchData.person_locations = locations;
      }

      // Company filters
      const companies = criteria.companies && criteria.companies.length > 0 
        ? criteria.companies 
        : criteria.company ? [criteria.company] : null;
        
      if (companies && companies.length > 0) {
        searchData.organization_names = companies;
      }

      // Industry filters (map to Apollo industry IDs)
      if (criteria.companyIndustries && criteria.companyIndustries.length > 0) {
        const industryIds = this.mapIndustriesToIds(criteria.companyIndustries);
        if (industryIds.length > 0) {
          searchData.person_industry_tag_ids = industryIds;
        }
      } else if (criteria.industry) {
        const industryIds = this.mapIndustriesToIds([criteria.industry]);
        if (industryIds.length > 0) {
          searchData.person_industry_tag_ids = industryIds;
        }
      }
      
      // Employee count ranges
      if (criteria.employeeCountRanges && criteria.employeeCountRanges.length > 0) {
        searchData.organization_num_employees_ranges = criteria.employeeCountRanges;
      }
      
      // Seniority levels
      if (criteria.seniority) {
        const seniorityMap: Record<string, string[]> = {
          'entry': ['individual_contributor'],
          'mid': ['manager'],
          'senior': ['director', 'vp'],
          'executive': ['c_suite', 'founder', 'owner']
        };
        const seniorityLevels = seniorityMap[criteria.seniority.toLowerCase()];
        if (seniorityLevels) {
          searchData.person_seniorities = seniorityLevels;
        }
      }
      
      // Education filters
      if (criteria.schools && criteria.schools.length > 0) {
        searchData.person_schools = criteria.schools;
      }
      
      console.log('🚀 Using full Apollo API parameters for basic+ plan');

      // Remove any undefined or empty array values that might cause 422
      Object.keys(searchData).forEach(key => {
        if (searchData[key] === undefined || searchData[key] === null || 
           (Array.isArray(searchData[key]) && searchData[key].length === 0)) {
          delete searchData[key];
        }
      });

      console.log('🚀 Safe Apollo search with parameters:', JSON.stringify(searchData, null, 2));

      const response = await fetch(`${this.baseUrl}/people/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey
        },
        body: JSON.stringify(searchData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Apollo API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          requestParams: JSON.stringify(searchData, null, 2)
        });
        
        // Try a simplified request if the enhanced request failed with 422
        if (response.status === 422) {
          console.log('🔄 Trying simplified Apollo request...');
          return await this.searchPeopleSimplified(criteria);
        }
        
        // If Apollo is on free tier (403), return empty array to continue to other APIs
        if (response.status === 403 && errorText.includes('free plan')) {
          console.log('⚠️ Apollo.io free tier limitation - continuing to other APIs');
          return [];
        }
        
        throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return data.people
        .map((person: any): Lead | null => {
          // Skip people without emails (as per requirement)
          if (!person.email || person.email.trim() === '') {
            return null;
          }

          return {
            email: person.email,
            firstName: person.first_name,
            lastName: person.last_name,
            fullName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
            company: person.organization?.name,
            jobTitle: person.title,
            linkedinUrl: person.linkedin_url,
            phoneNumber: person.sanitized_phone,
            location: person.city,
            source: 'apollo',
            verified: person.email_status === 'verified',
            educationHistory: person.education?.map((edu: any) => ({
              school: edu.school_name,
              degree: edu.degree,
              field: edu.field,
              startDate: edu.start_date,
              endDate: edu.end_date,
              location: edu.location,
            })) || [],
            workHistory: person.experience?.map((exp: any) => ({
              company: exp.organization_name,
              title: exp.title,
              startDate: exp.start_date,
              endDate: exp.end_date,
              location: exp.location,
            })) || [],
            metadata: {
              organizationId: person.organization?.id,
              industry: person.organization?.industry,
              employeeCount: person.organization?.estimated_num_employees,
              departments: person.departments,
              seniority: person.seniority,
              apolloId: person.id,
              confidence: person.email_status === 'verified' ? 0.95 : 0.7,
            },
          };
        })
        .filter((lead): lead is Lead => lead !== null);
    } catch (error) {
      console.error('Apollo API error:', error);
      throw error;
    }
  }

  // Simplified fallback method when enhanced search fails
  private async searchPeopleSimplified(criteria: SearchCriteria): Promise<Lead[]> {
    try {
      // Use only basic, safe parameters (API key goes in header)
      const searchData: any = {
        page: 1,
        per_page: criteria.limit || 10,
      };

      // Only add FREE TIER compatible filters
      if (criteria.jobTitle) {
        searchData.person_titles = [criteria.jobTitle];
      }

      // Basic location filter (broad for free tier)
      if (criteria.location && criteria.location.toLowerCase().includes('berkeley')) {
        searchData.person_locations = ['California, United States'];
      } else if (criteria.location) {
        searchData.person_locations = [criteria.location];
      }

      // Basic company filter (single company only for free tier)
      if (criteria.company) {
        searchData.organization_names = [criteria.company];
      }

      console.log('🔄 Simplified Apollo search with parameters:', JSON.stringify(searchData, null, 2));

      const response = await fetch(`${this.baseUrl}/people/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify(searchData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Simplified Apollo API Error:', response.status, errorText);
        return []; // Return empty array instead of throwing to allow other services to try
      }

      const data: any = await response.json();
      return data.people
        ?.map((person: any): Lead | null => {
          if (!person.email) {
            return null;
          }

          return {
            email: person.email,
            firstName: person.first_name,
            lastName: person.last_name,
            fullName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
            company: person.organization?.name,
            jobTitle: person.title,
            linkedinUrl: person.linkedin_url,
            phoneNumber: person.sanitized_phone,
            location: person.city,
            source: 'apollo',
            verified: person.email_status === 'verified',
            metadata: {
              apolloId: person.id,
              confidence: person.email_status === 'verified' ? 0.9 : 0.6,
              simplified: true,
            },
          };
        })
        .filter((lead): lead is Lead => lead !== null) || [];
    } catch (error) {
      console.error('Simplified Apollo search error:', error);
      return [];
    }
  }

  private mapIndustriesToIds(industries: string[]): string[] {
    // Apollo industry mapping - these are common Apollo industry tag IDs
    const industryMap: Record<string, string> = {
      'technology': 'computer_software',
      'software': 'computer_software', 
      'tech': 'computer_software',
      'internet': 'internet',
      'fintech': 'financial_services',
      'finance': 'financial_services',
      'banking': 'banking',
      'healthcare': 'hospital_health_care',
      'consulting': 'management_consulting',
      'marketing': 'marketing_advertising',
      'sales': 'computer_software', // Often tech sales
      'artificial intelligence': 'computer_software',
      'ai': 'computer_software',
      'saas': 'computer_software',
      'big tech': 'computer_software',
    };

    return industries
      .map(industry => industryMap[industry.toLowerCase()] || industry.toLowerCase())
      .filter(Boolean);
  }

  async enrichPerson(email: string): Promise<Lead | null> {
    try {
      const response = await fetch(`${this.baseUrl}/people/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          email: email,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Apollo Enrich API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          requestParams: JSON.stringify({ email }, null, 2)
        });
        throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.person) {
        return null;
      }

      const person = data.person;
      return {
        email: person.email,
        firstName: person.first_name,
        lastName: person.last_name,
        fullName: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
        company: person.organization?.name,
        jobTitle: person.title,
        linkedinUrl: person.linkedin_url,
        phoneNumber: person.sanitized_phone,
        location: person.city,
        source: 'apollo',
        verified: person.email_status === 'verified',
        metadata: {
          organizationId: person.organization?.id,
          industry: person.organization?.industry,
          employeeCount: person.organization?.estimated_num_employees,
        },
      };
    } catch (error) {
      console.error('Apollo enrichment error:', error);
      throw error;
    }
  }
}

// Snov.io API Integration
export class SnovAPIService {
  private apiKey: string;
  private clientId: string;
  private baseUrl = 'https://api.snov.io/v1';

  constructor(apiKey: string, clientId: string) {
    this.apiKey = apiKey;
    this.clientId = clientId;
  }

  private async getAccessToken(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`Snov.io auth error: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async searchEmails(domain: string, limit = 10): Promise<Lead[]> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/domain-emails-with-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          domain: domain,
          type: 'all',
          limit: limit,
        }),
      });

      if (!response.ok) {
        throw new Error(`Snov.io API error: ${response.status}`);
      }

      const data = await response.json();

      return data.emails.map((email: any): Lead => ({
        email: email.email,
        firstName: email.firstName,
        lastName: email.lastName,
        fullName: `${email.firstName || ''} ${email.lastName || ''}`.trim(),
        company: data.companyName,
        jobTitle: email.position,
        linkedinUrl: email.socialLinks?.linkedin,
        source: 'snov',
        verified: email.status === 'valid',
        metadata: {
          department: email.department,
          socialLinks: email.socialLinks,
          lastUpdate: email.lastUpdate,
        },
      }));
    } catch (error) {
      console.error('Snov.io API error:', error);
      throw error;
    }
  }

  async findEmail(firstName: string, lastName: string, domain: string): Promise<Lead | null> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/email-finder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          firstName: firstName,
          lastName: lastName,
          domain: domain,
        }),
      });

      if (!response.ok) {
        throw new Error(`Snov.io API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.email) {
        return null;
      }

      return {
        email: data.email,
        firstName: firstName,
        lastName: lastName,
        fullName: `${firstName} ${lastName}`,
        source: 'snov',
        verified: data.status === 'valid',
        metadata: {
          score: data.score,
        },
      };
    } catch (error) {
      console.error('Snov.io email finder error:', error);
      throw error;
    }
  }
}

// People Data Labs API Integration  
export class PDLAPIService {
  private apiKey: string;
  private baseUrl = 'https://api.peopledatalabs.com/v5';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private inferCountryOfOrigin(profile: any): { country: string; confidence: number; reasoning: string } | undefined {
    // Try to infer country from education history (strongest indicator)
    if (profile.education && profile.education.length > 0) {
      const earlyEducation = profile.education
        .filter((edu: any) => edu.start_date)
        .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0];
      
      if (earlyEducation?.location_names?.[0]) {
        const location = earlyEducation.location_names[0];
        const country = this.extractCountryFromLocation(location);
        if (country) {
          return {
            country,
            confidence: 90,
            reasoning: `Early education at ${earlyEducation.school?.name} in ${location}`
          };
        }
      }
    }

    // Try to infer from early work experience
    if (profile.experience && profile.experience.length > 0) {
      const earlyWork = profile.experience
        .filter((exp: any) => exp.start_date)
        .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
        .slice(0, 2); // First 2 jobs
      
      for (const work of earlyWork) {
        if (work.location_names?.[0]) {
          const location = work.location_names[0];
          const country = this.extractCountryFromLocation(location);
          if (country) {
            return {
              country,
              confidence: 70,
              reasoning: `Early career at ${work.company?.name} in ${location}`
            };
          }
        }
      }
    }

    // Try to infer from name (fallback)
    if (profile.full_name) {
      // This would require integration with Nationalize.io API
      return {
        country: 'unknown',
        confidence: 30,
        reasoning: 'Could not determine from education or work history'
      };
    }

    return undefined;
  }

  private extractCountryFromLocation(location: string): string | null {
    // Simple country extraction - could be enhanced with a proper location API
    const countryMappings: Record<string, string> = {
      'United States': 'US',
      'USA': 'US',
      'US': 'US',
      'Canada': 'CA',
      'United Kingdom': 'GB',
      'UK': 'GB',
      'Germany': 'DE',
      'France': 'FR',
      'Spain': 'ES',
      'Italy': 'IT',
      'Japan': 'JP',
      'China': 'CN',
      'India': 'IN',
      'Brazil': 'BR',
      'Australia': 'AU',
    };

    for (const [country, code] of Object.entries(countryMappings)) {
      if (location.toLowerCase().includes(country.toLowerCase())) {
        return code;
      }
    }

    // Extract last part of location (usually country)
    const parts = location.split(',').map(p => p.trim());
    const lastPart = parts[parts.length - 1];
    return countryMappings[lastPart] || lastPart;
  }

  async searchPeople(criteria: SearchCriteria): Promise<Lead[]> {
    try {
      // PDL API uses Elasticsearch query format
      const mustConditions = [];

      // Add search filters based on criteria
      if (criteria.education) {
        // Try both exact match and wildcard search for education
        mustConditions.push({
          bool: {
            should: [
              { term: { "education.school.name": criteria.education.toLowerCase() }},
              { wildcard: { "education.school.name": `*${criteria.education.toLowerCase().split(' ')[0]}*` }},
              { match: { "education.school.name": criteria.education.toLowerCase() }}
            ]
          }
        });
      }

      if (criteria.jobTitle) {
        mustConditions.push({
          bool: {
            should: [
              { match: { "job_title": criteria.jobTitle }},
              { term: { "job_title_role": criteria.jobTitle.toLowerCase() }}
            ]
          }
        });
      }

      if (criteria.industry) {
        // Map common industry terms to PDL's specific values
        const industryMappings: Record<string, string> = {
          'software': 'computer software',
          'tech': 'computer software',
          'technology': 'computer software',
          'it': 'information technology and services',
          'internet': 'internet',
          'fintech': 'financial services',
          'healthcare': 'hospital & health care',
          'finance': 'financial services',
          'consulting': 'management consulting',
          'marketing': 'marketing and advertising',
          'sales': 'computer software', // Often tech sales
        };
        
        const mappedIndustry = industryMappings[criteria.industry.toLowerCase()] || criteria.industry.toLowerCase();
        
        mustConditions.push({
          term: { "job_company_industry": mappedIndustry }
        });
      }

      if (criteria.company) {
        mustConditions.push({
          bool: {
            should: [
              { match: { "job_company_name": criteria.company }},
              { wildcard: { "job_company_name": `*${criteria.company.toLowerCase()}*` }}
            ]
          }
        });
      }

      if (criteria.location || criteria.currentLocation) {
        const location = criteria.currentLocation || criteria.location;
        
        // Clean location string - remove state abbreviations and extra formatting
        const cleanLocation = location
          ?.toLowerCase()
          .replace(/,\s*(ca|california|ny|new york|tx|texas|fl|florida)/g, '') // Remove common state abbreviations
          .trim();
        
        mustConditions.push({
          bool: {
            should: [
              { match: { "location_locality": cleanLocation }},
              { match: { "location_region": location?.toLowerCase() }},
              { match: { "location_country": location?.toLowerCase() }}
            ]
          }
        });
      }

      // If no conditions, search for basic professionals (remove technology filter for testing)
      if (mustConditions.length === 0) {
        // Add a very basic filter to get some results
        mustConditions.push({
          exists: { "field": "emails" }
        });
      }

      const searchParams = {
        query: {
          bool: {
            must: mustConditions
          }
        },
        size: criteria.limit || 10
      };

      console.log('PDL API Request:', JSON.stringify(searchParams, null, 2));
      
      const response = await fetch(`${this.baseUrl}/person/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('PDL API Error Response:', response.status, errorBody);
        
        // Handle 404 as "no results found" rather than an error
        if (response.status === 404) {
          console.log('PDL API returned no results (404)');
          return [];
        }
        
        throw new Error(`PDL API error: ${response.status} - ${errorBody}`);
      }

      const data: any = await response.json();

      console.log('PDL API Response Status:', response.status);
      console.log('PDL API Response Data:', JSON.stringify(data, null, 2));

      if (!data.data || data.data.length === 0) {
        console.log('PDL API returned no results');
        return [];
      }

      console.log(`PDL API found ${data.data.length} results`);
      
      // Check if PDL is only returning metadata (not actual PII like emails)
      const samplePerson = data.data[0];
      if (samplePerson && typeof samplePerson.emails === 'boolean') {
        console.log('⚠️ PDL API is only returning metadata (no PII access). Email fields are boolean flags.');
        console.log('This typically means the API key has limited access. Results will be filtered out.');
      }
      
      return data.data
        .map((person: any): Lead | null => {
          const inferredOrigin = this.inferCountryOfOrigin(person);
          
          // PDL API may not return actual email addresses in free tier
          // Check for various email field formats in PDL response
          let extractedEmail = '';
          
          // Handle different email field structures
          if (person.emails && Array.isArray(person.emails) && person.emails.length > 0) {
            const emailEntry = person.emails[0];
            extractedEmail = typeof emailEntry === 'object' ? emailEntry.address : emailEntry;
          } else if (person.personal_emails && Array.isArray(person.personal_emails) && person.personal_emails.length > 0) {
            extractedEmail = person.personal_emails[0];
          } else if (person.work_email && typeof person.work_email === 'string') {
            extractedEmail = person.work_email;
          } else if (person.recommended_personal_email && typeof person.recommended_personal_email === 'string') {
            extractedEmail = person.recommended_personal_email;
          }
          
          // Skip leads without email addresses or if email is not a string
          if (!extractedEmail || typeof extractedEmail !== 'string' || extractedEmail.trim() === '') {
            console.log('Skipping lead without valid email:', person.full_name, 'email fields:', {
              emails: person.emails,
              personal_emails: person.personal_emails,
              work_email: person.work_email,
              recommended_personal_email: person.recommended_personal_email
            });
            return null;
          }
          
          return {
            email: extractedEmail,
          firstName: person.first_name,
          lastName: person.last_name,
          fullName: person.full_name,
          company: person.job_company_name,
          jobTitle: person.job_title,
          linkedinUrl: person.linkedin_url,
          phoneNumber: person.phone_numbers?.[0],
          location: person.location_name,
          source: 'pdl',
          countryOfOrigin: inferredOrigin?.country,
          inferredOrigin,
          educationHistory: person.education?.map((edu: any) => ({
            school: edu.school?.name || '',
            degree: edu.degrees?.[0],
            field: edu.majors?.[0],
            startDate: edu.start_date,
            endDate: edu.end_date,
            location: edu.location_names?.[0],
          })) || [],
          workHistory: person.experience?.map((exp: any) => ({
            company: exp.company?.name || '',
            title: exp.title?.name || '',
            startDate: exp.start_date,
            endDate: exp.end_date,
            location: exp.location_names?.[0],
          })) || [],
          metadata: {
            pdl_id: person.id,
            job_last_changed: person.job_last_changed,
            job_last_verified: person.job_last_verified,
            inferred_years_experience: person.inferred_years_experience,
            skills: person.skills,
            interests: person.interests,
          },
        };
      })
      .filter((lead): lead is Lead => lead !== null); // Filter out null results (leads without emails)
    } catch (error) {
      console.error('PDL API error:', error);
      throw error;
    }
  }

  async enrichPerson(email: string): Promise<Lead | null> {
    try {
      const response = await fetch(`${this.baseUrl}/person/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          email: email,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`PDL API error: ${response.status}`);
      }

      const person = await response.json();
      const inferredOrigin = this.inferCountryOfOrigin(person);

      return {
        email: person.emails?.[0]?.address || email,
        firstName: person.first_name,
        lastName: person.last_name,
        fullName: person.full_name,
        company: person.job_company_name,
        jobTitle: person.job_title,
        linkedinUrl: person.linkedin_url,
        phoneNumber: person.phone_numbers?.[0],
        location: person.location_name,
        source: 'pdl',
        countryOfOrigin: inferredOrigin?.country,
        inferredOrigin,
        educationHistory: person.education?.map((edu: any) => ({
          school: edu.school?.name || '',
          degree: edu.degrees?.[0],
          field: edu.majors?.[0],
          startDate: edu.start_date,
          endDate: edu.end_date,
          location: edu.location_names?.[0],
        })) || [],
        workHistory: person.experience?.map((exp: any) => ({
          company: exp.company?.name || '',
          title: exp.title?.name || '',
          startDate: exp.start_date,
          endDate: exp.end_date,
          location: exp.location_names?.[0],
        })) || [],
        metadata: {
          pdl_id: person.id,
          job_last_changed: person.job_last_changed,
          job_last_verified: person.job_last_verified,
          inferred_years_experience: person.inferred_years_experience,
          skills: person.skills,
          interests: person.interests,
        },
      };
    } catch (error) {
      console.error('PDL enrichment error:', error);
      throw error;
    }
  }

  // AI-powered natural language search
  async searchPeopleWithAI(userRequest: string, aiModel: any): Promise<Lead[]> {
    try {
      console.log('🤖 Parsing user request with AI:', userRequest);
      
      // Parse the natural language request into PDL search criteria
      const parsedCriteria = await parseUserRequestToPDLCriteria(userRequest, aiModel);
      
      console.log('🔍 AI-parsed search criteria:', JSON.stringify(parsedCriteria, null, 2));
      
      // Execute the search using the parsed query
      const searchParams = {
        query: parsedCriteria.query,
        size: parsedCriteria.size || 10
      };

      console.log('PDL AI Query Request:', JSON.stringify(searchParams, null, 2));
      
      const response = await fetch(`${this.baseUrl}/person/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('PDL AI Search Error Response:', response.status, errorBody);
        
        // Handle 404 as "no results found" rather than an error
        if (response.status === 404) {
          console.log('PDL AI Search returned no results (404)');
          // Try a simplified query with just basic terms
          console.log('🔄 Trying simplified query...');
          const simplifiedQuery = this.createSimplifiedQuery(parsedCriteria, userRequest);
          
          const simpleResponse = await fetch(`${this.baseUrl}/person/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': this.apiKey,
            },
            body: JSON.stringify(simplifiedQuery),
          });

          if (simpleResponse.ok) {
            const simpleData = await simpleResponse.json();
            return this.processSearchResults(simpleData, `Simplified search for: ${userRequest}`);
          }
          
          return [];
        }
        
        // Try alternative queries if main query fails
        if (parsedCriteria.alternative_queries && parsedCriteria.alternative_queries.length > 0) {
          console.log('🔄 Trying alternative query...');
          const altQuery = parsedCriteria.alternative_queries[0];
          const altSearchParams = { query: altQuery.query, size: parsedCriteria.size || 10 };
          
          const altResponse = await fetch(`${this.baseUrl}/person/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': this.apiKey,
            },
            body: JSON.stringify(altSearchParams),
          });

          if (!altResponse.ok) {
            // Handle 404 in alternative query too
            if (altResponse.status === 404) {
              console.log('PDL AI Alternative Search returned no results (404)');
              return [];
            }
            throw new Error(`PDL AI search failed: ${response.status} - ${errorBody}`);
          }

          const altData: any = await altResponse.json();
          return this.processSearchResults(altData, `Alternative query: ${altQuery.reasoning}`);
        }
        
        throw new Error(`PDL AI search failed: ${response.status} - ${errorBody}`);
      }

      const data: any = await response.json();
      return this.processSearchResults(data, parsedCriteria.reasoning);

    } catch (error) {
      console.error('PDL AI search error:', error);
      throw error;
    }
  }

  private processSearchResults(data: any, reasoning: string): Lead[] {
    console.log('PDL AI Search Response Status: Success');
    console.log('Search Reasoning:', reasoning);
    
    if (!data.data || data.data.length === 0) {
      console.log('PDL AI Search returned no results');
      return [];
    }

    console.log(`PDL AI Search found ${data.data.length} results`);
    
    return data.data
      .map((person: any): Lead | null => {
        const inferredOrigin = this.inferCountryOfOrigin(person);
        
        // Extract email using same logic as regular search
        let extractedEmail = '';
        
        // Handle different email field structures
        if (person.emails && Array.isArray(person.emails) && person.emails.length > 0) {
          const emailEntry = person.emails[0];
          extractedEmail = typeof emailEntry === 'object' ? emailEntry.address : emailEntry;
        } else if (person.personal_emails && Array.isArray(person.personal_emails) && person.personal_emails.length > 0) {
          extractedEmail = person.personal_emails[0];
        } else if (person.work_email && typeof person.work_email === 'string') {
          extractedEmail = person.work_email;
        } else if (person.recommended_personal_email && typeof person.recommended_personal_email === 'string') {
          extractedEmail = person.recommended_personal_email;
        }
        
        // Skip leads without email addresses or if email is not a string
        if (!extractedEmail || typeof extractedEmail !== 'string' || extractedEmail.trim() === '') {
          return null;
        }
        
        return {
          email: extractedEmail,
        firstName: person.first_name,
        lastName: person.last_name,
        fullName: person.full_name,
        company: person.job_company_name,
        jobTitle: person.job_title,
        linkedinUrl: person.linkedin_url,
        phoneNumber: person.phone_numbers?.[0],
        location: person.location_name,
        source: 'pdl',
        confidence: 0.85,
        verified: !!person.emails?.[0]?.address,
        countryOfOrigin: inferredOrigin?.country,
        inferredOrigin,
        educationHistory: person.education?.map((edu: any) => ({
          school: edu.school?.name || '',
          degree: edu.degrees?.[0],
          field: edu.majors?.[0],
          startDate: edu.start_date,
          endDate: edu.end_date,
          location: edu.location_names?.[0],
        })) || [],
        workHistory: person.experience?.map((exp: any) => ({
          company: exp.company?.name || '',
          title: exp.title?.name || '',
          startDate: exp.start_date,
          endDate: exp.end_date,
          location: exp.location_names?.[0],
        })) || [],
        metadata: {
          pdl_id: person.id,
          job_last_changed: person.job_last_changed,
          job_last_verified: person.job_last_verified,
          inferred_years_experience: person.inferred_years_experience,
          skills: person.skills,
          interests: person.interests,
          ai_search_reasoning: reasoning,
        },
      };
    })
    .filter((lead): lead is Lead => lead !== null); // Filter out null results (leads without emails)
  }

  private createSimplifiedQuery(parsedCriteria: any, userRequest: string): any {
    // Create a much broader query that's more likely to return results
    const keywords = this.extractKeywordsFromRequest(userRequest);
    
    const mustConditions = [];
    
    // Only add the most basic conditions
    if (keywords.jobTitles.length > 0) {
      mustConditions.push({
        bool: {
          should: keywords.jobTitles.map(title => ({
            wildcard: { "job_title": `*${title.toLowerCase()}*` }
          }))
        }
      });
    }
    
    if (keywords.industries.length > 0) {
      mustConditions.push({
        bool: {
          should: keywords.industries.map(industry => ({
            term: { "job_company_industry": industry }
          }))
        }
      });
    }
    
    // Always ensure we have emails
    mustConditions.push({
      exists: { "field": "emails" }
    });
    
    // If no specific conditions, use a very basic professional query
    if (mustConditions.length === 1) { // Only the emails condition
      mustConditions.push({
        bool: {
          should: [
            { exists: { "field": "job_title" } },
            { exists: { "field": "job_company_name" } }
          ]
        }
      });
    }

    return {
      query: {
        bool: {
          must: mustConditions
        }
      },
      size: 10
    };
  }

  private extractKeywordsFromRequest(userRequest: string): { jobTitles: string[]; industries: string[] } {
    const request = userRequest.toLowerCase();
    
    const jobTitleKeywords = [
      'manager', 'director', 'executive', 'lead', 'head', 'vp', 'ceo', 'cto', 'cfo',
      'engineer', 'developer', 'designer', 'analyst', 'consultant', 'specialist',
      'marketing', 'sales', 'product', 'operations', 'finance', 'hr'
    ];
    
    const industryKeywords = [
      'software', 'technology', 'tech', 'startup', 'saas', 'fintech', 
      'healthcare', 'finance', 'consulting', 'marketing'
    ];
    
    const industryMapping: Record<string, string> = {
      'software': 'computer software',
      'tech': 'computer software',
      'technology': 'computer software',
      'startup': 'computer software',
      'saas': 'computer software',
      'fintech': 'financial services',
      'healthcare': 'hospital & health care',
      'finance': 'financial services',
      'consulting': 'management consulting',
      'marketing': 'marketing and advertising'
    };
    
    const foundJobTitles = jobTitleKeywords.filter(keyword => request.includes(keyword));
    const foundIndustries = industryKeywords
      .filter(keyword => request.includes(keyword))
      .map(keyword => industryMapping[keyword] || keyword);
    
    return {
      jobTitles: foundJobTitles,
      industries: foundIndustries
    };
  }
}

// Main Lead Generation Service
export class LeadGenerationService {
  private hunterService?: HunterAPIService;
  private apolloService?: ApolloAPIService;
  private snovService?: SnovAPIService;
  private pdlService?: PDLAPIService;
  private linkedinService?: LinkedInLeadService;

  constructor(apiKeys: {
    hunterApiKey?: string;
    apolloApiKey?: string;
    snovApiKey?: string;
    snovClientId?: string;
    pdlApiKey?: string;
    // LinkedIn integration options
    linkedinPartnerKey?: string;
    linkedinPartnerToken?: string;
    linkedinSalesNavCookie?: string;
    linkedinSalesNavCsrf?: string;
    linkedinAlternativeProvider?: 'scrap_in' | 'bright_data' | 'apollo' | 'people_data_labs';
    linkedinAlternativeApiKey?: string;
  }) {
    if (apiKeys.hunterApiKey) {
      this.hunterService = new HunterAPIService(apiKeys.hunterApiKey);
    }
    
    if (apiKeys.apolloApiKey) {
      this.apolloService = new ApolloAPIService(apiKeys.apolloApiKey);
    }
    
    if (apiKeys.snovApiKey && apiKeys.snovClientId) {
      this.snovService = new SnovAPIService(apiKeys.snovApiKey, apiKeys.snovClientId);
    }

    if (apiKeys.pdlApiKey) {
      this.pdlService = new PDLAPIService(apiKeys.pdlApiKey);
    }
    
    // Initialize LinkedIn service if any LinkedIn options are provided
    if (apiKeys.linkedinPartnerKey || apiKeys.linkedinSalesNavCookie || apiKeys.linkedinAlternativeProvider) {
      this.linkedinService = new LinkedInLeadService({
        linkedinPartnerKey: apiKeys.linkedinPartnerKey,
        linkedinPartnerToken: apiKeys.linkedinPartnerToken,
        salesNavCookie: apiKeys.linkedinSalesNavCookie,
        salesNavCsrf: apiKeys.linkedinSalesNavCsrf,
        alternativeProvider: apiKeys.linkedinAlternativeProvider,
        alternativeApiKey: apiKeys.linkedinAlternativeApiKey,
      });
    }
  }

  async searchLeads(criteria: SearchCriteria): Promise<{ leads: Lead[]; usage: ApiUsage }> {
    // Enhance criteria with big tech intelligence
    const enhancedCriteria = BigTechIntelligence.expandBigTechCriteria(criteria);
    console.log('🚀 Enhanced search criteria:', JSON.stringify(enhancedCriteria, null, 2));
    
    const allLeads: Lead[] = [];
    const usage: ApiUsage = {};

    // PRIORITY 1: Apollo.io PRIMARY SEARCH (basic+ plan with full features)
    if (this.apolloService && (enhancedCriteria.jobTitle || enhancedCriteria.company || enhancedCriteria.location || enhancedCriteria.schools)) {
      try {
        console.log('🚀 Apollo PRIMARY SEARCH (basic+ plan with full features)');
        const apolloLeads = await this.apolloService.searchPeople(enhancedCriteria);
        
        // Apply Colombian origin filtering if requested
        let filteredApolloLeads = apolloLeads;
        if (criteria.countryOfOrigin === 'CO' || 
            criteria.keywords?.some(k => k.toLowerCase().includes('colombian'))) {
          filteredApolloLeads = apolloLeads.filter(lead => {
            const colombianResult = ColombianDetector.detectColombianOrigin(lead);
            console.log(`🇨🇴 Colombian detection for ${lead.fullName}:`, colombianResult);
            return colombianResult.isColombianOrigin && colombianResult.confidence >= 70;
          });
          console.log(`🇨🇴 Filtered ${apolloLeads.length} leads to ${filteredApolloLeads.length} Colombian candidates`);
        }
        
        // Apply Berkeley/education filtering if requested (post-processing for free tier)
        if (criteria.keywords?.some(k => 
          k.toLowerCase().includes('berkeley') || 
          k.toLowerCase().includes('university') || 
          k.toLowerCase().includes('college')
        )) {
          const educationKeywords = criteria.keywords.filter(k => 
            k.toLowerCase().includes('berkeley') || 
            k.toLowerCase().includes('stanford') ||
            k.toLowerCase().includes('harvard') ||
            k.toLowerCase().includes('university') ||
            k.toLowerCase().includes('college')
          );
          
          if (educationKeywords.length > 0) {
            const beforeEducationFilter = filteredApolloLeads.length;
            filteredApolloLeads = filteredApolloLeads.filter(lead => {
              // Check if any education keyword appears in lead data
              const searchText = `${lead.fullName} ${lead.jobTitle} ${lead.company} ${JSON.stringify(lead.educationHistory)} ${JSON.stringify(lead.metadata)}`.toLowerCase();
              const hasEducationMatch = educationKeywords.some(keyword => 
                searchText.includes(keyword.toLowerCase())
              );
              return hasEducationMatch;
            });
            console.log(`🎓 Education keyword filtering: ${beforeEducationFilter} → ${filteredApolloLeads.length} leads`);
          }
        }
        
        allLeads.push(...filteredApolloLeads);
        usage.apollo = filteredApolloLeads.length;
        
        console.log(`🚀 Apollo PRIMARY found ${filteredApolloLeads.length} leads (${apolloLeads.length} raw)`);
      } catch (error) {
        console.error('Apollo primary search failed:', error);
      }
    }

    // PRIORITY 2: LinkedIn for comprehensive professional search (when Apollo insufficient)
    if (this.linkedinService && allLeads.length < (criteria.limit || 10) && 
        (enhancedCriteria.education || enhancedCriteria.jobTitle || enhancedCriteria.company || enhancedCriteria.location)) {
      try {
        const linkedinCriteria: LinkedInSearchCriteria = {
          schools: enhancedCriteria.schools || (enhancedCriteria.education ? [enhancedCriteria.education] : undefined),
          currentCompanies: enhancedCriteria.companies || (enhancedCriteria.company ? [enhancedCriteria.company] : undefined),
          jobTitles: enhancedCriteria.jobTitle ? [enhancedCriteria.jobTitle] : undefined,
          locations: enhancedCriteria.locations || (enhancedCriteria.location || enhancedCriteria.currentLocation ? [enhancedCriteria.location || enhancedCriteria.currentLocation!] : undefined),
          industries: enhancedCriteria.companyIndustries || (enhancedCriteria.industry ? [enhancedCriteria.industry] : undefined),
          limit: (criteria.limit || 10) - allLeads.length  // Fill remaining slots
        };
        
        console.log('🔗 LinkedIn SUPPLEMENTAL search:', linkedinCriteria);
        const linkedinLeads = await this.linkedinService.searchPeople(linkedinCriteria);
        
        // Convert LinkedIn leads to standard format
        const standardLeads = linkedinLeads.map(convertLinkedInLeadToStandardLead);
        allLeads.push(...standardLeads);
        usage.linkedin = linkedinLeads.length;
        
        console.log(`🔗 LinkedIn supplemental found ${linkedinLeads.length} leads`);
      } catch (error) {
        console.error('LinkedIn supplemental search failed:', error);
      }
    }



    // PRIORITY 3: Hunter for domain/company search (when domain available and need more leads)
    if (this.hunterService && allLeads.length < (criteria.limit || 10) && 
        (criteria.domain || criteria.company)) {
      try {
        console.log('🏹 Hunter DOMAIN search for remaining slots');
        const hunterLeads = await this.hunterService.searchDomain({
          domain: criteria.domain,
          company: criteria.company,
          seniority: criteria.seniority,
          department: criteria.department,
          emailType: criteria.emailType,
          limit: (criteria.limit || 10) - allLeads.length
        });
        allLeads.push(...hunterLeads);
        usage.hunter = hunterLeads.length;
        console.log(`🏹 Hunter domain found ${hunterLeads.length} leads`);
      } catch (error) {
        console.error('Hunter domain search failed:', error);
      }
    }

    // PRIORITY 4: Snov for domain search (final fallback)
    if (this.snovService && allLeads.length < (criteria.limit || 10) && criteria.domain) {
      try {
        console.log('📧 Snov FINAL FALLBACK search');
        const snovLeads = await this.snovService.searchEmails(
          criteria.domain, 
          (criteria.limit || 10) - allLeads.length
        );
        allLeads.push(...snovLeads);
        usage.snov = snovLeads.length;
        console.log(`📧 Snov final fallback found ${snovLeads.length} leads`);
      } catch (error) {
        console.error('Snov final fallback search failed:', error);
      }
    }

    // Remove duplicates based on email address (all leads have emails now)
    const uniqueLeads = allLeads.reduce((acc: Lead[], current) => {
      const existingLead = acc.find(lead => lead.email.toLowerCase() === current.email.toLowerCase());
      if (!existingLead) {
        acc.push(current);
      } else {
        // Merge data from multiple sources, preferring more complete data
        if (current.firstName && !existingLead.firstName) existingLead.firstName = current.firstName;
        if (current.lastName && !existingLead.lastName) existingLead.lastName = current.lastName;
        if (current.company && !existingLead.company) existingLead.company = current.company;
        if (current.jobTitle && !existingLead.jobTitle) existingLead.jobTitle = current.jobTitle;
        if (current.linkedinUrl && !existingLead.linkedinUrl) existingLead.linkedinUrl = current.linkedinUrl;
        if (current.phoneNumber && !existingLead.phoneNumber) existingLead.phoneNumber = current.phoneNumber;
        
        // Merge metadata
        if (current.metadata) {
          existingLead.metadata = { ...existingLead.metadata, ...current.metadata };
        }
      }
      return acc;
    }, []);

    // Filter by education keywords if provided
    let filteredLeads = uniqueLeads;
    if (criteria.keywords && criteria.keywords.length > 0) {
      const educationKeywords = criteria.keywords.filter(k => 
        k.toLowerCase().includes('university') || 
        k.toLowerCase().includes('college') ||
        k.toLowerCase().includes('berkeley') ||
        k.toLowerCase().includes('stanford') ||
        k.toLowerCase().includes('harvard') ||
        k.toLowerCase().includes('mit') ||
        k.toLowerCase().includes('yale') ||
        k.toLowerCase().includes('princeton')
      );
      
      if (educationKeywords.length > 0) {
        filteredLeads = uniqueLeads.filter(lead => {
          // Check if any education keyword appears in lead data
          const searchText = `${lead.fullName} ${lead.jobTitle} ${lead.company} ${JSON.stringify(lead.metadata)}`.toLowerCase();
          return educationKeywords.some(keyword => 
            searchText.includes(keyword.toLowerCase())
          );
        });
      }
    }

    return { leads: filteredLeads, usage };
  }

  async enrichLead(email: string): Promise<Lead | null> {
    // Try PDL enrichment first (best for professional history)
    if (this.pdlService) {
      try {
        const enrichedLead = await this.pdlService.enrichPerson(email);
        if (enrichedLead) return enrichedLead;
      } catch (error) {
        console.error('PDL enrichment failed:', error);
      }
    }

    // Try Apollo enrichment as backup
    if (this.apolloService) {
      try {
        const enrichedLead = await this.apolloService.enrichPerson(email);
        if (enrichedLead) return enrichedLead;
      } catch (error) {
        console.error('Apollo enrichment failed:', error);
      }
    }

    // Try Hunter email verification
    if (this.hunterService) {
      try {
        const verified = await this.hunterService.verifyEmail(email);
        return {
          email,
          source: 'hunter',
          verified,
        };
      } catch (error) {
        console.error('Hunter verification failed:', error);
      }
    }

    return null;
  }

  getAvailableServices(): string[] {
    const services: string[] = [];
    if (this.linkedinService) services.push('linkedin');
    if (this.pdlService) services.push('pdl');
    if (this.hunterService) services.push('hunter');
    if (this.apolloService) services.push('apollo');
    if (this.snovService) services.push('snov');
    return services;
  }

  // AI-powered natural language search (prioritizes PDL when available)
  async searchLeadsWithAI(userRequest: string, aiModel: any): Promise<{ leads: Lead[]; usage: ApiUsage; reasoning?: string }> {
    const usage: ApiUsage = {};
    
    // Prioritize PDL for AI-powered search since it has the most comprehensive data
    if (this.pdlService) {
      try {
        console.log('🤖 Using PDL AI-powered search for:', userRequest);
        const pdlLeads = await this.pdlService.searchPeopleWithAI(userRequest, aiModel);
        usage.pdl = pdlLeads.length;
        
        return { 
          leads: pdlLeads, 
          usage,
          reasoning: pdlLeads[0]?.metadata?.ai_search_reasoning || 'AI-powered PDL search completed'
        };
      } catch (error) {
        console.error('PDL AI search failed:', error);
        throw error;
      }
    }
    
    throw new Error('AI-powered search requires PDL API key. Please configure your PDL API key to use natural language search.');
  }
}