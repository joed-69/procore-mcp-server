import cors from "cors";
import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { createProcoreClient } from "./procore.js";

const config = loadConfig();
const procore = createProcoreClient(config);

function requireConfirmed(confirmed: boolean | undefined): void {
  if (!confirmed) {
    throw new Error("This write action requires confirmed: true after the user approves the exact Procore change.");
  }
}

function textResult(text: string, structuredContent?: Record<string, unknown>) {
  return {
    structuredContent,
    content: [{ type: "text" as const, text }]
  };
}

function buildServer() {
  const server = new McpServer(
    { name: "cdo-procore-tools", version: "0.1.0" },
    {
      instructions:
        "Use these tools only for approved CDO Procore projects. Confirm project ID before writes. Write tools require confirmed: true after the user approves the exact change."
    }
  );

  server.registerTool(
    "list_projects",
    {
      title: "List Procore projects",
      description: "Find active Procore projects available to this integration.",
      inputSchema: {
        page: z.number().int().min(1).max(100).optional(),
        per_page: z.number().int().min(1).max(100).optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async ({ page = 1, per_page = 25 }) => {
      const projects = await procore.request<unknown[]>(
        `/rest/v1.0/projects?page=${page}&per_page=${per_page}`
      );
      return textResult(`Found ${projects.length} Procore projects.`, { projects });
    }
  );

  server.registerTool(
    "get_daily_log_notes",
    {
      title: "Get daily log notes",
      description: "Read Daily Log notes for a project. Use this before creating a new note when checking context.",
      inputSchema: {
        project_id: z.union([z.string(), z.number()]),
        log_date: z.string().describe("Date in YYYY-MM-DD format").optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async ({ project_id, log_date }) => {
      procore.assertProjectAllowed(project_id);
      const query = log_date ? `?log_date=${encodeURIComponent(log_date)}` : "";
      const notes = await procore.request<unknown[]>(
        `/rest/v1.0/projects/${project_id}/notes_logs${query}`
      );
      return textResult(`Found ${notes.length} daily log notes.`, { notes });
    }
  );

  server.registerTool(
    "create_daily_log_note",
    {
      title: "Create daily log note",
      description:
        "Create a Procore Daily Log note after the user confirms the project, date, title, and description.",
      inputSchema: {
        project_id: z.union([z.string(), z.number()]),
        log_date: z.string().describe("Date in YYYY-MM-DD format"),
        title: z.string().min(1),
        description: z.string().min(1),
        confirmed: z.boolean().describe("Must be true only after user confirmation")
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async ({ project_id, log_date, title, description, confirmed }) => {
      requireConfirmed(confirmed);
      procore.assertProjectAllowed(project_id);
      const created = await procore.request<unknown>(`/rest/v1.0/projects/${project_id}/notes_logs`, {
        method: "POST",
        body: JSON.stringify({
          notes_log: {
            log_date,
            title,
            notes: description
          }
        })
      });
      return textResult("Created a Procore daily log note.", { created });
    }
  );

  server.registerTool(
    "list_rfis",
    {
      title: "List RFIs",
      description: "Read RFIs for a Procore project.",
      inputSchema: {
        project_id: z.union([z.string(), z.number()]),
        page: z.number().int().min(1).max(100).optional(),
        per_page: z.number().int().min(1).max(100).optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async ({ project_id, page = 1, per_page = 25 }) => {
      procore.assertProjectAllowed(project_id);
      const rfis = await procore.request<unknown[]>(
        `/rest/v1.0/projects/${project_id}/rfis?page=${page}&per_page=${per_page}`
      );
      return textResult(`Found ${rfis.length} RFIs.`, { rfis });
    }
  );

  server.registerTool(
    "list_submittals",
    {
      title: "List submittals",
      description: "Read submittals for a Procore project.",
      inputSchema: {
        project_id: z.union([z.string(), z.number()]),
        page: z.number().int().min(1).max(100).optional(),
        per_page: z.number().int().min(1).max(100).optional()
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async ({ project_id, page = 1, per_page = 25 }) => {
      procore.assertProjectAllowed(project_id);
      const submittals = await procore.request<unknown[]>(
        `/rest/v1.0/projects/${project_id}/submittals?page=${page}&per_page=${per_page}`
      );
      return textResult(`Found ${submittals.length} submittals.`, { submittals });
    }
  );

  if (config.enableRawProcoreTool) {
    server.registerTool(
      "procore_raw_request",
      {
        title: "Raw Procore request",
        description:
          "Developer-only helper for testing a Procore REST path. Keep ENABLE_RAW_PROCORE_TOOL=false in production.",
        inputSchema: {
          method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]).default("GET"),
          path: z.string().startsWith("/rest/"),
          body: z.record(z.unknown()).optional(),
          confirmed: z.boolean().optional()
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: true
        }
      },
      async ({ method, path, body, confirmed }) => {
        if (method !== "GET") {
          requireConfirmed(confirmed);
        }
        const result = await procore.request<unknown>(path, {
          method,
          body: body ? JSON.stringify(body) : undefined
        });
        return textResult(`Procore ${method} ${path} completed.`, { result });
      }
    );
  }

  return server;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const transports: Record<string, StreamableHTTPServerTransport> = {};

function isAuthorized(req: Request): boolean {
  if (!config.mcpBearerToken) {
    return true;
  }
  return req.header("authorization") === `Bearer ${config.mcpBearerToken}`;
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "cdo-procore-mcp" });
});

app.all("/mcp", async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const sessionId = req.header("mcp-session-id");
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports[newSessionId] = transport;
        }
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      const server = buildServer();
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid MCP session ID provided"
        },
        id: null
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal server error"
        },
        id: null
      });
    }
  }
});

app.listen(config.port, () => {
  console.log(`Procore MCP server listening on port ${config.port}`);
});
