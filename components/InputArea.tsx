
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  PaperClipIcon, 
  MicrophoneIcon, 
  ArrowUpIcon, 
  PhotoIcon, 
  DocumentIcon,
  XMarkIcon,
  StopIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

interface InputAreaProps {
  onGenerate: (prompt: string, file?: File) => void;
  onGenerateImage: (prompt: string) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({ 
  onGenerate, 
  onGenerateImage,
  isGenerating, 
  disabled = false 
}) => {
  const [text, setText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');

  // Auto-resize and scroll textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [text, interimText]);

  // Sync state with manual edits when not recording
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    finalTranscriptRef.current = e.target.value;
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = finalTranscriptRef.current;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += (final.endsWith(' ') || final === '' ? '' : ' ') + transcript;
            finalTranscriptRef.current = final;
            setText(final);
            setInterimText('');
          } else {
            interim += transcript;
            setInterimText(interim);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      finalTranscriptRef.current = text;
      setIsRecording(true);
      recognitionRef.current?.start();
    }
  }, [isRecording, text]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setIsMenuOpen(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const combinedText = (text + (interimText ? ' ' + interimText : '')).trim();
    if ((combinedText || file) && !isGenerating && !disabled) {
      onGenerate(combinedText, file || undefined);
      setText('');
      setInterimText('');
      finalTranscriptRef.current = '';
      setFile(null);
    }
  };

  const handleAIImageClick = () => {
    const combinedText = (text + (interimText ? ' ' + interimText : '')).trim();
    if (combinedText && !isGenerating) {
      onGenerateImage(combinedText);
      setText('');
      setInterimText('');
      finalTranscriptRef.current = '';
      setIsMenuOpen(false);
    } else {
      alert("Please enter a description in the text field first to generate an AI image.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 relative">
      {/* Listening Status Indicator */}
      {isRecording && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full animate-in fade-in slide-in-from-bottom-2">
          <div className="voice-wave">
            <div></div><div></div><div></div><div></div><div></div>
          </div>
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Listening...</span>
        </div>
      )}

      <form 
        onSubmit={handleSubmit}
        className={`relative flex flex-col bg-zinc-900/80 border rounded-3xl shadow-2xl backdrop-blur-xl transition-all duration-300 ${isRecording ? 'border-red-500/40 ring-1 ring-red-500/20' : 'border-zinc-800 focus-within:border-zinc-700'}`}
      >
        {file && (
          <div className="px-4 pt-3 flex">
            <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-2 animate-in fade-in slide-in-from-bottom-2">
              {file.type.startsWith('image/') ? (
                <div className="w-8 h-8 rounded overflow-hidden bg-zinc-900 border border-zinc-700">
                  <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Preview" />
                </div>
              ) : (
                <DocumentIcon className="w-5 h-5 text-blue-400" />
              )}
              <span className="text-xs text-zinc-300 max-w-[150px] truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="hover:bg-zinc-700 rounded-full p-0.5 transition-colors">
                <XMarkIcon className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end p-2 md:p-3 gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2 rounded-full transition-all ${isMenuOpen ? 'text-zinc-100 bg-zinc-800' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
            >
              <PaperClipIcon className={`w-5 h-5 transition-transform duration-300 ${isMenuOpen ? 'rotate-45' : ''}`} />
            </button>

            {isMenuOpen && (
              <div className="absolute bottom-full left-0 mb-3 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 z-50 min-w-[180px]">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <PhotoIcon className="w-5 h-5 text-blue-400" />
                  <span>Attach Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <DocumentIcon className="w-5 h-5 text-green-400" />
                  <span>Attach File</span>
                </button>
                <div className="h-px bg-zinc-800 my-1 mx-2" />
                <button
                  type="button"
                  onClick={handleAIImageClick}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <SparklesIcon className="w-5 h-5 text-purple-400" />
                  <span>Generate AI Image</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "" : "Ask Eburon to bring an idea to life..."}
              className="w-full bg-transparent border-none focus:ring-0 text-zinc-200 placeholder-zinc-500 resize-none py-2 max-h-60 scrollbar-hide text-sm md:text-base transition-opacity"
              disabled={isGenerating || disabled}
            />
            {isRecording && interimText && (
              <div className="absolute top-2 left-0 text-zinc-500 pointer-events-none italic">
                {text && ' '}{interimText}
              </div>
            )}
            {isRecording && !text && !interimText && (
               <div className="absolute top-2 left-0 text-zinc-600 animate-pulse pointer-events-none">
                 Speak now...
               </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleRecording}
              className={`p-2 rounded-full transition-all relative ${isRecording ? 'bg-red-500/20 text-red-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
            >
              {isRecording && <div className="absolute inset-0 rounded-full border border-red-500/50 animate-pulse-ring" />}
              {isRecording ? <StopIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5" />}
            </button>
            
            <button
              type="submit"
              disabled={(!text.trim() && !interimText.trim() && !file) || isGenerating || disabled}
              className={`p-2 rounded-full transition-all ${(text.trim() || interimText.trim() || file) && !isGenerating ? 'bg-zinc-100 text-black hover:bg-white' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}
            >
              {isGenerating ? (
                <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowUpIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileChange} />
      </form>
      <p className="mt-3 text-[10px] text-center text-zinc-600 font-mono tracking-widest uppercase">
        Eburon AI Engine - Real-Time Multimodal Execution
      </p>
    </div>
  );
};
