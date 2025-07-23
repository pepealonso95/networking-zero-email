// Quick test to find valid industry values in PDL
const PDL_API_KEY = "8ab72644b4537012aea7d0d874dcacf5271e911383fae1526e08e6fd53beda47";

async function testIndustries() {
  console.log('🔍 Testing industry values in PDL...');

  // From the successful broad search, we saw these industries:
  const industriesToTest = [
    "computer software",
    "information technology and services", 
    "internet",
    "consumer electronics",
    "real estate",
    "individual & family services",
    "automotive",
    "health, wellness and fitness",
    "technology", // This failed
    "tech", // Let's try this too
    "software" // And this
  ];

  for (const industry of industriesToTest) {
    console.log(`\n--- Testing industry: "${industry}" ---`);
    
    const searchQuery = {
      query: {
        term: { "job_company_industry": industry }
      },
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
        console.log(`✅ Results: ${data.data?.length || 0}`);
        
        if (data.data?.length > 0) {
          console.log(`Sample: ${data.data[0].full_name} at ${data.data[0].job_company_name}`);
        }
      } else {
        console.log(`❌ Failed: ${responseText}`);
      }
      
      // Rate limiting protection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ Error:`, error.message);
    }
  }
}

testIndustries().catch(console.error);