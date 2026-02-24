# Supabase MCP setup (so tools are exposed to the agent)

Your `.cursor/mcp.json` is configured for the **hosted Supabase MCP**, scoped to this project and read-only.

## If Supabase MCP tools don’t appear in the agent

1. **Authenticate**
   - Cursor should open a browser so you can log in to Supabase and grant org access.
   - If it didn’t, open **Settings → Cursor Settings → Tools & MCP** and add or reconnect the Supabase server.

2. **Check connection**
   - In **Settings → Cursor Settings → Tools & MCP**, confirm the **supabase** server shows as **Connected** (green).
   - If it’s disconnected or missing, use “Add to Cursor” from [Supabase MCP docs](https://supabase.com/docs/guides/getting-started/mcp) or re-add the config from `mcp.json`.

3. **Restart Cursor**
   - Fully quit and reopen Cursor so it picks up the MCP server and exposes tools (e.g. `list_tables`, `execute_sql`) to the agent.

4. **Allow MCP in the chat**
   - In the Composer/Agent panel, ensure MCP tools are allowed for the conversation (e.g. no “restricted” or “disabled” mode for tools).

5. **Optional: local MCP with PAT (if hosted still doesn’t expose tools)**
   - If the hosted URL never shows tools in the agent, you can run the MCP locally with a Personal Access Token:
   - Create a token at [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens).
   - Replace the `supabase` entry in `mcp.json` with:
   ```json
   "supabase": {
     "command": "npx",
     "args": ["-y", "@supabase/mcp-server-supabase@latest", "--read-only", "--project-ref=pqtrsoytudolnvuydvfo"],
     "env": {
       "SUPABASE_ACCESS_TOKEN": "<your-personal-access-token>"
     }
   }
   ```
   - Restart Cursor again after saving.

Project ref used: `pqtrsoytudolnvuydvfo` (from your `VITE_SUPABASE_URL`).
