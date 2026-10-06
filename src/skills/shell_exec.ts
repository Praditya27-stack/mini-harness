import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Skill } from '../core/types.js';

const execAsync = promisify(exec);

export const shellExecSkill: Skill = {
  name: 'shell_exec',
  description: 'Mengeksekusi perintah shell (CLI) pada sistem operasi host. Berguna untuk menjalankan utilitas sistem.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Perintah shell terminal (bash/cmd/pwsh) yang akan dijalankan.'
      }
    },
    required: ['command']
  },
  execute: async (args: Record<string, any>): Promise<string> => {
    const { command } = args;
    if (typeof command !== 'string' || !command.trim()) {
      return 'Error: Parameter "command" tidak valid atau kosong.';
    }

    try {
      // Menjalankan perintah dengan timeout ketat (10 detik) dan memory aman
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 10000, 
        maxBuffer: 2 * 1024 * 1024 // Max 2MB buffer console output
      });

      let output = stdout.trim();
      if (stderr.trim()) {
        output += `\n[STDERR]:\n${stderr.trim()}`;
      }
      
      return output || '[SUKSES] Perintah berhasil dijalankan tanpa output (silent operation).';
    } catch (err: any) {
      // Menangkap eksekusi yang error (Exit Code != 0) atau terkena batas timeout
      let errorMessage = `[ERROR] Eksekusi shell gagal.\nCode: ${err.code || 'Unknown'}\n`;
      if (err.killed && err.signal === 'SIGTERM') {
        errorMessage += 'Penyebab: PROSES TERKENA TIMEOUT (melebihi batas 10 detik).';
      } else {
        errorMessage += `Detail: ${err.message}`;
      }
      
      return errorMessage;
    }
  }
};
