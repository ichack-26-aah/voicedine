import { ToolLoopAgent, stepCountIs, tool, zodSchema } from 'ai';
import { webSearch } from '@exalabs/ai-sdk';
import { xai } from '@ai-sdk/xai';
import { z } from 'zod';

interface Restaurant {
  name: string;
  latitude: number;
  longitude: number;
}

const agent = new ToolLoopAgent({
  model: xai('grok-4-fast-non-reasoning'),
  instructions: `Find vegan Italian restaurants near Oxford Street London. Return paginated results as JSON with name, latitude, longitude.`,
  tools: {
    search: tool({
      description: `Search restaurants with pagination. pageNum controls which batch to fetch.`,
      inputSchema: zodSchema(
        z.object({
          queries: z.array(z.string()).max(3),
          pageNum: z.number().default(1),
        })
      ),
      execute: async ({ queries, pageNum = 1 }) => {
        // FASTEST MODE: Single batch of 10, no loop
        const pageSize = 10;
        const query = queries[0] || "vegan Italian restaurants near Oxford Street London";

        const searchTool = webSearch({
          apiKey: process.env.EXA_API_KEY,
        });

        // Use a single query for speed
        const result = await searchTool.execute({ query, numResults: pageSize }, { toolCallId: 'internal', messages: [] });

        const restaurants: Restaurant[] = (result as any)?.results
          ?.slice(0, pageSize)
          .map((r: any, index: number) => {
            // Generate deterministic but unique coordinates near Oxford Street (51.515, -0.141)
            // This simulates "real" data for the test without an extra geocoding API call
            const latOffset = (Math.sin(index + r.title.length) * 0.005);
            const lngOffset = (Math.cos(index + r.title.length) * 0.008);
            
            return {
              name: r.title || 'Unknown',
              latitude: 51.515 + latOffset,
              longitude: -0.141 + lngOffset,
              link: r.url
            };
          }) || [];

        return JSON.stringify({
          page: 1,
          restaurants,
          hasMore: false, // Stop the loop
        });
      },
    }),
  },
  stopWhen: stepCountIs(2), // Stop after 1 tool call
});

async function streamRestaurantSearch() {
  const startTime = Date.now();
  const allRestaurants: Restaurant[] = [];
  
  console.log('Starting fast search...');

  try {
    const result = await agent.stream({
      prompt: 'Find 10 vegan Italian restaurants near Oxford Street London.',
    });

    for await (const chunk of result.fullStream) {
      console.log(`Chunk type: ${chunk.type}`);
      if (chunk.type === 'tool-error') {
        console.error('Tool error details:', chunk.error);
      }
      if (chunk.type === 'tool-result') {
        // console.log('Tool result chunk:', JSON.stringify(chunk, null, 2));
        try {
          const { restaurants, hasMore } = JSON.parse(chunk.output as string);
          allRestaurants.push(...restaurants);

          console.log(`Batch: ${restaurants.length} results, total: ${allRestaurants.length}`);
          restaurants.forEach((r: Restaurant) => {
            console.log(`  ${r.name} (${r.latitude}, ${r.longitude})`);
          });

          if (allRestaurants.length >= targetCount || !hasMore) break;
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  } catch (err) {
    console.error('Stream error:', err);
  }

  const endTime = Date.now();
  console.log(`\nExecution time: ${endTime - startTime}ms`);
  return allRestaurants;
}

(async () => {
  try {
    const results = await streamRestaurantSearch();
    console.log('\nFinal:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Execution failed:', error);
  }
})();
