import { streamText } from "ai";
import { headers } from "next/headers";
import { generateSystemPrompt } from "@json-render/core";
import { minuteRateLimit, dailyRateLimit } from "@/lib/rate-limit";
import { playgroundCatalog } from "@/lib/catalog";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const maxDuration = 30;

const SYSTEM_PROMPT = generateSystemPrompt(playgroundCatalog, {
  customRules: [
    "For forms: Card should be the root element, not wrapped in a centering Stack",
    "NEVER use viewport height classes (min-h-screen, h-screen) - breaks the container",
    "NEVER use page background colors (bg-gray-50) - container has its own background",
  ],
});

const openAICompatibleProvider = createOpenAICompatible({
  name: "private-provider",
  apiKey: process.env.AI_GATEWAY_API_KEY!,
  baseURL: process.env.AI_GATEWAY_BASE_URL! ?? "",
});

const MAX_PROMPT_LENGTH = 500;

export async function POST(req: Request) {
  const { prompt, context } = await req.json();
  const previousTree = context?.previousTree;

  const sanitizedPrompt = String(prompt || "").slice(0, MAX_PROMPT_LENGTH);

  // Build the user prompt, including previous tree for iteration
  let userPrompt = sanitizedPrompt;
  if (
    previousTree &&
    previousTree.root &&
    Object.keys(previousTree.elements || {}).length > 0
  ) {
    userPrompt = `CURRENT UI STATE (already loaded, DO NOT recreate existing elements):
${JSON.stringify(previousTree, null, 2)}

USER REQUEST: ${sanitizedPrompt}

IMPORTANT: The current UI is already loaded. Output ONLY the patches needed to make the requested change:
- To add a new element: {"op":"add","path":"/elements/new-key","value":{...}}
- To modify an existing element: {"op":"set","path":"/elements/existing-key","value":{...}}
- To update the root: {"op":"set","path":"/root","value":"new-root-key"}
- To add children: update the parent element with new children array

DO NOT output patches for elements that don't need to change. Only output what's necessary for the requested modification.`;
  }

  const result = streamText({
    model: openAICompatibleProvider(process.env.AI_GATEWAY_MODEL!),
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result.toTextStreamResponse();
}
