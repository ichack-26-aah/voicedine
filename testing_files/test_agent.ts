import { ToolLoopAgent, stepCountIs, tool, zodSchema } from 'ai'; // AI SDK v6
import { webSearch } from '@exalabs/ai-sdk';
import { xai } from '@ai-sdk/xai';
import { z } from 'zod';

const agent = new ToolLoopAgent({
  model: xai('grok-4-fast-non-reasoning'),
  instructions: `
  You research questions by searching the web and synthesizing findings.
  Call search with 1-3 diverse queries.
  You can search multiple times if needed to gather more information before providing your answer.
  Your final answer should be in a markdown table with links in the first column.`,
  tools: {
    search: tool({
      description: `Search with 1-3 queries.`,
      inputSchema: zodSchema(z.object({ queries: z.array(z.string()).max(3) })),
      execute: async ({ queries }) => {
        const results = await Promise.all(
          queries.map((q) =>
            webSearch({
              query: q,
              numResults: 5,
              type: 'fast',
              content: { highlights: { numSentences: 3, highlightsPerUrl: 3 } },
              apiKey: process.env.EXA_API_KEY,
            }),
          ),
        );
        return results
          .flatMap((r) => r.results)
          .map((r: any) =>
            `[${r.title}](${r.url}): ${r.highlights?.join('\n') || ''}`,
          )
          .join('\n');
      },
    }),
  },
  stopWhen: stepCountIs(10),
});

async function main() {
  const start = Date.now();
  const result = await agent.generate({ 
    prompt: JSON.stringify({
      "query": "vegan Italian restaurants near Oxford Street London",
      "properties": {
        "name": {"type": "string"},
        "latitude": {"type": "number"},
        "longitude": {"type": "number"}
      },
      "required": ["name", "latitude", "longitude"]
    })
  });

  const duration = Date.now() - start;
  console.log(result.text);
  console.log(`\nExecution time: ${duration}ms`);
}

main().catch(console.error);
