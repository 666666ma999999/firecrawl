import axios from "axios";
import { SearchV2Response, WebSearchResult } from "../../lib/entities";
import { config } from "../../config";

export async function serper_search(
  q,
  options: {
    tbs?: string;
    filter?: string;
    lang?: string;
    country?: string;
    location?: string;
    num_results: number;
    page?: number;
  },
): Promise<SearchV2Response> {
  if (!config.SERPER_API_KEY) {
    throw new Error(
      "Serper API key is not configured. Please set SERPER_API_KEY environment variable to use Serper.",
    );
  }

  let data = JSON.stringify({
    q: q,
    hl: options.lang,
    gl: options.country,
    location: options.location,
    tbs: options.tbs,
    num: options.num_results,
    page: options.page ?? 1,
  });

  let request = {
    method: "POST",
    url: "https://google.serper.dev/search",
    headers: {
      "X-API-KEY": config.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    data: data,
  };

  try {
    const response = await axios(request);
    if (response && response.data && Array.isArray(response.data.organic)) {
      const webResults: WebSearchResult[] = response.data.organic.map(a => ({
        url: a.link,
        title: a.title,
        description: a.snippet,
      }));

      return {
        web: webResults,
      };
    } else {
      return {};
    }
  } catch (error) {
    return {};
  }
}
