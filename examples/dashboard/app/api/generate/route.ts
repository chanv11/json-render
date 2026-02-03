import { streamText } from "ai";
import { generateSystemPrompt } from "@json-render/core";
import { dashboardCatalog } from "@/lib/catalog";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const maxDuration = 30;

const SYSTEM_PROMPT = generateSystemPrompt(dashboardCatalog);

const openAICompatibleProvider = createOpenAICompatible({
  name: "private-provider",
  apiKey: process.env.AI_GATEWAY_API_KEY!,
  baseURL: process.env.AI_GATEWAY_BASE_URL! ?? "",
});

console.log(process.env.AI_GATEWAY_API_KEY, process.env.AI_GATEWAY_BASE_URL);
console.log(process.env.AI_GATEWAY_MODEL);

export async function POST(req: Request) {
  const { prompt, context } = await req.json();

  let fullPrompt = prompt;

  // Add data context
  if (context?.data) {
    fullPrompt += `\n\nAVAILABLE DATA:\n${JSON.stringify(context.data, null, 2)}`;
  }

  const result = streamText({
    model: openAICompatibleProvider(process.env.AI_GATEWAY_MODEL!),
    system: SYSTEM_PROMPT,
    prompt: fullPrompt,
  });

  return result.toTextStreamResponse();
}
