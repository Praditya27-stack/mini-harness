import dotenv from 'dotenv';
import { ReActEngine } from './core/engine.js';
import { fsReaderSkill } from './skills/fs_reader.js';
import { shellExecSkill } from './skills/shell_exec.js';

// Muat konfigurasi environment
dotenv.config();

async function bootstrap() {
  console.log("\x1b[36m[SYSTEM] Memulai Mini-Harness Boot Sequence...\x1b[0m");

  // Inisialisasi engine dengan modular skills
  const engine = new ReActEngine([fsReaderSkill, shellExecSkill]);

  // Sample Task untuk CLI Smoke Testing sesuai permintaan pengguna
  const sampleTask = "Tolong baca file package.json di root directory ini, analisa dependency apa saja yang diinstall, lalu tolong jalankan perintah 'npm -v' menggunakan skill eksekusi shell untuk memberitahu saya versi NPM lokal.";

  try {
    // Eksekusi otonom
    const result = await engine.run(sampleTask);
    
    if (result.success) {
      console.log(`\x1b[32m[SYSTEM] Task berhasil diselesaikan secara otonom dalam ${result.totalSteps} langkah.\x1b[0m`);
    } else {
      console.log('\x1b[31m[SYSTEM] Task gagal diselesaikan atau diinterupsi oleh pembatasan sistem.\x1b[0m');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error(`\x1b[31m[CRITICAL FAILURE] Terjadi kesalahan fatal (Kernel Panic): ${error.message}\x1b[0m`);
    process.exit(1);
  }
}

// Jalankan program utama
bootstrap();
