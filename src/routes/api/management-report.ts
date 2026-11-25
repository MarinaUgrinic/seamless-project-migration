import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/management-report")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleManagementReport } = await import("@/lib/ai/management-report.server");
    return handleManagementReport(request);
  } } },
});