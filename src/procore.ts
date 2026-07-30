import { Config } from "./config.js";

type TokenState = {
  accessToken: string;
  expiresAtMs: number;
};

export type ProcoreClient = {
  request<T>(path: string, options?: RequestInit): Promise<T>;
  assertProjectAllowed(projectId: string | number): void;
};

let tokenState: TokenState | undefined;

async function getAccessToken(config: Config): Promise<string> {
  const now = Date.now();
  if (tokenState && tokenState.expiresAtMs > now + 60_000) {
    return tokenState.accessToken;
  }

  const response = await fetch(`${config.procoreBaseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.procoreClientId,
      client_secret: config.procoreClientSecret
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Procore token request failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  tokenState = {
    accessToken: data.access_token,
    expiresAtMs: now + (data.expires_in ?? 7200) * 1000
  };

  return tokenState.accessToken;
}

function withCompanyId(path: string, companyId: string): string {
  const url = new URL(path, "https://placeholder.local");
  if (!url.searchParams.has("company_id")) {
    url.searchParams.set("company_id", companyId);
  }
  return `${url.pathname}${url.search}`;
}

export function createProcoreClient(config: Config): ProcoreClient {
  return {
    assertProjectAllowed(projectId: string | number) {
      const id = String(projectId);
      if (config.allowedProjectIds.size > 0 && !config.allowedProjectIds.has(id)) {
        throw new Error(`Project ${id} is not in PROCORE_ALLOWED_PROJECT_IDS.`);
      }
    },

    async request<T>(path: string, options: RequestInit = {}): Promise<T> {
      const accessToken = await getAccessToken(config);
      const apiPath = withCompanyId(path, config.procoreCompanyId);
      const response = await fetch(`${config.procoreBaseUrl}${apiPath}`, {
        ...options,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          ...(options.headers ?? {})
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Procore API request failed: ${response.status} ${text}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    }
  };
}
