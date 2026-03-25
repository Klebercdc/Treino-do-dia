import { KronosEngine } from "@/lib/engine/kronosEngine";

let user = {
  id: "1",
  plan: "pro",
  mode: null,
  step: 0,
  data: {},
  profile: {}
};

export async function POST(req) {
  const { message } = await req.json();
  const result = await KronosEngine(message, user);
  return Response.json(result);
}
