// Final test - try each criterion individually and in combination
const PDL_API_KEY = "8ab72644b4537012aea7d0d874dcacf5271e911383fae1526e08e6fd53beda47";

async function finalTest() {
  console.log('🎯 Final comprehensive test - individual vs combined criteria\n');

  const tests = [
    {
      name: "1. Stanford graduates only",
      query: {
        match: { "education.school.name": "stanford" }
      }
    },
    {
      name: "2. Computer software industry only", 
      query: {
        term: { "job_company_industry": "computer software" }
      }
    },
    {
      name: "3. San Francisco only",
      query: {
        match: { "location_locality": "san francisco" }
      }
    },
    {
      name: "4. Stanford + Computer Software",
      query: {
        bool: {
          must: [
            { match: { "education.school.name": "stanford" }},
            { term: { "job_company_industry": "computer software" }}
          ]
        }
      }
    },
    {
      name: "5. Stanford + San Francisco",
      query: {
        bool: {
          must: [
            { match: { "education.school.name": "stanford" }},
            { match: { "location_locality": "san francisco" }}
          ]
        }
      }
    },
    {
      name: "6. Computer Software + San Francisco", 
      query: {
        bool: {
          must: [
            { term: { "job_company_industry": "computer software" }},
            { match: { "location_locality": "san francisco" }}
          ]
        }
      }
    },
    {
      name: "7. ALL THREE: Stanford + Computer Software + San Francisco",
      query: {
        bool: {
          must: [
            { match: { "education.school.name": "stanford" }},
            { term: { "job_company_industry": "computer software" }},
            { match: { "location_locality": "san francisco" }}
          ]
        }
      }
    }
  ];

  for (const test of tests) {
    console.log(`--- ${test.name} ---`);
    
    const searchQuery = {
      query: test.query,
      size: 2
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
        const count = data.data?.length || 0;
        console.log(`✅ Results: ${count}`);
        
        if (count > 0) {
          data.data.forEach((person, i) => {
            console.log(`  ${i+1}. ${person.full_name}`);
            console.log(`     Company: ${person.job_company_name || 'N/A'}`);
            console.log(`     Industry: ${person.job_company_industry || 'N/A'}`);
            console.log(`     Location: ${person.location_name === true ? '[HIDDEN]' : (person.location_name || 'N/A')}`);
            if (person.education && person.education.length > 0) {
              const schools = person.education.map(edu => edu.school?.name).filter(Boolean);
              console.log(`     Education: ${schools.join(', ') || 'N/A'}`);
            }
          });
        }
      } else {
        if (response.status === 404) {
          console.log('❌ No results found');
        } else if (response.status === 429) {
          console.log('⏳ Rate limited - slowing down...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        } else {
          console.log(`❌ Error: ${responseText}`);
        }
      }
      
      console.log('');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Rate limiting
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }
  
  console.log('🎯 CONCLUSION:');
  console.log('If individual searches work but combined doesn\'t,');
  console.log('it means the combination is too restrictive for PDL\'s dataset.');
  console.log('Consider using broader criteria or fewer constraints.');
}

finalTest().catch(console.error);