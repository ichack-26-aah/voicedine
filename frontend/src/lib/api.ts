const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  // Grok requirement extraction
  extractRequirements: (
    transcript: string,
    existingRequirements?: string[]
  ) =>
    request<{ requirements: string[]; success: boolean; error?: string }>(
      "/api/grok/extract",
      {
        method: "POST",
        body: JSON.stringify({
          transcript,
          existing_requirements: existingRequirements,
        }),
      }
    ),

  // Booking - trigger Bland AI call to restaurant
  bookRestaurant: (restaurantName: string, phoneNumber: string) =>
    request<{ status: string; data: unknown }>(
      "/api/booking/book",
      {
        method: "POST",
        body: JSON.stringify({
          restaurant_name: restaurantName,
          phone_number: phoneNumber,
        }),
      }
    ),
};
