// Runs once when the server starts. Starts the background reminder scheduler in
// the Node.js runtime only (never in the Edge runtime or during a build).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    await import("./instrumentation-node");
  }
}
