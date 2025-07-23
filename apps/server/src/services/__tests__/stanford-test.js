// Quick test to see if we can find Stanford graduates
const PDL_API_KEY = "8ab72644b4537012aea7d0d874dcacf5271e911383fae1526e08e6fd53beda47";

async function testStanfordSearch() {
  console.log('🔍 Testing specific Stanford search...');

  const queries = [
    {
      name: "Exact Stanford match",
      query: { match: { "education.school.name": "stanford university" } }
    },
    {
      name: "Wildcard Stanford match", 
      query: { wildcard: { "education.school.name": "*stanford*" } }
    },
    {
      name: "Just 'stanford'",
      query: { match: { "education.school.name": "stanford" } }
    },
    {
      name: "Case insensitive Stanford",
      query: { match: { "education.school.name": "Stanford" } }
    },
    {
      name: "Technology industry only",
      query: { term: { "job_company_industry": "technology" } }
    },
    {
      name: "SF location only", 
      query: { match: { "location_locality": "san francisco" } }
    },
    {
      name: "Combined tech + SF",
      query: {
        bool: {
          must: [
            { term: { "job_company_industry": "technology" } },
            { match: { "location_locality": "san francisco" } }
          ]
        }
      }
    }
  ];

  for (const testQuery of queries) {
    console.log(`\n--- Testing: ${testQuery.name} ---`);
    
    const searchQuery = {
      query: testQuery.query,
      size: 3
    };

    try {
      const response = await fetch(`https://api.peopledatalabs.com/v5/person/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': PDL_API_KEY,
        },
        body: JSON.stringify(searchQuery),
      });

      const responseText = await response.text();
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log(`Results: ${data.data?.length || 0}`);
        
        if (data.data?.length > 0) {
          console.log('✅ SUCCESS! Sample results:');
          data.data.forEach((person, i) => {
            console.log(`  ${i+1}. ${person.full_name}`);
            console.log(`     Company: ${person.job_company_name}`);
            console.log(`     Title: ${person.job_title}`);
            console.log(`     Location: ${person.location_name}`);
            console.log(`     Industry: ${person.job_company_industry}`);
            if (person.education && person.education.length > 0) {
              console.log(`     Education: ${person.education.map(edu => edu.school?.name).join(', ')}`);
            }
          });
        } else {
          console.log('⚠️  No results found');
        }
      } else {
        console.log(`❌ Query failed: ${responseText}`);
      }
    } catch (error) {
      console.log(`❌ Error:`, error.message);
    }
  }
}

testStanfordSearch().catch(console.error);