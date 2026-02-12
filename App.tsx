
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Hero } from './components/Hero';
import { InputArea } from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { CreationHistory, Creation } from './components/CreationHistory';
import { bringToLife, generateFluxImage, identifyImage, IdentificationResult } from './services/gemini';
import { SparklesIcon, KeyIcon, ArrowRightIcon } from '@heroicons/react/24/solid';

const App: React.FC = () => {
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<Creation[]>([]);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [identifications, setIdentifications] = useState<IdentificationResult[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Check for API key on load
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelection = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  useEffect(() => {
    const initHistory = async () => {
      const saved = localStorage.getItem('gemini_app_history');
      let loadedHistory: Creation[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          loadedHistory = parsed.map((item: any) => ({
              ...item,
              timestamp: new Date(item.timestamp)
          }));
        } catch (e) { console.error("Failed to load history", e); }
      }
      if (loadedHistory.length > 0) {
        setHistory(loadedHistory);
      } else {
        try {
           const exampleUrls = [
               'https://storage.googleapis.com/sideprojects-asronline/bringanythingtolife/vibecode-blog.json',
               'https://storage.googleapis.com/sideprojects-asronline/bringanythingtolife/cassette.json',
               'https://storage.googleapis.com/sideprojects-asronline/bringanythingtolife/chess.json'
           ];
           const examples = await Promise.all(exampleUrls.map(async (url) => {
               const res = await fetch(url);
               if (!res.ok) return null;
               const data = await res.json();
               return { ...data, timestamp: new Date(data.timestamp || Date.now()), id: data.id || crypto.randomUUID() };
           }));
           const validExamples = examples.filter((e): e is Creation => e !== null);
           setHistory(validExamples);
        } catch (e) { console.error("Failed to load examples", e); }
      }
    };
    initHistory();
  }, []);

  useEffect(() => {
    if (history.length > 0) {
        try { localStorage.setItem('gemini_app_history', JSON.stringify(history)); } catch (e) { console.warn("Local storage full", e); }
    }
  }, [history]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleError = (error: any) => {
    if (error.message === "KEY_RESET_REQUIRED") {
        setHasApiKey(false);
        setIsGenerating(false);
    } else {
        console.error("Failed to generate:", error);
        alert("An unexpected error occurred. Please try again or check your connection.");
        setIsGenerating(false);
    }
  };

  const handleGenerate = async (promptText: string, file?: File) => {
    setIsGenerating(true);
    setActiveCreation(null);
    setIdentifications([]);
    try {
      let imageBase64: string | undefined;
      let mimeType: string | undefined;
      let detections: IdentificationResult[] = [];

      if (file) {
        imageBase64 = await fileToBase64(file);
        mimeType = file.type.toLowerCase();
        // Step 1: Identification (Eburon-YOLO26 Scan)
        detections = await identifyImage(imageBase64, mimeType);
        setIdentifications(detections);
      }

      // Step 2: Generation with Context
      const detectionContext = detections.length > 0 
        ? detections.map(d => `- ${d.label} (${d.type}): ${d.description}`).join('\n')
        : undefined;

      const html = await bringToLife(promptText, imageBase64, mimeType, detectionContext);
      if (html) {
        const newCreation: Creation = {
          id: crypto.randomUUID(),
          name: file ? file.name : promptText ? promptText.slice(0, 30) : 'New Creation',
          html: html,
          originalImage: imageBase64 && mimeType ? `data:${mimeType};base64,${imageBase64}` : undefined,
          timestamp: new Date(),
          identifications: detections.length > 0 ? detections : undefined
        };
        setActiveCreation(newCreation);
        setHistory(prev => [newCreation, ...prev]);
        setIsGenerating(false);
      }
    } catch (error) {
      handleError(error);
    }
  };

  const handleGenerateImage = async (prompt: string) => {
    setIsGenerating(true);
    setActiveCreation(null);
    try {
      const imageDataUrl = await generateFluxImage(prompt);
      const html = `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-zinc-950 flex flex-col items-center justify-center min-h-screen p-8 text-white font-sans"><div class="max-w-2xl w-full bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 animate-in fade-in zoom-in-95 duration-1000"><img src="${imageDataUrl}" class="w-full aspect-square object-cover" /><div class="p-8 text-center"><h1 class="text-2xl font-bold mb-4">Eburon-FLUX Engine</h1><p class="text-zinc-400 mb-6 font-light italic">"${prompt}"</p><button onclick="window.print()" class="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-lg">Download Artifact</button></div></div></body></html>`;
      
      const newCreation: Creation = {
        id: crypto.randomUUID(),
        name: `FLUX: ${prompt.slice(0, 20)}...`,
        html: html,
        originalImage: imageDataUrl,
        timestamp: new Date(),
      };
      setActiveCreation(newCreation);
      setHistory(prev => [newCreation, ...prev]);
      setIsGenerating(false);
    } catch (error) {
      handleError(error);
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
           <div className="w-20 h-20 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto shadow-2xl rotate-3">
              <KeyIcon className="w-10 h-10 text-black" />
           </div>
           <div className="space-y-3">
             <h1 className="text-4xl font-bold tracking-tighter text-white">Upgrade Required</h1>
             <p className="text-zinc-400 font-light leading-relaxed">
               Eburon AI utilizes advanced models that are not available on the Free Tier. To continue, please select an API key from a project with <span className="text-white font-medium">billing enabled</span>.
             </p>
           </div>
           <div className="pt-4 space-y-4">
             <button 
                onClick={handleOpenKeySelection}
                className="w-full bg-white text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-xl"
             >
               <span>Switch to Paid API Key</span>
               <ArrowRightIcon className="w-5 h-5" />
             </button>
             <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
               View <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline hover:text-zinc-400">billing documentation</a>
             </p>
           </div>
        </div>
      </div>
    );
  }

  const isFocused = !!activeCreation || isGenerating;

  return (
    <div className="h-[100dvh] bg-[#09090b] bg-dot-grid text-zinc-50 selection:bg-blue-500/30 overflow-hidden relative flex flex-col">
      <header className={`fixed top-0 w-full z-30 transition-all duration-700 px-6 py-4 flex items-center justify-between border-b border-zinc-900/50 bg-[#09090b]/80 backdrop-blur-md ${isFocused ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'}`}>
        <div className="flex items-center gap-2 group cursor-default">
           <div className="bg-zinc-100 p-1.5 rounded-lg text-black group-hover:scale-110 transition-transform"><SparklesIcon className="w-5 h-5" /></div>
           <span className="font-bold tracking-tighter text-lg">Eburon AI</span>
        </div>
        <button onClick={() => importInputRef.current?.click()} className="text-xs font-mono text-zinc-500 hover:text-zinc-200 transition-colors uppercase tracking-widest border border-zinc-800 px-3 py-1.5 rounded-full">Import JSON</button>
      </header>
      <main className={`flex-1 relative transition-all duration-700 ${isFocused ? 'opacity-0 scale-95 blur-sm pointer-events-none' : 'opacity-100 scale-100 blur-0'}`}>
        <div className="h-full flex flex-col overflow-y-auto pt-24 pb-40">
           <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4">
              <Hero />
              <div className="mt-20"><CreationHistory history={history} onSelect={setActiveCreation} /></div>
           </div>
        </div>
      </main>
      <div className={`fixed bottom-0 w-full z-30 transition-all duration-700 pb-8 pt-20 bg-gradient-to-t from-[#09090b] via-[#09090b]/90 to-transparent ${isFocused ? 'opacity-0 translate-y-20' : 'opacity-100 translate-y-0'}`}>
         <InputArea onGenerate={handleGenerate} onGenerateImage={handleGenerateImage} isGenerating={isGenerating} />
      </div>
      <input type="file" ref={importInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target?.result as string);
            const imported = { ...parsed, timestamp: new Date(parsed.timestamp || Date.now()), id: parsed.id || crypto.randomUUID() };
            setHistory(prev => prev.some(c => c.id === imported.id) ? prev : [imported, ...prev]);
            setActiveCreation(imported);
          } catch (err) { console.error("Import error", err); }
        };
        reader.readAsText(file);
      }} accept=".json" className="hidden" />
      <LivePreview creation={activeCreation} isLoading={isGenerating} isFocused={isFocused} onReset={() => { setActiveCreation(null); setIsGenerating(false); }} />
      {!isFocused && <div className="fixed bottom-3 right-6 z-40"><a href="https://x.com/ammaar" target="_blank" rel="noopener" className="text-[10px] font-mono text-zinc-700 hover:text-zinc-500 transition-colors">@ammaar</a></div>}
    </div>
  );
};
export default App;
