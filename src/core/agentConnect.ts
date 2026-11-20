// Where a customer connects their own AI agent to Paystrater, for the
// checkout's "How to connect your AI agent" section. The MCP server follows
// the key's mode: a test key points at the sandbox's server.
import type { KeyMode } from "./keys.js"

export const AGENT_MCP_URL: Record<KeyMode, string> = {
  live: "https://agentic.paystrater.com/mcp",
  test: "https://staging-agentic.paystrater.com/mcp"
}

/** The public guide to connecting an agent (paystrater.com/mcp) */
export const AGENT_GUIDE_URL = "https://paystrater.com/mcp"

/** The MCP server URL for a key's mode; live when the mode is not known yet */
export function agentMcpUrl(mode: KeyMode | undefined): string {
  return AGENT_MCP_URL[mode ?? "live"]
}
