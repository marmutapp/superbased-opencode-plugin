import { spawn } from "node:child_process";

/**
 * Returns true iff the `superbased` CLI is on PATH and `superbased --version`
 * exits cleanly within ~3s. Used at plugin init to surface an actionable
 * error if the user installed the plugin but forgot to install the CLI.
 */
export async function checkSuperbasedReachable(): Promise<{ ok: true; version: string } | { ok: false; reason: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let settled = false;
    const child = spawn("superbased", ["--version"], { stdio: ["ignore", "pipe", "pipe"] });

    const settle = (result: { ok: true; version: string } | { ok: false; reason: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.stdout.on("data", (b) => { stdout += b.toString(); });
    child.on("error", (err) => {
      const msg = (err as NodeJS.ErrnoException).code === "ENOENT"
        ? "`superbased` CLI not found on PATH. Install with: npm install -g superbased"
        : `Failed to spawn superbased CLI: ${err.message}`;
      settle({ ok: false, reason: msg });
    });
    child.on("close", (code) => {
      if (code === 0) {
        settle({ ok: true, version: stdout.trim() || "unknown" });
      } else {
        settle({ ok: false, reason: `superbased --version exited with code ${code}` });
      }
    });

    setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      settle({ ok: false, reason: "superbased --version timed out after 3s" });
    }, 3000);
  });
}
