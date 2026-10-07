import type { ChatMessage, RouterChatResponse, Skill, OpenAIToolCall } from '../core/types.js';

/**
 * Adapter HTTP Client untuk berkomunikasi dengan API Gateway berbasis OpenAI
 * (seperti 9router, vLLM, atau OpenAI endpoint resmi).
 */
export class RouterProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.baseUrl = (process.env.ROUTER_BASE_URL || "http://localhost:8000/v1").replace(/\/+$/, "");
    this.apiKey = process.env.ROUTER_API_KEY || "";
    this.model = process.env.ROUTER_MODEL || "gemini-1.5-flash";

    if (!this.apiKey) {
      console.warn("\x1b[33m[Warning] ROUTER_API_KEY is not set di environment.\x1b[0m");
    }
  }

  /**
   * Mengirim request chat completion dan me-resolve balasan (text atau tool calls).
   * @param messages Riwayat pesan yang akan dikirim
   * @param skills Array modular skill yang tersedia untuk digunakan
   */
  async chatCompletion(messages: ChatMessage[], skills: Skill[] = []): Promise<RouterChatResponse> {
    // Normalisasi endpoint agar fleksibel terhadap config /v1 atau root URL
    const endpoint = this.baseUrl.endsWith("/v1") 
      ? `${this.baseUrl}/chat/completions` 
      : `${this.baseUrl}/v1/chat/completions`;

    // Konversi bentuk abstrak `Skill` ke `tools` spesifikasi OpenAI API
    const tools = skills.length > 0 ? skills.map(skill => ({
      type: "function",
      function: {
        name: skill.name,
        description: skill.description,
        parameters: skill.parameters,
      }
    })) : undefined;

    const payload = {
      model: this.model,
      messages,
      tools,
      tool_choice: tools ? "auto" : undefined,
      temperature: 0.2, // Temperatur rendah agar deterministik dalam memilih tools
      stream: false, // Wajib di-set false karena 9router default ke stream SSE!
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[RouterProvider] HTTP Request Failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    const choice = data.choices?.[0];
    
    if (!choice || !choice.message) {
      throw new Error(`[RouterProvider] Invalid response payload format: ${JSON.stringify(data)}`);
    }

    const rawMessage = choice.message as ChatMessage;
    let toolCallsParsed = undefined;

    // Parsing argument tools yang dikembalikan dari string JSON ke Objek Record
    if (rawMessage.tool_calls && rawMessage.tool_calls.length > 0) {
      toolCallsParsed = rawMessage.tool_calls.map((tc: OpenAIToolCall) => {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch (err) {
          console.warn(`\x1b[33m[Warning] Failed to parse JSON arguments for tool ${tc.function.name}: ${tc.function.arguments}\x1b[0m`);
        }
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        };
      });
    }

    return {
      content: rawMessage.content || null,
      toolCalls: toolCallsParsed,
      rawMessage,
    };
  }
}
