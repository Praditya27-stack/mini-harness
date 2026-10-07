import http from 'node:http';
import dotenv from 'dotenv';
import { ReActEngine } from './core/engine.js';
import { fsReaderSkill } from './skills/fs_reader.js';
import { shellExecSkill } from './skills/shell_exec.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Healthcheck endpoint
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));
    return;
  }

  // Run Task via SSE
  if (req.method === 'POST' && url.pathname === '/api/run') {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyData);
        if (!body.task || typeof body.task !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Field "task" is required and must be a string.' }));
          return;
        }

        // Setup SSE Headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        
        if (typeof res.flushHeaders === 'function') {
          res.flushHeaders();
        }

        const sendSSE = (event: string, data: any) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        const engine = new ReActEngine([fsReaderSkill, shellExecSkill]);
        
        // Handle client disconnect gracefully
        let aborted = false;
        req.on('close', () => {
          aborted = true;
          console.log('[Server] Client disconnected, aborting task stream...');
        });

        // Run the task
        await engine.run(body.task, (event) => {
          if (!aborted) {
            sendSSE(event.type, event.data);
          }
        });

        if (!aborted) {
          res.end();
        }
      } catch (err: any) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        } else {
          res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
          res.end();
        }
      }
    });
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`[SYSTEM] Mini-Harness HTTP Service running on port ${PORT}`);
  console.log(`[SYSTEM] Healthcheck: GET /health`);
  console.log(`[SYSTEM] Run Task: POST /api/run (SSE)`);
});
