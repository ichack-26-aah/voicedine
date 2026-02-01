READ THROUGH THIS FILE exa-ai.md. IMPLEMENT IT WITH MINIMAL CODE TO SWAP OUT THE CURRENT EXA LOGIC WITH THAT. PLEASE PLAN THIS FIRST. THE WHOLE POINT IS, WHEN WE HIT THE API WE WANT TO SEE THE FIRST RESULT PLOTTED ON THE MAP REALLY FAST, AND THEN THE REST AS THEY COME IN. IT SHOULD RESET IF WE HIT THE FUNCTION / API AGAIN N WIPE THE OLD ONES FROM THE MAP 
Why we're building Exa-style streaming search:

You shared Exa.ai's restaurant search page showing real-time streaming results with favicons appearing instantly. You loved how it:

Streams results one-by-one (not all at once)

Shows website favicons immediately

Feels incredibly fast

Has beautiful progressive rendering

We reverse-engineered it and built exact replica using SSE + asyncio.as_completed() + DuckDuckGo favicons. Now you have production-ready code for your team to deploy instantly. 10x faster than sequential fetching!


AND NATURALLY THE OUTPUT IS TO RENDER IT ONTO THE MAP!!