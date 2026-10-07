import { useState, useRef, useEffect } from 'react';
import { Play, Square, Settings, Terminal, CheckCircle2, SearchCode, Database, Activity, AlertTriangle, Cpu, BrainCircuit, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type EngineEvent = {
  id: string;
  type: string;
  data: any;
};

export default function App() {
  const [endpointUrl, setEndpointUrl] = useState('https://species-vienna-anchor-construct.trycloudflare.com/api/run');
  const [task, setTask] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of feed
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const runTask = async () => {
    if (!task.trim() || !endpointUrl.trim()) return;
    
    setEvents([]);
    setIsRunning(true);
    
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Stream not supported by browser");

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        
        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split('\n');
          let eventType = 'message';
          let eventDataStr = '';
          
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventDataStr = line.slice(6).trim();
            }
          }
          
          if (eventDataStr) {
            try {
              const dataObj = JSON.parse(eventDataStr);
              setEvents(prev => [...prev, { type: eventType, data: dataObj, id: Math.random().toString(36).substring(7) }]);
              
              if (eventType === 'done' || eventType === 'error') {
                setIsRunning(false);
              }
            } catch (e) {
              console.warn("Failed to parse event data JSON:", eventDataStr);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setEvents(prev => [...prev, { type: 'error', data: { message: err.message || 'Unknown error occurred' }, id: Math.random().toString(36).substring(7) }]);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const stopTask = () => {
    if (abortController) {
      abortController.abort();
      setIsRunning(false);
      setEvents(prev => [...prev, { type: 'error', data: { message: 'Task aborted by user.' }, id: Math.random().toString(36).substring(7) }]);
    }
  };

  const setPreset = (preset: string) => {
    setTask(preset);
  };

  const renderEvent = (evt: EngineEvent) => {
    switch (evt.type) {
      case 'start':
        return (
          <div className="flex items-start gap-4 p-4 border border-zinc-800 bg-zinc-900/50 rounded-xl">
            <div className="p-2 bg-zinc-800 text-zinc-400 rounded-lg shrink-0">
              <Play className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-300">Target Task Init</h3>
              <p className="text-zinc-500 text-sm mt-1">{evt.data.task}</p>
            </div>
          </div>
        );

      case 'step':
        return (
          <div className="flex items-center gap-4 text-xs font-medium text-zinc-600 uppercase tracking-widest my-4">
            <span className="flex-1 h-px bg-zinc-800"></span>
            Loop Step {evt.data.currentStep} / {evt.data.maxSteps}
            <span className="flex-1 h-px bg-zinc-800"></span>
          </div>
        );

      case 'thinking':
        return (
          <div className="flex items-start gap-4 p-4 border border-zinc-800 bg-zinc-900 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-zinc-600"></div>
            <div className="p-2 bg-zinc-800 text-zinc-300 rounded-lg shrink-0">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-zinc-300">Thinking</h3>
              <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{evt.data.content}</p>
            </div>
          </div>
        );

      case 'action':
        return (
          <div className="flex items-start gap-4 p-4 border border-blue-900/50 bg-blue-950/20 rounded-xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <div className="p-2 bg-blue-900/50 text-blue-400 rounded-lg shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-blue-400">Action: {evt.data.tool}</h3>
              <pre className="text-blue-200/70 text-xs mt-2 bg-black/40 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(evt.data.arguments, null, 2)}
              </pre>
            </div>
          </div>
        );

      case 'observation':
        return (
          <div className="flex items-start gap-4 p-4 border border-purple-900/50 bg-purple-950/20 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
            <div className="p-2 bg-purple-900/50 text-purple-400 rounded-lg shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-purple-400">Observation</h3>
              <div className="mt-2 bg-black/60 rounded-lg p-3 border border-purple-900/30 overflow-hidden">
                <pre className="text-purple-200/80 text-xs overflow-x-auto whitespace-pre-wrap max-h-60 custom-scrollbar">
                  {evt.data.observation}
                </pre>
              </div>
            </div>
          </div>
        );

      case 'final_answer':
        return (
          <div className="flex items-start gap-4 p-5 border border-emerald-900/50 bg-emerald-950/20 rounded-xl relative shadow-lg shadow-emerald-900/5">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <div className="p-2 bg-emerald-900/50 text-emerald-400 rounded-lg shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-emerald-400">Final Answer</h3>
              <div className="text-emerald-50 text-sm mt-3 leading-relaxed whitespace-pre-wrap">
                {evt.data.answer}
              </div>
            </div>
          </div>
        );
        
      case 'error':
        return (
          <div className="flex items-start gap-4 p-4 border border-red-900/50 bg-red-950/20 rounded-xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            <div className="p-2 bg-red-900/50 text-red-400 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-400">Error Encountered</h3>
              <p className="text-red-200 text-sm mt-2">{evt.data.message}</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.5)]">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Mini-Harness</h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <Activity className="w-4 h-4 text-emerald-500" />
            Live Dashboard
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Control Panel */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="p-1 rounded-2xl bg-gradient-to-b from-zinc-800/50 to-transparent">
            <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800/50 shadow-xl">
              <div className="flex items-center gap-2 mb-4 text-zinc-400 text-sm font-medium">
                <Settings className="w-4 h-4" />
                Configuration
              </div>
              
              <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">SSE Endpoint URL</label>
              <input 
                type="text" 
                value={endpointUrl}
                onChange={e => setEndpointUrl(e.target.value)}
                placeholder="https://.../api/run"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>

          <div className="p-1 rounded-2xl bg-gradient-to-b from-zinc-800/50 to-transparent">
            <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800/50 shadow-xl">
              <label className="block text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">Target Task</label>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => setPreset("Baca isi dari file package.json")} className="px-3 py-1.5 text-xs font-medium rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors">
                  📦 Read package.json
                </button>
                <button onClick={() => setPreset("Jalankan npm -v lalu beritahu versinya")} className="px-3 py-1.5 text-xs font-medium rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors">
                  🛠️ Check NPM Version
                </button>
                <button onClick={() => setPreset("Cek status port 3000 dengan ss -tulpn")} className="px-3 py-1.5 text-xs font-medium rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors">
                  🌐 Port 3000 Status
                </button>
              </div>

              <textarea 
                value={task}
                onChange={e => setTask(e.target.value)}
                placeholder="Tulis instruksi untuk agent di sini..."
                rows={4}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none mb-4 custom-scrollbar"
              ></textarea>

              <div className="flex gap-3">
                {!isRunning ? (
                  <button 
                    onClick={runTask}
                    disabled={!task.trim() || !endpointUrl.trim()}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                  >
                    <Play className="w-4 h-4" />
                    Run Agent
                  </button>
                ) : (
                  <button 
                    onClick={stopTask}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-900/50 font-medium py-2.5 rounded-lg transition-colors"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Stop Execution
                  </button>
                )}
              </div>
            </div>
          </div>
          
        </div>

        {/* Right Column: Event Feed */}
        <div className="lg:col-span-7 flex flex-col h-[calc(100vh-8rem)]">
          <div className="flex items-center gap-2 mb-4 text-zinc-400 text-sm font-medium px-1">
            <SearchCode className="w-4 h-4" />
            Live Execution Feed
            {isRunning && (
              <span className="ml-auto flex items-center gap-2 text-xs text-blue-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Agent is running...
              </span>
            )}
          </div>
          
          <div className="flex-1 bg-[#09090b] rounded-2xl border border-zinc-800/80 overflow-y-auto p-4 md:p-6 custom-scrollbar relative shadow-inner">
            {events.length === 0 && !isRunning ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                  <Database className="w-8 h-8 text-zinc-700" />
                </div>
                <p className="text-sm">Ready to execute tasks. Awaiting input.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {events.map((evt) => (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, y: 15, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="origin-left"
                    >
                      {renderEvent(evt)}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={feedEndRef} className="h-2" />
              </div>
            )}
          </div>
        </div>
        
      </main>
    </div>
  );
}
