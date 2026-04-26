/**
 * @superbased/opencode-plugin — eyes AND hands for OpenCode.
 *
 * The MCP server (`superbased mcp`) provides the actual 72 tools. This plugin
 * adds lifecycle hooks for ergonomic value-add:
 *   - Pre-flight: warns when destructive GUI actions are called without
 *     `confirm: true`.
 *   - Post-flight: logs durations of expensive SuperBased calls.
 *   - Permission flow: surfaces the audit-log location once per session.
 *   - Init: verifies the `superbased` CLI is reachable on PATH.
 *
 * Users must also configure the MCP server separately under `mcp.superbased`
 * in opencode.json — see opencode.json in this package for the reference
 * config.
 */

import { checkSuperbasedReachable } from "./mcp-bridge.js";
import {
  onPermissionAsked,
  onToolExecuteAfter,
  onToolExecuteBefore,
  type PermissionHookInput,
  type ToolHookInput,
  type ToolHookOutput,
} from "./hooks.js";

export interface SuperbasedPluginContext {
  project?: unknown;
  client?: unknown;
  $?: unknown;
  directory?: unknown;
  worktree?: unknown;
}

export type SuperbasedPlugin = (ctx: SuperbasedPluginContext) => Promise<{
  "tool.execute.before": (input: ToolHookInput, output: ToolHookOutput) => void;
  "tool.execute.after": (input: ToolHookInput, output: ToolHookOutput) => void;
  "permission.asked": (input: PermissionHookInput) => void;
}>;

export const SuperbasedPlugin: SuperbasedPlugin = async (_ctx) => {
  const probe = await checkSuperbasedReachable();
  if (!probe.ok) {
    // eslint-disable-next-line no-console
    console.error(`[superbased] ${probe.reason}`);
    console.error(
      "[superbased] The plugin will load but the MCP server will fail until the CLI is installed.",
    );
  } else {
    // eslint-disable-next-line no-console
    console.error(`[superbased] CLI reachable: ${probe.version}`);
  }

  return {
    "tool.execute.before": onToolExecuteBefore,
    "tool.execute.after": onToolExecuteAfter,
    "permission.asked": onPermissionAsked,
  };
};

export default SuperbasedPlugin;
