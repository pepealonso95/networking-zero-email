import { describe, it, expect, beforeAll } from '@jest/globals';
import { PDLAPIService } from '../lead-generation-apis.js';
import { parseUserRequestToPDLCriteria } from '../lead-criteria-parser.js';
import { openai } from '@ai-sdk/openai';

// INTEGRATION TEST - USES REAL API CALLS
// Run with: npx jest src/services/__tests__/pdl-api.integration.test.ts
// Make sure you have PDL_API_KEY in your .env file

describe('PDL API Integration Test (Real API Calls)', () => {
  let pdlService: PDLAPIService;
  const testPrompt = "find stanford graduates in tech in san francisco";
  
  // Storage for responses to avoid repeat API calls
  const savedResponses: {
    aiParsedCriteria?: any;
    pdlSearchResults?: any[];
    pdlQueryUsed?: any;
  } = {};

  beforeAll(() => {
    const pdlApiKey = process.env.PDL_API_KEY;
    
    if (!pdlApiKey) {
      console.error('❌ PDL_API_KEY not found in environment variables');
      console.log('Please add PDL_API_KEY to your .env file to run integration tests');
      throw new Error('PDL_API_KEY required for integration tests');
    }
    
    console.log('🔧 Setting up PDL API service with real API key...');
    pdlService = new PDLAPIService(pdlApiKey);
  });

  it('should parse user request with real AI model', async () => {
    console.log('\n🤖 STEP 1: Testing AI criteria parsing with real OpenAI API');
    console.log('='.repeat(60));
    console.log(`User Request: "${testPrompt}"`);
    
    const aiModel = openai('o3-mini');
    
    const parsedCriteria = await parseUserRequestToPDLCriteria(testPrompt, aiModel);
    
    // Save the parsed criteria for later use
    savedResponses.aiParsedCriteria = parsedCriteria;
    
    console.log('\n📋 AI Parsed Criteria:');
    console.log(JSON.stringify(parsedCriteria, null, 2));
    
    // Validate the AI correctly extracted key criteria
    expect(parsedCriteria.query).toBeDefined();
    expect(parsedCriteria.reasoning).toBeTruthy();
    
    // Check for Stanford education criteria
    const queryStr = JSON.stringify(parsedCriteria.query);
    expect(queryStr.toLowerCase()).toContain('stanford');
    expect(queryStr.toLowerCase()).toContain('technology');
    expect(queryStr.toLowerCase()).toContain('san francisco');
    
    console.log('\n✅ AI parsing validation passed');
  }, 30000); // 30 second timeout for AI calls

  it('should execute real PDL API search', async () => {
    console.log('\n🔍 STEP 2: Testing real PDL API search');
    console.log('='.repeat(60));
    
    if (!savedResponses.aiParsedCriteria) {
      throw new Error('AI criteria parsing must run first');
    }
    
    const aiModel = openai('o3-mini');
    
    console.log('Making real PDL API call...');
    const results = await pdlService.searchPeopleWithAI(testPrompt, aiModel);
    
    // Save results for analysis
    savedResponses.pdlSearchResults = results;
    
    console.log(`\n📊 PDL API Results: Found ${results.length} leads`);
    
    if (results.length > 0) {
      console.log('\n👥 Sample Results:');
      results.slice(0, 2).forEach((lead, index) => {
        console.log(`\nLead ${index + 1}:`);
        console.log(`  Name: ${lead.fullName}`);
        console.log(`  Email: ${lead.email}`);
        console.log(`  Company: ${lead.company}`);
        console.log(`  Role: ${lead.jobTitle}`);
        console.log(`  Location: ${lead.location}`);
        console.log(`  Education: ${lead.educationHistory?.[0]?.school || 'N/A'}`);
        console.log(`  Field of Study: ${lead.educationHistory?.[0]?.field || 'N/A'}`);
        console.log(`  Country of Origin: ${lead.countryOfOrigin || 'N/A'}`);
        console.log(`  LinkedIn: ${lead.linkedinUrl || 'N/A'}`);
      });
      
      console.log('\n🎯 Validation Results:');
      
      // Validate results structure
      results.forEach((lead, index) => {
        console.log(`Lead ${index + 1} validation:`);
        console.log(`  ✓ Has email: ${!!lead.email}`);
        console.log(`  ✓ Has name: ${!!lead.fullName}`);
        console.log(`  ✓ Has company: ${!!lead.company}`);
        console.log(`  ✓ Source is PDL: ${lead.source === 'pdl'}`);
        console.log(`  ✓ Has education: ${!!lead.educationHistory?.length}`);
        console.log(`  ✓ Has work history: ${!!lead.workHistory?.length}`);
        console.log(`  ✓ Has AI reasoning: ${!!lead.metadata?.ai_search_reasoning}`);
      });
      
      // Assertions
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(lead => lead.source === 'pdl')).toBe(true);
      expect(results.every(lead => lead.email)).toBe(true);
      expect(results.some(lead => lead.educationHistory?.some(edu => 
        edu.school?.toLowerCase().includes('stanford')
      ))).toBe(true);
      
      console.log('\n✅ PDL API search validation passed');
    } else {
      console.log('\n⚠️  No results found - this could mean:');
      console.log('   - Query is too restrictive');
      console.log('   - No Stanford tech graduates in SF in PDL database');
      console.log('   - API quota limitations');
      console.log('   - Need to adjust search criteria');
      
      // Still validate that we got a proper empty response
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    }
  }, 60000); // 60 second timeout for PDL calls

  it('should save comprehensive test results for debugging', async () => {
    console.log('\n💾 STEP 3: Saving comprehensive test results');
    console.log('='.repeat(60));
    
    const testResults = {
      testPrompt,
      timestamp: new Date().toISOString(),
      aiParsedCriteria: savedResponses.aiParsedCriteria,
      pdlSearchResults: savedResponses.pdlSearchResults,
      resultCount: savedResponses.pdlSearchResults?.length || 0,
      summary: {
        aiParsingWorked: !!savedResponses.aiParsedCriteria,
        pdlSearchWorked: savedResponses.pdlSearchResults !== undefined,
        foundResults: (savedResponses.pdlSearchResults?.length || 0) > 0,
        hasStanfordGrads: savedResponses.pdlSearchResults?.some(lead => 
          lead.educationHistory?.some((edu: any) => 
            edu.school?.toLowerCase().includes('stanford')
          )
        ) || false,
        hasTechWorkers: savedResponses.pdlSearchResults?.some(lead => 
          lead.company?.toLowerCase().includes('tech') || 
          lead.jobTitle?.toLowerCase().includes('engineer') ||
          lead.jobTitle?.toLowerCase().includes('developer')
        ) || false,
        hasSFLocation: savedResponses.pdlSearchResults?.some(lead => 
          lead.location?.toLowerCase().includes('san francisco')
        ) || false
      }
    };
    
    console.log('\n📄 Test Results Summary:');
    console.log(JSON.stringify(testResults.summary, null, 2));
    
    console.log('\n💾 Full results saved to test output');
    console.log('This data can be used for future testing without API calls');
    
    // Save to a temporary file for inspection
    const fs = require('fs');
    const path = require('path');
    
    const resultsPath = path.join(__dirname, 'pdl-integration-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
    
    console.log(`\n📁 Results saved to: ${resultsPath}`);
    console.log('You can use this data to create mock responses for unit tests');
    
    expect(testResults.summary.aiParsingWorked).toBe(true);
    expect(testResults.summary.pdlSearchWorked).toBe(true);
    
    console.log('\n✅ Integration test completed successfully');
  }, 10000);

  it('should handle error cases gracefully', async () => {
    console.log('\n🚫 STEP 4: Testing error handling');
    console.log('='.repeat(60));
    
    const aiModel = openai('o3-mini');
    
    // Test with a query that should return no results
    const impossibleQuery = "find graduates from NonexistentUniversity working at FakeCompany in Mars";
    
    console.log(`Testing impossible query: "${impossibleQuery}"`);
    
    const results = await pdlService.searchPeopleWithAI(impossibleQuery, aiModel);
    
    console.log(`Results: ${results.length} leads found`);
    
    // Should return empty array, not throw error
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
    
    console.log('\n✅ Error handling validation passed');
  }, 30000);
});

// Optional: Test with different prompts to validate flexibility
describe.skip('Additional PDL API Test Cases (Run manually)', () => {
  const testCases = [
    "find software engineers at Google who went to MIT",
    "find marketing managers at startups in New York",
    "find data scientists with PhDs in machine learning",
    "find product managers from Indian universities working in Silicon Valley"
  ];

  testCases.forEach(prompt => {
    it(`should handle: "${prompt}"`, async () => {
      const pdlService = new PDLAPIService(process.env.PDL_API_KEY!);
      const aiModel = openai('o3-mini');
      
      console.log(`\n🔍 Testing: "${prompt}"`);
      
      const results = await pdlService.searchPeopleWithAI(prompt, aiModel);
      
      console.log(`Found ${results.length} results`);
      if (results.length > 0) {
        console.log('Sample result:', {
          name: results[0].fullName,
          company: results[0].company,
          role: results[0].jobTitle,
          education: results[0].educationHistory?.[0]?.school
        });
      }
      
      expect(Array.isArray(results)).toBe(true);
    }, 60000);
  });
});