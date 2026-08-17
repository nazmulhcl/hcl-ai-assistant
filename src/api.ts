import type { Message } from "./types";

const API_URL = import.meta.env.VITE_AIFORCE_URL?.trim();
const API_TOKEN = import.meta.env.VITE_AIFORCE_TOKEN?.trim();
const API_USECASE = import.meta.env.VITE_AIFORCE_USECASE?.trim();
const REQUEST_TIMEOUT_MS = 90_000;

export async function sendChatMessage(
  prompt: string,
  messages: Message[],
  signal: AbortSignal,
): Promise<string> {
  if (!API_URL) {
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    return `This is a demo response for “${prompt}”. Add the VITE_AIFORCE settings to your .env file to connect your API.`;
  }

  const isSameOriginProxy = API_URL.startsWith("/");

  if (!API_TOKEN && !isSameOriginProxy) {
    throw new Error(
      "The API bearer token is missing. Use the local proxy or add VITE_AIFORCE_TOKEN.",
    );
  }

  if (!API_USECASE) {
    throw new Error("The API use case is missing. Add VITE_AIFORCE_USECASE to your .env file.");
  }

  const requestController = new AbortController();
  const cancelRequest = () => requestController.abort();
  signal.addEventListener("abort", cancelRequest, { once: true });
  const timeoutId = window.setTimeout(() => requestController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        usecase: API_USECASE,
        input: prompt,
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
      signal: requestController.signal,
    });

    let result: unknown = {};
    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok) {
      const apiDetail =
        result && typeof result === "object" && "message" in result
          ? (result as { message?: unknown }).message
          : undefined;
      const errorMessage =
        typeof apiDetail === "string" && apiDetail.trim()
          ? apiDetail
          : `AIForce request failed with status ${response.status}.`;
      throw new Error(errorMessage);
    }

    const botReply =
      result &&
      typeof result === "object" &&
      "data" in result &&
      (result as { data?: unknown }).data &&
      typeof (result as { data: unknown }).data === "object" &&
      "output" in ((result as { data: object }).data)
        ? ((result as { data: { output?: unknown } }).data.output)
        : undefined;

    if (typeof botReply === "string" && botReply.trim()) {
      return botReply;
    }

    throw new Error("AIForce returned a successful response without data.output.");
  } catch (error) {
    if ((error as Error).name === "AbortError" && !signal.aborted) {
      throw new Error("The API request timed out after 90 seconds.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    signal.removeEventListener("abort", cancelRequest);
  }
}
