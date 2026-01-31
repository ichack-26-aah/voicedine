import { apiClient } from "@/lib/api";

export default async function Home() {
  let backendStatus = "unknown";
  try {
    const data = await apiClient.healthCheck();
    backendStatus = data.status;
  } catch {
    backendStatus = "unreachable";
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">VoiceDine</h1>
      <p className="text-lg text-gray-600 mb-8">
        Full-stack application powered by Next.js and FastAPI
      </p>
      <div className="rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500">Backend status</p>
        <p
          className={`text-lg font-semibold ${
            backendStatus === "ok" ? "text-green-600" : "text-red-600"
          }`}
        >
          {backendStatus}
        </p>
      </div>
    </main>
  );
}
