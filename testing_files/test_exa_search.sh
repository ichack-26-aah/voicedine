#!/bin/bash

API_KEY="${1:-your_exa_api_key_here}"
QUERY="vegan Italian restaurants near Oxford Street London"

echo "=== Testing Exa API ==="
echo "Query: $QUERY"
echo ""

curl -X POST "https://api.exa.ai/search" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d @- << 'JSON'
{
  "query": "vegan Italian restaurants near Oxford Street London",
  "type": "fast",
  "num_results": 10,
  "livecrawl": "never",
  "contents": {
    "summary": {
      "query": "Extract restaurant name, latitude and longitude",
      "schema": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "latitude": {"type": "number"},
          "longitude": {"type": "number"}
        },
        "required": ["name", "latitude", "longitude"]
      }
    }
  }
}
JSON

echo ""
echo "Done!"
