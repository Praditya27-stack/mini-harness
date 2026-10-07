import { RouterProvider } from '../providers/router.js';
import type { ChatMessage, ReActStep, RunResult, Skill, EngineEvent, EngineEventHandler, EngineEventType } from './types.js';

/**
 * ANSI Color Palette untuk konsol terminal (Zero external dependencies).
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

export interface EngineOptions {
  maxSteps?: number;
  routerProvider?: RouterProvider;
  onEvent?: EngineEventHandler;
}

/**
 * ReActEngine - Runtime Loop Engine yang mengontrol alur Reasoning dan Acting.
 */
export class ReActEngine {
  private skills: Map<string, Skill> = new Map();
  private maxSteps: number;
  private router: RouterProvider;
  private onEvent?: EngineEventHandler;

  constructor(skills: Skill[] = [], options: EngineOptions = {}) {
    for (const skill of skills) {
      this.registerSkill(skill);
    }
    this.maxSteps = options.maxSteps ?? parseInt(process.env.MAX_STEPS || '6', 10);
    this.router = options.routerProvider ?? new RouterProvider();
    this.onEvent = options.onEvent;
  }

  /**
   * Mendaftarkan modular skill ke dalam registry engine.
   */
  registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  /**
   * Menyiapkan instruksi sistem awal untuk memandu perilaku agen.
   */
  private buildSystemPrompt(): string {
    return [
      "You are 'Mini-Harness', an ultra-lightweight autonomous agent runtime built on a robust ReAct (Reasoning + Acting) loop.",
      "",
      "OPERATING PROTOCOL:",
      "1. Analyze the given problem carefully and formulate an action plan.",
      "2. If you need information or need to affect changes, invoke the provided tools using standard tool calling.",
      "3. When you receive a tool's observation, critically synthesize the data before choosing the next step.",
      "4. When you have sufficient data to fulfill the user's objective, output your final answer directly as plain text without calling any further tools.",
      "5. Strive for concise, factual, and actionable outputs. Never hallucinate contents of files you haven't inspected."
    ].join('\n');
  }

  /**
   * Menjalankan ReAct loop untuk menyelesaikan task tertentu.
   */
  async run(task: string, onEventCallback?: EngineEventHandler): Promise<RunResult> {
    const emit = (type: EngineEventType, data: any) => {
      const event: EngineEvent = { type, data, timestamp: Date.now() };
      if (onEventCallback) onEventCallback(event);
      if (this.onEvent) this.onEvent(event);
    };

    emit('start', { task, maxSteps: this.maxSteps });

    const steps: ReActStep[] = [];
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(),
      },
      {
        role: 'user',
        content: task,
      },
    ];

    console.log(`\n${colors.bold}${colors.blue}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}║              MINI-HARNESS AGENT RUNTIME ENGINE               ║${colors.reset}`);
    console.log(`${colors.bold}${colors.blue}╚══════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log(`${colors.gray}🎯 Target Task:${colors.reset} ${colors.bold}${task}${colors.reset}\n`);

    const skillsList = Array.from(this.skills.values());

    for (let currentStep = 1; currentStep <= this.maxSteps; currentStep++) {
      emit('step', { currentStep, maxSteps: this.maxSteps });
      console.log(`${colors.dim}--- [Loop Step ${currentStep} of ${this.maxSteps}] ---${colors.reset}`);

      let response;
      try {
        response = await this.router.chatCompletion(messages, skillsList);
      } catch (err: any) {
        emit('error', { message: err.message, step: currentStep });
        throw err;
      }

      const { content, toolCalls, rawMessage } = response;

      // 1. Tampilkan THINKING jika LLM memberikan penalaran teks bersamaan dengan tool calls
      if (content && toolCalls && toolCalls.length > 0) {
        emit('thinking', { step: currentStep, content });
        console.log(`${colors.cyan}${colors.bold}[THINKING]${colors.reset} ${content}`);
      }

      // 2. Jika model memutuskan memanggil tool (ACTION)
      if (toolCalls && toolCalls.length > 0) {
        messages.push(rawMessage);

        for (const toolCall of toolCalls) {
          emit('action', { step: currentStep, tool: toolCall.name, arguments: toolCall.arguments, id: toolCall.id });
          
          const skill = this.skills.get(toolCall.name);
          const stepRecord: ReActStep = {
            step: currentStep,
            thought: content || undefined,
            toolCall,
          };

          console.log(
            `${colors.yellow}${colors.bold}[ACTION]${colors.reset} Eksekusi Tool: \x1b[4m${toolCall.name}\x1b[0m | Args:`,
            JSON.stringify(toolCall.arguments)
          );

          let observation: string;
          if (!skill) {
            observation = `[ERROR]: Skill '${toolCall.name}' tidak terdaftar pada engine.`;
          } else {
            try {
              observation = await skill.execute(toolCall.arguments);
            } catch (err: any) {
              observation = `[EXCEPTION]: Terjadi kesalahan saat eksekusi skill '${toolCall.name}': ${err.message}`;
            }
          }

          stepRecord.observation = observation;
          steps.push(stepRecord);
          
          emit('observation', { step: currentStep, tool: toolCall.name, observation });

          // Cuplikan log observation agar rapi di layar
          const previewObs = observation.length > 350
            ? observation.slice(0, 350) + `\n${colors.dim}... [Output dipotong: Total ${observation.length} karakter]${colors.reset}`
            : observation;

          console.log(`${colors.magenta}${colors.bold}[OBSERVATION]${colors.reset}\n${previewObs}\n`);

          // Daftarkan hasil observasi kembali ke riwayat chat
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.name,
            content: observation,
          });
        }
      } else {
        // 3. Jika model tidak memanggil tools lagi -> FINAL ANSWER
        const finalAnswer = content || '(Tidak ada konten jawaban yang dihasilkan oleh model)';
        emit('final_answer', { step: currentStep, answer: finalAnswer });
        console.log(`${colors.green}${colors.bold}[FINAL ANSWER]${colors.reset}\n${finalAnswer}\n`);

        const result: RunResult = {
          task,
          finalAnswer,
          steps,
          success: true,
          totalSteps: currentStep,
        };
        emit('done', result);
        return result;
      }
    }

    // 4. Jika menyentuh MAX_STEPS tanpa jawaban final
    console.log(`${colors.red}${colors.bold}[LIMIT EXCEEDED]${colors.reset} Runtime mencapai batas ${this.maxSteps} langkah sebelum selesai.\n`);
    const failedResult: RunResult = {
      task,
      finalAnswer: 'Eksekusi dihentikan: Mencapai batas MAX_STEPS sebelum task terselesaikan secara utuh.',
      steps,
      success: false,
      totalSteps: this.maxSteps,
    };
    emit('error', { message: 'Max steps exceeded', result: failedResult });
    emit('done', failedResult);
    return failedResult;
  }
}
