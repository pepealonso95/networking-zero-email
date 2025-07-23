import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PDLAPIService } from '../lead-generation-apis.js';
import { parseUserRequestToPDLCriteria } from '../lead-criteria-parser.js';

// Mock responses to avoid API costs
const mockPDLResponse = {
  "data": [
    {
      "id": "test-person-1",
      "first_name": "John",
      "last_name": "Smith", 
      "full_name": "John Smith",
      "emails": [{ "address": "john.smith@techcorp.com" }],
      "job_company_name": "TechCorp Inc",
      "job_title": "Software Engineer",
      "job_title_role": "engineering",
      "job_company_industry": "technology",
      "location_name": "San Francisco, California",
      "location_country": "united states",
      "location_region": "california",
      "location_locality": "san francisco",
      "linkedin_url": "https://linkedin.com/in/johnsmith",
      "education": [
        {
          "school": {
            "name": "Stanford University"
          },
          "degrees": ["Bachelor of Science"],
          "majors": ["Computer Science"],
          "start_date": "2018-09-01",
          "end_date": "2022-06-01"
        }
      ],
      "experience": [
        {
          "company": {
            "name": "TechCorp Inc"
          },
          "title": {
            "name": "Software Engineer"
          },
          "start_date": "2022-07-01"
        }
      ],
      "skills": ["JavaScript", "Python", "React"],
      "phone_numbers": ["+1-555-123-4567"]
    },
    {
      "id": "test-person-2",
      "first_name": "Sarah",
      "last_name": "Johnson",
      "full_name": "Sarah Johnson", 
      "emails": [{ "address": "sarah.johnson@startup.io" }],
      "job_company_name": "AI Startup Inc",
      "job_title": "Product Manager",
      "job_title_role": "product",
      "job_company_industry": "technology",
      "location_name": "San Francisco, California",
      "location_country": "united states",
      "location_region": "california",
      "location_locality": "san francisco",
      "linkedin_url": "https://linkedin.com/in/sarahjohnson",
      "education": [
        {
          "school": {
            "name": "Stanford University"
          },
          "degrees": ["Master of Business Administration"],
          "majors": ["Business Administration"],
          "start_date": "2020-09-01",
          "end_date": "2022-06-01"
        }
      ],
      "experience": [
        {
          "company": {
            "name": "AI Startup Inc"
          },
          "title": {
            "name": "Product Manager"
          },
          "start_date": "2022-08-01"
        }
      ],
      "skills": ["Product Strategy", "Data Analysis", "Agile"],
      "phone_numbers": ["+1-555-987-6543"]
    }
  ],
  "total": 2
};

const mockAICriteriaResponse = {
  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "education.school.name": "stanford university"
          }
        },
        {
          "term": {
            "job_company_industry": "technology"
          }
        },
        {
          "bool": {
            "should": [
              {
                "term": {
                  "location_locality": "san francisco"
                }
              },
              {
                "match": {
                  "location_name": "san francisco"
                }
              }
            ]
          }
        }
      ]
    }
  },
  "size": 10,
  "reasoning": "Extracted: Stanford University education, technology industry, San Francisco location",
  "alternative_queries": [
    {
      "query": {
        "bool": {
          "must": [
            {
              "wildcard": {
                "education.school.name": "*stanford*"
              }
            },
            {
              "term": {
                "job_company_industry": "technology"
              }
            }
          ]
        }
      },
      "reasoning": "Broader match on Stanford with wildcard, relaxed location constraint"
    }
  ]
};

// Mock AI model response
const mockAIModel = jest.fn().mockResolvedValue({
  choices: [{
    message: {
      content: `\`\`\`json\n${JSON.stringify(mockAICriteriaResponse, null, 2)}\n\`\`\``
    }
  }]
});

// Mock fetch globally
global.fetch = jest.fn();

describe('PDL API Service', () => {
  let pdlService: PDLAPIService;
  const mockApiKey = 'test-pdl-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    pdlService = new PDLAPIService(mockApiKey);
    
    // Mock successful fetch response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockPDLResponse),
      text: () => Promise.resolve(JSON.stringify(mockPDLResponse))
    });
  });

  describe('AI-powered search parsing', () => {
    it('should parse "find stanford graduates in tech in san francisco" correctly', async () => {
      const userRequest = "find stanford graduates in tech in san francisco";
      
      console.log('🧪 Testing AI criteria parsing...');
      console.log('User Request:', userRequest);
      
      const parsedCriteria = await parseUserRequestToPDLCriteria(userRequest, mockAIModel);
      
      console.log('📋 Parsed AI Criteria:');
      console.log(JSON.stringify(parsedCriteria, null, 2));
      
      // Verify the AI correctly extracted all key criteria
      expect(parsedCriteria.query.bool.must).toBeDefined();
      expect(parsedCriteria.reasoning).toContain('Stanford');
      expect(parsedCriteria.reasoning).toContain('technology');
      expect(parsedCriteria.reasoning).toContain('San Francisco');
      
      // Check for Stanford education criteria
      const hasStanfordEducation = parsedCriteria.query.bool.must.some((condition: any) => 
        condition.match?.['education.school.name'] === 'stanford university' ||
        condition.wildcard?.['education.school.name']?.includes('stanford') ||
        condition.term?.['education.school.name'] === 'stanford university'
      );
      expect(hasStanfordEducation).toBe(true);
      
      // Check for tech industry criteria
      const hasTechIndustry = parsedCriteria.query.bool.must.some((condition: any) =>
        condition.term?.['job_company_industry'] === 'technology'
      );
      expect(hasTechIndustry).toBe(true);
      
      // Check for San Francisco location criteria
      const hasSFLocation = parsedCriteria.query.bool.must.some((condition: any) =>
        condition.term?.['location_locality'] === 'san francisco' ||
        condition.match?.['location_name']?.includes('san francisco') ||
        (condition.bool?.should && condition.bool.should.some((loc: any) =>
          loc.term?.['location_locality'] === 'san francisco' ||
          loc.match?.['location_name']?.includes('san francisco')
        ))
      );
      expect(hasSFLocation).toBe(true);
    });
  });

  describe('PDL API query execution', () => {
    it('should execute search with AI-parsed criteria', async () => {
      const userRequest = "find stanford graduates in tech in san francisco";
      
      console.log('🔍 Testing PDL API query execution...');
      
      const results = await pdlService.searchPeopleWithAI(userRequest, mockAIModel);
      
      console.log('📊 PDL API Results:');
      console.log(`Found ${results.length} leads`);
      console.log(JSON.stringify(results, null, 2));
      
      // Verify API was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.peopledatalabs.com/v5/person/search',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': mockApiKey,
          },
          body: expect.stringContaining('"education.school.name"')
        })
      );
      
      // Verify results structure
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        email: 'john.smith@techcorp.com',
        firstName: 'John',
        lastName: 'Smith',
        company: 'TechCorp Inc',
        jobTitle: 'Software Engineer',
        location: 'San Francisco, California',
        source: 'pdl'
      });
      
      // Verify education history is parsed correctly
      expect(results[0].educationHistory).toContainEqual(
        expect.objectContaining({
          school: 'Stanford University',
          field: 'Computer Science',
          degree: 'Bachelor of Science'
        })
      );
      
      // Verify AI reasoning is included in metadata
      expect(results[0].metadata?.ai_search_reasoning).toBeTruthy();
    });
  });

  describe('Error handling', () => {
    it('should handle 404 responses as empty results', async () => {
      // Mock 404 response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          status: 404,
          error: { type: "not_found", message: "No records were found matching your search" },
          total: 0
        }),
        text: () => Promise.resolve('{"status": 404, "error": {"type": "not_found", "message": "No records were found matching your search"}, "total": 0}')
      });

      console.log('🚫 Testing 404 error handling...');
      
      const results = await pdlService.searchPeopleWithAI("find nonexistent criteria", mockAIModel);
      
      console.log('📭 404 Response Results:', results);
      
      expect(results).toEqual([]);
    });

    it('should try alternative queries when main query fails', async () => {
      // Mock first request to fail, second to succeed
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve('{"error": "Bad request"}')
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockPDLResponse)
        });

      console.log('🔄 Testing alternative query fallback...');
      
      const results = await pdlService.searchPeopleWithAI("find stanford graduates in tech in san francisco", mockAIModel);
      
      console.log('🎯 Alternative Query Results:', results.length);
      
      // Should have tried both queries
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });
  });

  describe('Data transformation', () => {
    it('should correctly transform PDL person data to Lead format', async () => {
      console.log('🔄 Testing data transformation...');
      
      const results = await pdlService.searchPeopleWithAI("find stanford graduates in tech in san francisco", mockAIModel);
      const lead = results[0];
      
      console.log('👤 Transformed Lead Object:');
      console.log(JSON.stringify(lead, null, 2));
      
      // Test all expected Lead properties
      expect(lead).toMatchObject({
        email: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        fullName: expect.any(String),
        company: expect.any(String),
        jobTitle: expect.any(String),
        linkedinUrl: expect.stringMatching(/^https:\/\/linkedin\.com/),
        phoneNumber: expect.stringMatching(/^\+1-555-/),
        location: expect.stringContaining('San Francisco'),
        source: 'pdl',
        confidence: expect.any(Number),
        verified: expect.any(Boolean),
        educationHistory: expect.arrayContaining([
          expect.objectContaining({
            school: expect.any(String),
            degree: expect.any(String),
            field: expect.any(String)
          })
        ]),
        workHistory: expect.arrayContaining([
          expect.objectContaining({
            company: expect.any(String),
            title: expect.any(String)
          })
        ]),
        metadata: expect.objectContaining({
          pdl_id: expect.any(String),
          skills: expect.any(Array),
          ai_search_reasoning: expect.any(String)
        })
      });
    });
  });

  describe('Country of origin inference', () => {
    it('should infer country of origin from education and work history', async () => {
      console.log('🌍 Testing country of origin inference...');
      
      const results = await pdlService.searchPeopleWithAI("find stanford graduates in tech in san francisco", mockAIModel);
      
      // Both test persons should have inferred origin due to US education/location
      results.forEach((lead, index) => {
        console.log(`Person ${index + 1} inferred origin:`, lead.inferredOrigin);
        
        expect(lead.inferredOrigin).toBeDefined();
        expect(lead.inferredOrigin?.country).toBeDefined();
        expect(lead.inferredOrigin?.confidence).toBeGreaterThan(0);
        expect(lead.inferredOrigin?.reasoning).toBeTruthy();
      });
    });
  });
});

describe('Integration Test - Full Workflow', () => {
  it('should handle the complete Stanford tech SF search workflow', async () => {
    console.log('\n🎯 FULL INTEGRATION TEST');
    console.log('='.repeat(50));
    
    const pdlService = new PDLAPIService('test-api-key');
    const userRequest = "find stanford graduates in tech in san francisco";
    
    // Mock the complete workflow
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockPDLResponse),
      text: () => Promise.resolve(JSON.stringify(mockPDLResponse))
    });
    
    console.log('1. 🤖 Parsing user request with AI...');
    const parsedCriteria = await parseUserRequestToPDLCriteria(userRequest, mockAIModel);
    console.log('   ✅ AI parsing completed');
    console.log('   📋 Query structure:', JSON.stringify(parsedCriteria.query, null, 2));
    
    console.log('2. 🔍 Executing PDL search...');
    const results = await pdlService.searchPeopleWithAI(userRequest, mockAIModel);
    console.log(`   ✅ Search completed - found ${results.length} leads`);
    
    console.log('3. 🧪 Validating results...');
    results.forEach((lead, index) => {
      console.log(`   Lead ${index + 1}:`, {
        name: lead.fullName,
        company: lead.company,
        role: lead.jobTitle,
        education: lead.educationHistory?.[0]?.school,
        location: lead.location
      });
    });
    
    // Final assertions
    expect(parsedCriteria.query.bool.must).toHaveLength(3); // Education, industry, location
    expect(results).toHaveLength(2);
    expect(results.every(lead => lead.source === 'pdl')).toBe(true);
    expect(results.every(lead => lead.educationHistory?.some(edu => edu.school?.includes('Stanford')))).toBe(true);
    
    console.log('   ✅ All validations passed!');
    console.log('='.repeat(50));
    console.log('🎉 INTEGRATION TEST COMPLETED SUCCESSFULLY\n');
  });
});