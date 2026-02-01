import { RestaurantResult } from './types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Stream restaurant results via SSE.
 * Returns an AbortController to cancel the stream (e.g., on new search).
 */
export function streamRestaurants(
  prompt: string,
  onRestaurant: (restaurant: RestaurantResult) => void,
  onDone: (count: number) => void,
  onError: (error: string) => void
): AbortController {
  const controller = new AbortController();
  let receivedCount = 0;
  let doneReceived = false;

  console.log('[STREAM] Starting SSE stream for:', prompt);

  (async () => {
    try {
      console.log('[STREAM] Fetching from:', `${API_BASE_URL}/api/exa/research/stream`);
      const response = await fetch(`${API_BASE_URL}/api/exa/research/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      console.log('[STREAM] Response status:', response.status);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[STREAM] Stream ended. Total received:', receivedCount);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Split on double newline (SSE event separator)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;
          
          const lines = eventBlock.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (!eventData) continue;

          if (eventType === 'done') {
            console.log('[STREAM] Received done event, count:', eventData);
            doneReceived = true;
            onDone(parseInt(eventData, 10));
          } else if (eventType === 'error') {
            console.error('[STREAM] Received error event:', eventData);
            try {
              const errorObj = JSON.parse(eventData);
              onError(errorObj.message || eventData);
            } catch {
              onError(eventData);
            }
          } else {
            try {
              const restaurant = JSON.parse(eventData) as RestaurantResult;
              console.log(`[STREAM] Received #${receivedCount + 1}:`, restaurant.name, 
                `at (${restaurant.geolocation.latitude.toFixed(4)}, ${restaurant.geolocation.longitude.toFixed(4)})`);
              onRestaurant(restaurant);
              receivedCount++;
            } catch {
              console.warn('[STREAM] Failed to parse restaurant:', eventData);
            }
          }
        }
      }
      
      // If stream ended without explicit 'done' event, call onDone with received count
      if (!doneReceived) {
        console.log('[STREAM] No done event, calling onDone with:', receivedCount);
        onDone(receivedCount);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[STREAM] Stream error:', err);
        onError(err instanceof Error ? err.message : 'Stream failed');
      } else {
        console.log('[STREAM] Stream aborted');
      }
    }
  })();;

  return controller;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  healthCheck: () =>
    request<{ status: string }>("/health", { cache: "no-store" }),
};
