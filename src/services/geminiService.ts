import { GoogleGenAI, Type } from "@google/genai";

export interface Project {
  title: string;
  company: string;
  project_type: string;
  priority_score: number;
  estimated_value: number;
  summary: string;
  url: string;
  source_url: string;
  source: string;
  status: string;
  location: string;
  created_at: string;
  grounding_sources?: { title: string; uri: string }[];
}

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function searchIndustrialProjects(
  keyword: string,
  segment: string,
  region: string,
  dateLimit: string = "all"
): Promise<Project[]> {
  const prompt = `Goal: Identify and synthesize a list of industrial projects, infrastructure news, and investment opportunities in BRAZIL.

SPECIFIC PARAMETERS:
- Keyword: "${keyword}"
- Segment: "${segment || 'Industrial/Infrastructure'}"
- Region: "${region || 'all Brazil'}" (Focus specifically on: ${region || 'Across Brazil'})
- Timeframe Limit: "${dateLimit}"
- Reference Date: ${new Date().toISOString()}

SEARCH STRATEGY:
1. GENERATE SPECIFIC QUERIES: Use the Google Search tool with multiple targeted queries. For example, if searching for "Petrobras", use queries like:
   - "Petrobras novos projetos licitação ${region || ''}"
   - "Petrobras investimentos infraestrutura notícias recentes"
   - "Petronect editais abertos Petrobras"
   
2. SCAN MULTIPLE SOURCES:
   - Official Newsrooms (Vale, Petrobras, Gerdau, WEG, Suzano, Klabin, etc.)
   - Specialized Industry News (Petronotícias, Click Petróleo e Gás, CanalEnergia, Infomoney, Valor Econômico, Exame, G1 Economia)
   - Bidding Portals (Comprasnet, Petronect, Portal da Transparência)

3. TARGETS:
   - Greenfield (new developments) and Brownfield (expansions).
   - Maintenance shutdowns (paradas de manutenção), EPC contracts, and major supply tenders.
   - News about MOUs, funding rounds for industrial startups, or new factory installations.

REQUIREMENTS:
- Return as many distinct, real-world opportunities as possible (aim for 20+).
- "summary": A professional technical description (3-5 sentences) detailing scope, current status, and strategic impact.
- "url" and "source_url": MUST be functional, direct links.
- "priority_score": 0-100 score (high = immediate action needed or active tender).
- "location": City and State (e.g., "Macaé, RJ").

Ensure the response is a valid JSON array of objects following the defined schema.`;

  let lastError: any = null;
  const maxRetries = 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                company: { type: Type.STRING },
                project_type: { 
                  type: Type.STRING,
                  description: "e.g., notícia, expansão, licitação, manutenção, projeto novo, EPC, investimento"
                },
                priority_score: { type: Type.NUMBER },
                estimated_value: { type: Type.NUMBER, description: "Estimated value in BRL, 0 if unknown" },
                summary: { type: Type.STRING },
                url: { type: Type.STRING },
                source_url: { type: Type.STRING },
                source: { type: Type.STRING },
                status: { type: Type.STRING, description: "anunciado, em licitação, em obras, planejado, concluído" },
                location: { type: Type.STRING },
                created_at: { type: Type.STRING, description: "ISO 8601 date string" }
              },
              required: ["title", "company", "project_type", "priority_score", "summary", "created_at", "location"]
            }
          }
        }
      });

      const candidate = response.candidates?.[0];
      const text = candidate?.content?.parts?.find(p => p.text)?.text;
      
      if (!text) {
        throw new Error("No text returned from Gemini");
      }
      
      let projects: Project[] = JSON.parse(text);

      const sources = candidate?.groundingMetadata?.groundingChunks
        ?.filter(c => c.web)
        .map(c => ({
          title: c.web?.title || 'Fonte Web',
          uri: c.web?.uri || ''
        })).filter(s => s.uri) || [];

      return projects.map(p => ({
        ...p,
        grounding_sources: sources.slice(0, 5)
      }));

    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.error?.status;
      
      console.warn(`Gemini Attempt ${attempt + 1} failed:`, status || error.message);

      // If it's a 429 or 500, wait and retry
      if (status === 'RESOURCE_EXHAUSTED' || status === 'INTERNAL' || error?.code === 429 || error?.code === 500) {
        const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s backoff
        await delay(waitTime);
        continue;
      }
      
      // For other errors (like 404), break and return empty
      break;
    }
  }

  console.error("Gemini Final Error after retries:", lastError);
  return [];
}

