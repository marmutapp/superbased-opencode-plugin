/**
 * SuperBased hook handlers for OpenCode lifecycle events.
 *
 * The plugin keeps lifecycle interception minimal — the heavy lifting happens
 * in the SuperBased MCP server (configured separately in opencode.json under
 * `mcp.superbased`). These hooks add ergonomic value-add on top:
 *
 *   - tool.execute.before — pre-flight safety: warn if a destructive
 *     SuperBased GUI action runs without `confirm: true` (the server enforces
 *     this anyway, but surfacing it client-side gives a better UX).
 *   - tool.execute.after  — post-flight telemetry: log durations of expensive
 *     SuperBased calls (recording, narrate, scroll_capture) so users notice
 *     when they're paying the cost.
 *   - permission.asked     — when permission is being asked for a SuperBased
 *     tool, surface the audit-log location once per session so users know
 *     where actions are being recorded.
 */

const STATE_MODIFYING_GUI_TOOLS = new Set([
  "superbased_click",
  "superbased_type",
  "superbased_hotkey",
  "superbased_scroll",
  "superbased_drag",
  "superbased_drag_file",
  "superbased_hover",
  "superbased_sequence",
  "superbased_form_fill",
  "superbased_dialog_handle",
  "superbased_context_menu_select",
  "superbased_ax_invoke",
  "superbased_tab_management",
  "superbased_virtual_desktop",
  "superbased_tray_click",
]);

const EXPENSIVE_TOOLS = new Set([
  "superbased_recording",
  "superbased_narrate",
  "superbased_scroll_capture",
  "superbased_describe_frames",
  "superbased_diff",
  "superbased_export",
  "superbased_compress_text",
]);

const auditLogSurfaced = new WeakSet<object>();

export interface ToolHookInput {
  tool?: string;
  args?: Record<string, unknown>;
}

export interface ToolHookOutput {
  args?: Record<string, unknown>;
  warnings?: string[];
}

export const startTimes = new Map<string, number>();

export function onToolExecuteBefore(input: ToolHookInput, output: ToolHookOutput): void {
  if (!input.tool || !input.tool.startsWith("superbased_")) return;

  if (STATE_MODIFYING_GUI_TOOLS.has(input.tool)) {
    const args = output.args ?? input.args ?? {};
    if (args.confirm !== true) {
      output.warnings = output.warnings ?? [];
      output.warnings.push(
        `[superbased] ${input.tool} is a state-modifying GUI action — the server will refuse without \`confirm: true\`.`,
      );
    }
  }

  startTimes.set(input.tool, Date.now());
}

export function onToolExecuteAfter(input: ToolHookInput, _output: ToolHookOutput): void {
  if (!input.tool || !input.tool.startsWith("superbased_")) return;

  const start = startTimes.get(input.tool);
  if (start && EXPENSIVE_TOOLS.has(input.tool)) {
    const elapsedMs = Date.now() - start;
    if (elapsedMs > 5000) {
      // eslint-disable-next-line no-console
      console.error(`[superbased] ${input.tool} took ${(elapsedMs / 1000).toFixed(1)}s`);
    }
  }
  startTimes.delete(input.tool);
}

export interface PermissionHookInput {
  tool?: string;
  sessionId?: string;
  session?: object;
}

export function onPermissionAsked(input: PermissionHookInput): void {
  if (!input.tool || !input.tool.startsWith("superbased_")) return;
  const sessionKey = (input.session as object | undefined) ?? (globalThis as { __superbasedSession?: object }).__superbasedSession;
  if (!sessionKey || typeof sessionKey !== "object") return;
  if (auditLogSurfaced.has(sessionKey)) return;
  auditLogSurfaced.add(sessionKey);
  // eslint-disable-next-line no-console
  console.error(
    "[superbased] GUI automation actions are recorded to the SuperBased NDJSON audit log " +
      "(see Settings > GUI Automation > Audit Log in the desktop app, or `~/.superbased/logs/audit.ndjson` for headless).",
  );
}
