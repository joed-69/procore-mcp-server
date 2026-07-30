# Procore MCP Server for ChatGPT Agents

This is a Railway-ready starter MCP server for connecting ChatGPT PM and Superintendent agents to Procore.

The server sits between ChatGPT and Procore:

```text
ChatGPT Agent -> Custom MCP app -> Railway MCP server -> Procore API
```

## What This Starter Includes

- A public MCP endpoint at `/mcp`
- A health check at `/health`
- Procore OAuth client-credentials token handling
- Project allowlisting with `PROCORE_ALLOWED_PROJECT_IDS`
- Read tools for projects, daily log notes, RFIs, and submittals
- A write tool for creating Daily Log notes that requires `confirmed: true`
- An optional raw Procore request tool for development only

## Required Railway Variables

Add these in Railway under the service's Variables tab:

```bash
PROCORE_BASE_URL=https://api.procore.com
PROCORE_CLIENT_ID=your_procore_client_id
PROCORE_CLIENT_SECRET=your_procore_client_secret
PROCORE_COMPANY_ID=your_company_id
PROCORE_ALLOWED_PROJECT_IDS=comma,separated,project,ids
```

Optional:

```bash
MCP_BEARER_TOKEN=make_a_long_random_value
ENABLE_RAW_PROCORE_TOOL=false
```

Use `MCP_BEARER_TOKEN` only if your ChatGPT custom MCP setup supports passing a bearer token. Otherwise leave it blank during initial testing, then add proper OAuth protection before broader production use.

## Deploy To Railway

From the Railway screen you are on:

1. Choose **GitHub Repository** if you have pushed this folder to GitHub.
2. Or choose **Empty Project**, then create a service from GitHub later.
3. Set the environment variables above.
4. Let Railway run:

```bash
npm install
npm run build
npm run start
```

5. Open Railway's generated domain.
6. Confirm this works:

```text
https://your-railway-domain.up.railway.app/health
```

7. In ChatGPT's Custom MCP form, use:

```text
https://your-railway-domain.up.railway.app/mcp
```

## ChatGPT Custom MCP Settings

Use these values in the ChatGPT app editor:

- Name: `Procore Tools`
- Description: `Lets the PM and Superintendent agents read approved Procore project data and create confirmed project records.`
- Server URL: `https://your-railway-domain.up.railway.app/mcp`
- Authentication: start with `No Authentication` only for private testing, or use OAuth/Bearer protection if available.

## Safety Rules

Do not put Procore secrets in ChatGPT instructions. Keep them only in Railway variables.

Keep `PROCORE_ALLOWED_PROJECT_IDS` populated. This prevents the server from writing to projects outside your approved list.

Keep `ENABLE_RAW_PROCORE_TOOL=false` after early development. The raw tool is intentionally not suitable for production because it can call arbitrary Procore API paths.

Write tools require `confirmed: true`. Your agent instructions should say:

> Before using any Procore write tool, summarize the exact project, date, destination tool, and record content, then ask the user to confirm.

## First Test Prompts

After connecting the MCP app to ChatGPT, test with:

```text
List the Procore projects this tool can see.
```

```text
Show me today's daily log notes for project 12345.
```

```text
Create a daily log note for project 12345 for 2026-07-29 saying "Site walk completed; no safety issues observed." Ask me to confirm before submitting it.
```

## Notes About Procore Endpoints

This starter uses common Procore REST paths for projects, daily log note logs, RFIs, and submittals. Procore tools can vary by account configuration and permissions. If an endpoint returns a validation error, use the error message and Procore API reference to adjust the request body for your enabled tools.

Useful Procore references:

- OAuth client credentials: https://developers.procore.com/documentation/oauth-client-credentials
- Daily Logs API: https://developers.procore.com/reference/rest/daily-logs
- Notes Logs API: https://developers.procore.com/reference/rest/notes-logs
- RFIs API: https://developers.procore.com/reference/rest/rfis
- Submittals API: https://developers.procore.com/reference/rest/submittals

Useful OpenAI references:

- Build an MCP server: https://developers.openai.com/plugins/build/mcp-server
- Connect and test in ChatGPT: https://developers.openai.com/plugins/deploy/connect-chatgpt
