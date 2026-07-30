export type Config = {
  port: number;
  procoreBaseUrl: string;
  procoreClientId: string;
  procoreClientSecret: string;
  procoreCompanyId: string;
  allowedProjectIds: Set<string>;
  mcpBearerToken?: string;
  enableRawProcoreTool: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAllowedProjectIds(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
    procoreBaseUrl: process.env.PROCORE_BASE_URL ?? "https://api.procore.com",
    procoreClientId: requiredEnv("PROCORE_CLIENT_ID"),
    procoreClientSecret: requiredEnv("PROCORE_CLIENT_SECRET"),
    procoreCompanyId: requiredEnv("PROCORE_COMPANY_ID"),
    allowedProjectIds: parseAllowedProjectIds(process.env.PROCORE_ALLOWED_PROJECT_IDS),
    mcpBearerToken: process.env.MCP_BEARER_TOKEN,
    enableRawProcoreTool: process.env.ENABLE_RAW_PROCORE_TOOL === "true"
  };
}
