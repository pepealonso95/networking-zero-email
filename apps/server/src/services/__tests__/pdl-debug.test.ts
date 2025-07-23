import { describe, it, expect } from '@jest/globals';
import { PDLAPIService } from '../lead-generation-apis.js';
import { openai } from '@ai-sdk/openai';

// DEBUG TEST - Find the right PDL field names and test basic queries
describe('PDL API Debug - Find Working Queries', () => {
  let pdlService: PDLAPIService;

  beforeAll(() => {
    const pdlApiKey = process.env.PDL_API_KEY;
    if (!pdlApiKey) {
      throw new Error('PDL_API_KEY required');
    }
    pdlService = new PDLAPIService(pdlApiKey);
  });

  it('should test basic location search - San Francisco', async () => {
    console.log('\n🔍 Testing basic San Francisco location search...');
    
    const basicQuery = {
      query: {
        bool: {
          must: [
            {
              term: { "location_locality": "san francisco" }
            }
          ]
        }
      },
      size: 5
    };

    console.log('Query:', JSON.stringify(basicQuery, null, 2));

    try {
      const response = await fetch(`https://api.peopledatalabs.com/v5/person/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.PDL_API_KEY!,
        },
        body: JSON.stringify(basicQuery),
      });

      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response:', responseText);

      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log(`✅ Found ${data.data?.length || 0} results`);
        
        if (data.data?.length > 0) {
          console.log('Sample result:', {
            name: data.data[0].full_name,
            location: data.data[0].location_name,
            company: data.data[0].job_company_name,
            title: data.data[0].job_title
          });
        }
        
        expect(data.data).toBeDefined();
      } else {
        console.log('❌ Query failed');
        expect(response.status).toBe(404); // Accept 404 as no results
      }
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }, 30000);

  it('should test technology industry search', async () => {
    console.log('\n🔍 Testing basic technology industry search...');
    
    const industryQuery = {
      query: {
        bool: {
          must: [
            {
              term: { "job_company_industry": "technology" }
            }
          ]
        }
      },
      size: 5
    };

    console.log('Query:', JSON.stringify(industryQuery, null, 2));

    try {
      const response = await fetch(`https://api.peopledatalabs.com/v5/person/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.PDL_API_KEY!,
        },
        body: JSON.stringify(industryQuery),
      });

      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response:', responseText);

      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log(`✅ Found ${data.data?.length || 0} results`);
        
        if (data.data?.length > 0) {
          console.log('Sample result:', {
            name: data.data[0].full_name,
            industry: data.data[0].job_company_industry,
            company: data.data[0].job_company_name,
            title: data.data[0].job_title
          });
        }
      } else {
        console.log('❌ Query failed');
      }
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }, 30000);

  it('should test education search', async () => {
    console.log('\n🔍 Testing basic education search...');
    
    const educationQuery = {
      query: {
        bool: {
          must: [
            {
              match: { "education.school.name": "university" }
            }
          ]
        }
      },
      size: 5
    };

    console.log('Query:', JSON.stringify(educationQuery, null, 2));

    try {
      const response = await fetch(`https://api.peopledatalabs.com/v5/person/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.PDL_API_KEY!,
        },
        body: JSON.stringify(educationQuery),
      });

      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response:', responseText);

      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log(`✅ Found ${data.data?.length || 0} results`);
        
        if (data.data?.length > 0) {
          console.log('Sample result:', {
            name: data.data[0].full_name,
            education: data.data[0].education?.[0]?.school?.name,
            company: data.data[0].job_company_name
          });
        }
      } else {
        console.log('❌ Query failed');
      }
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }, 30000);

  it('should test very broad query to get ANY results', async () => {
    console.log('\n🔍 Testing very broad query to get ANY results...');
    
    const broadQuery = {
      query: {
        bool: {
          must: [
            {
              exists: { "field": "emails" }
            }
          ]
        }
      },
      size: 3
    };

    console.log('Query:', JSON.stringify(broadQuery, null, 2));

    try {
      const response = await fetch(`https://api.peopledatalabs.com/v5/person/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.PDL_API_KEY!,
        },
        body: JSON.stringify(broadQuery),
      });

      const responseText = await response.text();
      console.log('Response status:', response.status);
      console.log('Response:', responseText);

      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log(`✅ Found ${data.data?.length || 0} results`);
        
        if (data.data?.length > 0) {
          console.log('Sample results:');
          data.data.forEach((person: any, i: number) => {
            console.log(`Person ${i + 1}:`, {
              name: person.full_name,
              email: person.emails?.[0]?.address,
              location: person.location_name,
              company: person.job_company_name,
              title: person.job_title,
              industry: person.job_company_industry,
              education: person.education?.[0]?.school?.name
            });
          });
          
          // This should definitely work if PDL API is functioning
          expect(data.data.length).toBeGreaterThan(0);
        } else {
          console.log('⚠️  Even broad query returned 0 results - possible API issue');
        }
      } else {
        console.log('❌ Broad query failed - API key or quota issue');
        console.log('Response text:', responseText);
      }
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }, 30000);

  it('should test alternative field names for education', async () => {
    console.log('\n🔍 Testing alternative education field names...');
    
    const alternativeQueries = [
      {
        name: 'education.school.name (nested)',
        query: { match: { "education.school.name": "stanford" } }
      },
      {
        name: 'schools (array)',
        query: { match: { "schools": "stanford" } }
      },
      {
        name: 'school_name (flat)',
        query: { match: { "school_name": "stanford" } }
      },
      {
        name: 'education_names',
        query: { match: { "education_names": "stanford" } }
      }
    ];

    for (const testQuery of alternativeQueries) {
      console.log(`\nTrying field: ${testQuery.name}`);
      
      const searchQuery = {
        query: {
          bool: {
            must: [testQuery.query]
          }
        },
        size: 2
      };

      try {
        const response = await fetch(`https://api.peopledatalabs.com/v5/person/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': process.env.PDL_API_KEY!,
          },
          body: JSON.stringify(searchQuery),
        });

        const responseText = await response.text();
        console.log(`  Status: ${response.status}`);
        
        if (response.ok) {
          const data = JSON.parse(responseText);
          console.log(`  Results: ${data.data?.length || 0}`);
          if (data.data?.length > 0) {
            console.log(`  ✅ Field "${testQuery.name}" works!`);
            console.log('  Sample:', {
              name: data.data[0].full_name,
              education: data.data[0].education
            });
          }
        } else {
          console.log(`  ❌ Field "${testQuery.name}" failed: ${responseText}`);
        }
      } catch (error) {
        console.log(`  ❌ Field "${testQuery.name}" error:`, error);
      }
    }
  }, 60000);

  it('should test successful AI parsing with working query', async () => {
    console.log('\n🤖 Testing AI parsing with simpler query...');
    
    const aiModel = openai('o3-mini');
    const simplePrompt = "find people in technology";
    
    try {
      const results = await pdlService.searchPeopleWithAI(simplePrompt, aiModel);
      
      console.log(`Found ${results.length} results with simple prompt`);
      
      if (results.length > 0) {
        console.log('✅ Simple query works!');
        console.log('Sample result:', {
          name: results[0].fullName,
          company: results[0].company,
          title: results[0].jobTitle,
          location: results[0].location
        });
      } else {
        console.log('⚠️  Even simple query returned 0 results');
      }
      
      expect(Array.isArray(results)).toBe(true);
    } catch (error) {
      console.error('AI search error:', error);
      throw error;
    }
  }, 45000);
});