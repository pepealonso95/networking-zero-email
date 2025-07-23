/**
 * Comprehensive Lead Search Criteria Parser for PDL API
 * This prompt template extracts all possible search criteria from user natural language requests
 */

export const LEAD_SEARCH_CRITERIA_PROMPT = `
You are an expert at parsing natural language lead generation requests into structured PDL (People Data Labs) API search criteria.

Your task is to analyze the user's request and extract ALL possible search parameters that can be used with the PDL Person Search API.

## PRIORITY FIELDS - Focus on these key criteria:

### 1. Current Company & Role:
- job_company_name: Current company name (PRIORITY)
- job_title: Current job title/role (PRIORITY)
- job_title_role: Role category (sales, engineering, marketing, etc.)
- job_company_industry: Industry sector (IMPORTANT: Use specific terms like "computer software", "information technology and services", "internet", "consumer electronics" NOT generic "technology")

### 2. Educational Background:
- education.school.name: School/University name (PRIORITY)
- education.majors: Field of study (PRIORITY)
- education.degrees: Degree types (bachelor, master, phd, etc.)

### 3. Geographic Information:
- location_country: Current location country (PRIORITY)
- location_region: Current state/province
- location_locality: Current city
- (Note: Country of origin must be inferred from education location, early career, or other contextual clues)

### 4. Secondary Fields (use when available):
- job_company_size: Company size categories
- job_title_class: Job class (individual_contributor, manager, director, vp, c_level)
- experience.company.name: Previous company names
- experience.location: Previous work locations for origin inference

## Query Construction Rules:

1. **Use nested field notation** for complex objects (e.g., "education.school.name", "experience.company.name")
2. **Combine multiple criteria** using boolean logic
3. **Infer implicit criteria** from context (e.g., "tech startup" → job_company_industry: "computer software" + job_company_size: "1-50")
4. **Handle synonyms and variations** (e.g., "university" = "college", "software engineer" = "developer", "tech" = "computer software" OR "information technology and services")
5. **Extract geographic hints** (e.g., "Bay Area" → location_locality: "san francisco" OR location_region: "california")
6. **Identify seniority levels** from titles and context
7. **Parse company size hints** (startup, enterprise, mid-size, etc.)
8. **Extract temporal constraints** (recent graduates, experienced professionals, etc.)

## Response Format:
Return a JSON object with the following structure:

\`\`\`json
{
  "query": {
    "bool": {
      "must": [
        // Required conditions
      ],
      "should": [
        // Optional conditions (OR logic)
      ],
      "filter": [
        // Additional filters
      ]
    }
  },
  "size": 10,
  "reasoning": "Explanation of how you interpreted the request",
  "alternative_queries": [
    // Alternative query variations if the main query might be too restrictive
  ]
}
\`\`\`

## Examples:

**User Request**: "Find software engineers at tech startups in Silicon Valley who went to Stanford"

**Response**:
\`\`\`json
{
  "query": {
    "bool": {
      "must": [
        {"match": {"job_title_role": "engineering"}},
        {"bool": {
          "should": [
            {"term": {"job_company_industry": "computer software"}},
            {"term": {"job_company_industry": "information technology and services"}},
            {"term": {"job_company_industry": "internet"}}
          ]
        }},
        {"range": {"job_company_size": {"lte": 200}}},
        {"bool": {
          "should": [
            {"match": {"location_locality": "san francisco"}},
            {"match": {"location_locality": "palo alto"}},
            {"match": {"location_locality": "mountain view"}},
            {"match": {"location_region": "california"}}
          ]
        }},
        {"match": {"education.school.name": "stanford university"}}
      ]
    }
  },
  "size": 10,
  "reasoning": "Extracted: engineering role, tech industry (using specific PDL industry terms), startup size (<200 employees), Silicon Valley locations, Stanford education",
  "alternative_queries": [
    {
      "query": {
        "bool": {
          "must": [
            {"wildcard": {"job_title": "*engineer*"}},
            {"term": {"job_company_industry": "computer software"}},
            {"match": {"education.school.name": "stanford"}}
          ]
        }
      },
      "reasoning": "Broader match on job title with most common tech industry term, relaxed location constraint"
    }
  ]
}
\`\`\`

Now parse this user request and return the structured query:
`;

export interface ParsedSearchCriteria {
  query: {
    bool: {
      must?: any[];
      should?: any[];
      filter?: any[];
      must_not?: any[];
    };
  };
  size: number;
  reasoning: string;
  alternative_queries?: {
    query: any;
    reasoning: string;
  }[];
}

export async function parseUserRequestToPDLCriteria(
  userRequest: string,
  aiModel: any
): Promise<ParsedSearchCriteria> {
  const fullPrompt = LEAD_SEARCH_CRITERIA_PROMPT + "\n\nUser Request: " + userRequest;
  
  try {
    // Import generateText from ai SDK
    const { generateText } = await import('ai');
    
    const response = await generateText({
      model: aiModel,
      prompt: fullPrompt,
      temperature: 0.1, // Low temperature for consistent parsing
    });

    const content = response.text;
    
    console.log('AI Response:', content);
    
    // Extract JSON from the response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Fallback: try to parse the entire response as JSON
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing user request:', error);
    console.error('Error details:', error);
    throw new Error('Failed to parse user request into search criteria');
  }
}