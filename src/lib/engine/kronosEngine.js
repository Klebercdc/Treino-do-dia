import { orchestrate } from "./orchestrator";

export async function KronosEngine(message, user) {
  return await orchestrate(message, user);
}
