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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function searchIndustrialProjects(
  keyword: string,
  segment: string,
  region: string,
  dateLimit: string = "all"
): Promise<Project[]> {
  const prompt = `Perform an intensive search for real industrial projects, infrastructure news, and official corporate announcements in Brazil based on:
Keyword: "${keyword}"
Segment: "${segment || 'any'}"
Region: "${region || 'all Brazil'}" (Norte, Nordeste, Sul, Sudeste, Centro-Oeste)
Time Range Limit: "${dateLimit}"
Current Date: ${new Date().toISOString()}

ENGINEERING SEARCH PROTOCOL:
1. INTENSIVE DEEP SCAN: Scrape, synthesize, and cross-reference information from official press releases (Petrobras, Vale, Gerdau, WEG, Suzano, Klabin, etc.), specialized industrial portals (Petronotícias, Click Petróleo e Gás, CanalEnergia, Infomoney, Valor Econômico), and government bidding sites (Comprasnet, Petronect, Portal da Transparência).
2. EXHAUSTIVE VOLUME: You MUST return a high volume of distinct, real-world projects (aim for 40+ opportunities if available). Prioritize comprehensive coverage of the industrial landscape over speed.
3. SOURCE VERIFICATION: Every single project MUST have a functional, direct URL in "url" and "source_url". Prefer direct links to tender documents, company newsroom articles, or specialized news reports.
4. TECHNICAL RIGOR: The "summary" MUST be a professional technical analysis (min 6 sentences) detailing:
   - Specific nature (Greenfield, Brownfield, Maintenance, EPC).
   - Detailed technical scope and critical vendor requirements.
   - Strategic impact on the regional economy.
   - Estimated timeline, budget (if available), and regulatory context (IBAMA, state licenses).
   - Risk Assessment: Challenges like logistical hurdles or financial volatility.
5. GEOGRAPHY: Results MUST strictly reside within the states of the requested region: ${region}. If "all Brazil", provide a balanced nationwide overview.
6. NEWS EXTRACTION: Include recent news articles, reports, and official announcements as individual items if they represent a project milestone or new investment opportunity.

Return a valid JSON array of project objects. Ensure "priority_score" strictly reflects the immediate commercial opportunity.`;

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
                description: "e.g., notícia, expansão, licitação, manutenção, projeto novo, EPC"
              },
              priority_score: { type: Type.NUMBER },
              estimated_value: { type: Type.NUMBER, description: "Value in BRL" },
              summary: { type: Type.STRING },
              url: { type: Type.STRING },
              source_url: { type: Type.STRING },
              source: { type: Type.STRING },
              status: { type: Type.STRING, description: "e.g., em análise, licitação aberta, obra iniciada" },
              location: { type: Type.STRING },
              created_at: { type: Type.STRING, description: "ISO 8601 date string of when the project was announced or discovered" }
            },
            required: ["title", "company", "project_type", "priority_score", "summary", "created_at"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const projects: Project[] = JSON.parse(text);

    // Extract grounding sources if available
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = chunks?.filter(c => c.web).map(c => ({
      title: c.web?.title || 'Fonte Web',
      uri: c.web?.uri || ''
    })).filter(s => s.uri) || [];

    // Attach general sources to projects that might be missing them or just as extra verification
    return projects.map(p => ({
      ...p,
      grounding_sources: sources.slice(0, 5) // Attach first 5 general sources as relevant verification
    }));
  } catch (error) {
    console.error("Gemini Error:", error);
    return [];
  }
}
