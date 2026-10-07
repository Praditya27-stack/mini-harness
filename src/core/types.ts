/**
 * Tipe untuk parameter skema tool berbasis JSON Schema.
 */
export interface JSONSchema {
  type: string;
  properties?: Record<
    string,
    {
      type: string;
      description?: string;
      enum?: string[];
      items?: unknown;
      [key: string]: unknown;
    }
  >;
  required?: string[];
  description?: string;
  [key: string]: unknown;
}

/**
 * Kontrak standar untuk modular skill/tool yang dapat dieksekusi oleh Agent.
 */
export interface Skill {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (args: Record<string, any>) => Promise<string> | string;
}

/**
 * Representasi pemanggilan tool dari LLM yang telah di-parse.
 */
export interface ToolCallItem {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * Jejak langkah dalam runtime ReAct Loop.
 */
export interface ReActStep {
  step: number;
  thought?: string;
  toolCall?: ToolCallItem;
  observation?: string;
}

/**
 * Hasil akhir eksekusi task oleh Engine.
 */
export interface RunResult {
  task: string;
  finalAnswer: string;
  steps: ReActStep[];
  success: boolean;
  totalSteps: number;
}

/**
 * Struktur pesan chat kompatibel dengan OpenAI API format.
 */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
}

/**
 * Respon yang dinormalisasi dari Router Provider.
 */
export interface RouterChatResponse {
  content: string | null;
  toolCalls?: ToolCallItem[];
  rawMessage: ChatMessage;
}

/**
 * Tipe event yang dipancarkan selama eksekusi ReAct Loop.
 */
export type EngineEventType =
  | 'start'
  | 'step'
  | 'thinking'
  | 'action'
  | 'observation'
  | 'final_answer'
  | 'error'
  | 'done';

export interface EngineEvent {
  type: EngineEventType;
  data: any;
  timestamp: number;
}

export type EngineEventHandler = (event: EngineEvent) => void;
