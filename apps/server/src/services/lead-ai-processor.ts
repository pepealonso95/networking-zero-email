import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { SearchCriteria } from './lead-generation-apis';

// Schema for structured search criteria
const searchCriteriaSchema = z.object({
  company: z.string().nullable().optional(),
  domain: z.string().nullable().optional(), 
  jobTitle: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  companySize: z.string().nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  seniority: z.enum(['junior', 'mid', 'senior', 'executive']).nullable().optional(),
  // Enhanced fields for Apollo.io integration
  schools: z.array(z.string()).nullable().optional(),
  degrees: z.array(z.string()).nullable().optional(),
  majors: z.array(z.string()).nullable().optional(),
  locations: z.array(z.string()).nullable().optional(),
  companies: z.array(z.string()).nullable().optional(),
  companyIndustries: z.array(z.string()).nullable().optional(),
  employeeCountRanges: z.array(z.string()).nullable().optional(),
  department: z.string().nullable().optional(),
  emailType: z.enum(['personal', 'generic']).nullable().optional(),
  education: z.string().nullable().optional(),
  countryOfOrigin: z.string().nullable().optional(),
  currentLocation: z.string().nullable().optional(),
  limit: z.number().min(1).max(50).default(10),
});

export interface ProcessedPrompt {
  criteria: SearchCriteria;
  confidence: number;
  explanation: string;
  suggestions: string[];
}

export class LeadAIProcessor {
  private openai;

  constructor() {
    this.openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  getAIModel() {
    return this.openai('o4-mini-2025-04-16');
  }

  async processPrompt(userPrompt: string): Promise<ProcessedPrompt> {
    try {
      const result = await generateText({
        model: this.openai('o4-mini-2025-04-16'),
        messages: [
          {
            role: 'user',
            content: this.buildPromptTemplate(userPrompt),
          },
        ],
        max_completion_tokens: 5000,
        maxRetries: 2,
      });

      // Parse the AI response
      const aiResponse = this.parseAIResponse(result.text);
      
      // Validate the criteria
      const validatedCriteria = searchCriteriaSchema.parse(aiResponse.criteria);

      return {
        criteria: validatedCriteria,
        confidence: aiResponse.confidence,
        explanation: aiResponse.explanation,
        suggestions: aiResponse.suggestions,
      };
    } catch (error) {
      console.error('AI processing error:', error);
      
      // Fallback: Simple keyword extraction
      return this.fallbackProcessing(userPrompt);
    }
  }

  private buildPromptTemplate(userPrompt: string): string {
    return `You are an expert lead generation assistant. Your task is to convert natural language lead requests into structured search criteria for lead generation APIs like Hunter.io, Apollo.io, etc.

User Request: "${userPrompt}"

IMPORTANT: You must be very smart about interpreting common business terminology and convert it to actionable search criteria:

**Company Intelligence:**
- FAANG = Facebook/Meta (meta.com), Apple (apple.com), Amazon (amazon.com), Netflix (netflix.com), Google (google.com)
- Big Tech = Include Microsoft (microsoft.com), Tesla (tesla.com), Uber (uber.com), Airbnb (airbnb.com)
- Unicorns = Companies like Stripe (stripe.com), SpaceX (spacex.com), ByteDance (bytedance.com)
- Always provide the actual domain when you recognize a company

**Job Title Intelligence:**
- "Tech lead" = "Technical Lead", "Lead Engineer", "Engineering Lead", "Tech Lead"
- "Marketing lead" = "Marketing Manager", "Lead Marketing Manager", "Marketing Lead"
- "Sales lead" = "Sales Manager", "Lead Sales Representative", "Sales Lead"
- Map generic titles to specific, searchable job titles

**Location Intelligence:**
- "Bay Area" = "San Francisco, CA", "Palo Alto, CA", "Mountain View, CA", "Cupertino, CA"
- "Silicon Valley" = "Palo Alto, CA", "Mountain View, CA", "Sunnyvale, CA"
- Always be specific about cities and states

**Educational Intelligence:**
- Apollo.io API: EXCELLENT for education filtering with person_schools, person_degrees, person_majors parameters
- People Data Labs (PDL) API: BEST for education + country origin inference
- Hunter.io does NOT filter by education - add schools as keywords for post-processing
- Apollo.io school formats: "University of California, Berkeley", "Stanford University", "MIT", "Harvard University"
- PDL school formats: "university of california berkeley" (lowercase, full name)
- For multiple schools: schools array ["Stanford University", "UC Berkeley", "Harvard University"]
- For degrees: degrees array ["Bachelor", "MBA", "PhD", "Master"] 
- For majors: majors array ["Computer Science", "Business Administration", "Engineering"]

Analyze this request and extract structured information:

1. **Company Information:**
   - Company name (if mentioned or inferred from abbreviations)
   - Company domain (CRITICAL: always provide when you recognize companies)
   - Industry (if mentioned or can be inferred)
   - Company size (startup, small, medium, large, enterprise, or ranges like "1-50", "51-200", "201-1000", "1000+")

2. **Job Title/Role:**
   - Specific, searchable job titles (not generic terms)
   - Job levels (entry, mid, senior, executive)
   - Department (marketing, sales, engineering, etc.)

3. **Location:**
   - Specific city, state, country (not regions)
   - Multiple locations if region mentioned

4. **Additional Keywords (CRITICAL for Education Filtering):**
   - Educational background: Include ALL university variations (e.g., "Berkeley", "UC Berkeley", "University of California Berkeley")
   - Technologies, skills, or other relevant keywords
   - Industry-specific terms
   - NOTE: Since Hunter.io can't filter by education directly, keywords are the ONLY way to find education-based results

5. **Search Strategy:**
   - PRIORITY 1: Apollo.io - BEST for education + company + location + demographic filtering
   - PRIORITY 2: People Data Labs (PDL) - BEST for country origin inference and career history
   - PRIORITY 3: Hunter.io for email discovery (needs domain OR company name)
   - Apollo supports: person_schools, person_degrees, person_majors, current_companies, organization_locations
   - PDL supports: education, job history, location tracking, country inference
   - For education filtering: Use both "schools" array AND "education" string for maximum coverage
   - For company filtering: Use "companies" array for multiple companies, "company" for single company
   - For country of origin: Set "countryOfOrigin" for PDL, use education history patterns for Apollo

Please respond in this exact JSON format:

\`\`\`json
{
  "criteria": {
    "company": "specific company name or null",
    "domain": "company domain like example.com or null", 
    "jobTitle": "specific job title or null",
    "location": "current city, state/country or null",
    "industry": "industry name or null",
    "companySize": "startup|small|medium|large|enterprise|1-50|51-200|201-1000|1000+ or null",
    "seniority": "junior|mid|senior|executive or null",
    "department": "engineering|marketing|sales|hr|finance|operations|etc or null",
    "emailType": "personal|generic or null",
    "education": "University name for PDL filtering or null",
    "countryOfOrigin": "country code for origin filtering or null", 
    "currentLocation": "current location if different from origin or null",
    "keywords": ["relevant", "keywords", "array"] or null,
    "schools": ["University Name 1", "University Name 2"] or null,
    "degrees": ["Bachelor", "MBA", "PhD"] or null,
    "majors": ["Computer Science", "Engineering"] or null,
    "locations": ["San Francisco, CA", "New York, NY"] or null,
    "companies": ["Google", "Apple", "Meta"] or null,
    "companyIndustries": ["Technology", "Software"] or null,
    "employeeCountRanges": ["1000-5000", "5000+"] or null,
    "limit": 10
  },
  "confidence": 85,
  "explanation": "Clear explanation of what you understood from the request",
  "suggestions": [
    "Suggestion to improve search results",
    "Another helpful tip",
    "Third suggestion if applicable"
  ]
}
\`\`\`

CRITICAL Hunter.io Guidelines:
- For Hunter.io to work, you MUST provide either "domain" OR "company" - never leave both null
- If you recognize a well-known company (FAANG, major tech companies), ALWAYS provide the domain
- If company is mentioned but domain unknown, provide the company name - Hunter.io will resolve it
- Hunter.io domain search works with: domain + optional seniority/department filters
- Hunter.io email finder works with: domain + first_name + last_name (but we mainly use domain search)
- If something is not mentioned or unclear, set it to null (except domain/company requirement above)
- Confidence should be 0-100 based on how clear and specific the request was
- Provide 2-3 helpful suggestions for improving the search

Examples:

Request: "Find senior tech leads in FAANG who went to Berkeley and are in the bay area"
Response: 
\`\`\`json
{
  "criteria": {
    "company": null,
    "domain": null,
    "jobTitle": "Technical Lead",
    "location": "San Francisco, CA",
    "industry": "Technology",
    "companySize": "enterprise",
    "seniority": "senior",
    "department": "engineering",
    "emailType": null,
    "education": "university of california berkeley",
    "countryOfOrigin": null,
    "currentLocation": "San Francisco, CA",
    "keywords": ["tech lead", "technical lead", "berkeley", "UC Berkeley", "engineering lead"],
    "schools": ["University of California, Berkeley", "UC Berkeley"],
    "degrees": ["Bachelor", "Master", "MBA"],
    "majors": ["Computer Science", "Engineering", "Electrical Engineering"],
    "locations": ["San Francisco, CA", "Palo Alto, CA", "Mountain View, CA", "Cupertino, CA"],
    "companies": ["Meta", "Apple", "Amazon", "Netflix", "Google", "Alphabet"],
    "companyIndustries": ["Technology", "Computer Software", "Internet"],
    "employeeCountRanges": ["5000+"],
    "limit": 10
  },
  "confidence": 95,
  "explanation": "Searching for senior technical leads at FAANG companies who studied at UC Berkeley in Bay Area. Apollo.io will handle education filtering with schools array, while PDL provides career history backup.",
  "suggestions": [
    "Apollo.io education filtering will find Berkeley graduates across all FAANG companies",
    "Consider expanding to 'Lead Engineer', 'Engineering Manager', or 'Staff Engineer' roles",
    "Bay Area locations include SF, Palo Alto, Mountain View for comprehensive coverage"
  ]
}
\`\`\`

Request: "Find marketing directors at tech companies in San Francisco"
Response: 
\`\`\`json
{
  "criteria": {
    "company": null,
    "domain": null,
    "jobTitle": "Marketing Director",
    "location": "San Francisco, CA",
    "industry": "Technology",
    "companySize": null,
    "keywords": ["marketing", "director", "tech"],
    "limit": 10
  },
  "confidence": 90,
  "explanation": "Looking for marketing directors specifically in the technology industry within San Francisco",
  "suggestions": [
    "Consider specifying company size (startup vs enterprise) for better targeting",
    "Add specific marketing specialties like 'digital marketing' or 'product marketing'",
    "Include nearby cities like Palo Alto or Mountain View to expand results"
  ]
}
\`\`\`

Request: "I need senior sales contacts at Salesforce"
Response:
\`\`\`json
{
  "criteria": {
    "company": null,
    "domain": "salesforce.com",
    "jobTitle": "Sales Manager",
    "location": null,
    "industry": "Software",
    "companySize": "enterprise",
    "seniority": "senior",
    "department": "sales",
    "emailType": null,
    "education": null,
    "countryOfOrigin": null,
    "currentLocation": null,
    "keywords": ["sales", "account executive", "sales manager"],
    "limit": 10
  },
  "confidence": 95,
  "explanation": "Searching for senior sales professionals at Salesforce using domain search with seniority and department filters",
  "suggestions": [
    "Try 'executive' seniority for VP-level sales positions",
    "Consider specific roles like 'Enterprise Account Executive' or 'Sales Director'", 
    "Add location filter like 'San Francisco' for headquarters-based contacts"
  ]
}
\`\`\`

Request: "Find people from Berkeley who are Colombian and are working in big tech in the bay area"
Response:
\`\`\`json
{
  "criteria": {
    "company": null,
    "domain": null,
    "jobTitle": null,
    "location": "San Francisco, CA",
    "industry": "Technology",
    "companySize": "enterprise",
    "seniority": null,
    "department": null,
    "emailType": null,
    "education": "university of california berkeley",
    "countryOfOrigin": "CO",
    "currentLocation": "San Francisco, CA",
    "keywords": ["berkeley", "UC Berkeley", "colombian", "colombia", "big tech"],
    "schools": ["University of California, Berkeley", "UC Berkeley"],
    "degrees": ["Bachelor", "Master", "MBA", "PhD"],
    "majors": ["Computer Science", "Engineering", "Business", "Data Science"],
    "locations": ["San Francisco, CA", "Palo Alto, CA", "Mountain View, CA", "Menlo Park, CA"],
    "companies": ["Google", "Meta", "Apple", "Amazon", "Microsoft", "Tesla", "Uber", "Airbnb"],
    "companyIndustries": ["Technology", "Computer Software", "Internet", "Software Development"],
    "employeeCountRanges": ["1000+", "5000+"],
    "limit": 15
  },
  "confidence": 95,
  "explanation": "Using Apollo.io for Berkeley education filtering and Colombian demographic detection. Big tech companies expanded to include FAANG+ companies in Bay Area locations.",
  "suggestions": [
    "Apollo.io will find UC Berkeley graduates, then Colombian detection filters by name patterns and career history",
    "Big tech expanded beyond FAANG to include Microsoft, Tesla, Uber, and Airbnb",
    "Consider expanding majors to include Economics, Psychology, or International Studies for broader results"
  ]
}
\`\`\`

Request: "Find Indian software engineers who moved to the US and now work at tech companies in Seattle"
Response:
\`\`\`json
{
  "criteria": {
    "company": null,
    "domain": null,
    "jobTitle": "Software Engineer",
    "location": "Seattle, WA",
    "industry": "Technology",
    "companySize": null,
    "seniority": null,
    "department": "engineering",
    "emailType": null,
    "education": null,
    "countryOfOrigin": "IN",
    "currentLocation": "Seattle, WA",
    "keywords": ["indian", "india", "software engineer", "migration", "H1B", "immigrant"],
    "schools": null,
    "degrees": null,
    "majors": null,
    "locations": ["Seattle, WA"],
    "companies": ["Microsoft", "Amazon", "Google", "Meta"],
    "companyIndustries": ["Technology", "Computer Software"],
    "employeeCountRanges": ["1000+"],
    "limit": 10
  },
  "confidence": 85,
  "explanation": "Using PDL API to find professionals with Indian origins who migrated to US and currently work in Seattle tech companies. PDL will infer country of origin from education/career history patterns.",
  "suggestions": [
    "PDL API will analyze early education and career locations to identify Indian origin",
    "Consider expanding to 'Software Developer' or 'Engineer' for broader results",
    "Add specific companies like 'Microsoft' or 'Amazon' which have large Seattle presence"
  ]
}
\`\`\`

Now process the user's request:`;
  }

  private parseAIResponse(aiText: string): {
    criteria: any;
    confidence: number;
    explanation: string;
    suggestions: string[];
  } {
    try {
      // Extract JSON from the response
      const jsonMatch = aiText.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const jsonResponse = JSON.parse(jsonMatch[1]);
      
      return {
        criteria: jsonResponse.criteria || {},
        confidence: jsonResponse.confidence || 70,
        explanation: jsonResponse.explanation || 'AI processed your request',
        suggestions: jsonResponse.suggestions || ['Try being more specific about job titles', 'Consider adding location information'],
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw error;
    }
  }

  private fallbackProcessing(userPrompt: string): ProcessedPrompt {
    // Simple keyword extraction as fallback
    const prompt = userPrompt.toLowerCase();
    
    // Extract job titles
    const jobTitleKeywords = [
      'ceo', 'cto', 'cfo', 'vp', 'director', 'manager', 'executive',
      'engineer', 'developer', 'designer', 'marketer', 'sales', 'analyst',
      'consultant', 'specialist', 'lead', 'head', 'founder', 'owner'
    ];
    
    const foundJobTitle = jobTitleKeywords.find(title => prompt.includes(title));
    
    // Extract location keywords
    const locationKeywords = [
      'san francisco', 'new york', 'los angeles', 'chicago', 'boston',
      'seattle', 'austin', 'denver', 'atlanta', 'miami', 'california',
      'texas', 'florida', 'new york', 'remote'
    ];
    
    const foundLocation = locationKeywords.find(loc => prompt.includes(loc));
    
    // Extract industry keywords  
    const industryKeywords = [
      'tech', 'technology', 'software', 'saas', 'fintech', 'healthcare',
      'finance', 'banking', 'retail', 'ecommerce', 'marketing', 'advertising',
      'consulting', 'manufacturing', 'real estate', 'education', 'nonprofit'
    ];
    
    const foundIndustry = industryKeywords.find(ind => prompt.includes(ind));
    
    // Extract company size keywords
    const sizeKeywords = {
      'startup': 'startup',
      'small': 'small', 
      'medium': 'medium',
      'large': 'large',
      'enterprise': 'enterprise'
    };
    
    const foundSize = Object.entries(sizeKeywords).find(([key]) => prompt.includes(key))?.[1];

    return {
      criteria: {
        jobTitle: foundJobTitle ? this.capitalizeWords(foundJobTitle) : undefined,
        location: foundLocation ? this.capitalizeWords(foundLocation) : undefined,
        industry: foundIndustry ? this.capitalizeWords(foundIndustry) : undefined,
        companySize: foundSize,
        keywords: [foundJobTitle, foundIndustry].filter(Boolean),
        limit: 10,
      },
      confidence: 60, // Lower confidence for fallback
      explanation: `Extracted basic search criteria from your request. AI processing was unavailable, so this is a simplified interpretation.`,
      suggestions: [
        'Try being more specific about job titles and seniority levels',
        'Include company names or industries for better targeting',
        'Add location information to narrow down results',
      ],
    };
  }

  private capitalizeWords(str: string): string {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async generateSearchSuggestions(criteria: SearchCriteria): Promise<string[]> {
    try {
      const result = await generateText({
        model: this.openai('o4-mini-2025-04-16'),
        messages: [
          {
            role: 'user',
            content: `Based on these lead search criteria, suggest 3 specific improvements or variations that could yield better results:

Search Criteria:
- Job Title: ${criteria.jobTitle || 'Not specified'}
- Company: ${criteria.company || 'Not specified'}
- Location: ${criteria.location || 'Not specified'}
- Industry: ${criteria.industry || 'Not specified'}
- Company Size: ${criteria.companySize || 'Not specified'}

Provide 3 concise, actionable suggestions that would improve this search. Focus on:
1. Making job titles more specific or inclusive
2. Expanding or narrowing location criteria
3. Adding relevant keywords or industries
4. Adjusting company size parameters

Format as a simple list:
1. [First suggestion]
2. [Second suggestion]  
3. [Third suggestion]`,
          },
        ],
        max_completion_tokens: 1000,
        maxRetries: 2,
      });

      // Extract suggestions from the response
      const suggestions = result.text
        .split('\n')
        .filter(line => line.match(/^\d+\./))
        .map(line => line.replace(/^\d+\.\s*/, ''))
        .slice(0, 3);

      return suggestions.length > 0 ? suggestions : [
        'Try adding more specific job titles or seniority levels',
        'Consider expanding to nearby locations or remote positions', 
        'Include related industries or company types'
      ];
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      return [
        'Try adding more specific job titles or seniority levels',
        'Consider expanding to nearby locations or remote positions',
        'Include related industries or company types'
      ];
    }
  }
}