import fs from 'node:fs';
import path from 'node:path';
import type { Skill } from '../core/types.js';

export const fsReaderSkill: Skill = {
  name: 'fs_reader',
  description: 'Membaca konten teks dari sebuah file lokal secara aman (read-only).',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path (relatif atau absolut) menuju file yang akan dibaca.'
      }
    },
    required: ['filePath']
  },
  execute: async (args: Record<string, any>): Promise<string> => {
    const { filePath } = args;
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return 'Error: Parameter "filePath" wajib diisi dengan format string.';
    }

    try {
      const allowedRoot = process.cwd();
      const resolvedPath = path.resolve(allowedRoot, filePath);
      const relative = path.relative(allowedRoot, resolvedPath);

      // Proteksi Directory Traversal (Mencegah pengaksesan file di luar root proyek)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return `Error: Access denied. Directory traversal protection aktif. Path [${filePath}] berada di luar root proyek.`;
      }

      if (!fs.existsSync(resolvedPath)) {
        return `Error: File tidak ditemukan di lokasi: ${resolvedPath}`;
      }

      const stat = await fs.promises.stat(resolvedPath);
      if (!stat.isFile()) {
        return `Error: Path yang diminta [${resolvedPath}] bukan sebuah file reguler.`;
      }

      // Batasi ukuran file hingga 250KB agar tidak melebihi konteks token LLM
      const MAX_SIZE = 250 * 1024; 
      if (stat.size > MAX_SIZE) {
        return `Error: Ukuran file terlalu besar (${(stat.size / 1024).toFixed(2)} KB). Maksimal adalah 250KB.`;
      }

      const content = await fs.promises.readFile(resolvedPath, 'utf-8');
      return content;
    } catch (err: any) {
      return `Error: Sistem gagal membaca file. Pesan error: ${err.message}`;
    }
  }
};
