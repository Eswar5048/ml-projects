import React, { useState, useRef, useEffect } from 'react';
import { AppMode } from '../types';
import { transcribeAudio, synthesizeSpeech } from '../services/geminiService';
import { Mic, StopCircle, Play, Loader2, Volume2, Copy, Trash2, FileAudio, Pause } from 'lucide-react';

interface SpeechPanelProps {
  mode: AppMode;
}

const AVAILABLE_VOICES = [
  { id: 'Puck', label: 'Puck (Neutral)' },
  { id: 'Charon', label: 'Charon (Deep)' },
  { id: 'Kore', label: 'Kore (Soft)' },
  { id: 'Fenrir', label: 'Fenrir (Intense)' },
  { id: 'Zephyr', label: 'Zephyr (Calm)' },
];

const SpeechPanel: React.FC<SpeechPanelProps> = ({ mode }) => {
  // STT State
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  // TTS State
  const [textInput, setTextInput] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Puck');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Shared State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup audio URLs
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Audio Player Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        audioChunks.current = [];
        await handleTranscription(audioBlob);
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setError(null);
      setTranscription('');
    } catch (err) {
      console.error(err);
      setError("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleTranscription = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const text = await transcribeAudio(blob);
      setTranscription(text);
    } catch (err) {
      setError("Failed to transcribe audio. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTTS = async () => {
    if (!textInput.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      const base64Audio = await synthesizeSpeech(textInput, selectedVoice);
      
      // Convert base64 to blob
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      
      setAudioUrl(url);
    } catch (err) {
      setError("Failed to convert text to speech.");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full p-4 md:p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          {mode === AppMode.SPEECH_TO_TEXT ? 'Speech to Text' : 'Text to Speech'}
        </h2>
        <p className="text-slate-600">
          {mode === AppMode.SPEECH_TO_TEXT 
            ? 'Convert your voice into text using advanced AI transcription.' 
            : 'Convert written text into natural-sounding speech with selectable personalities.'}
        </p>
      </div>

      {mode === AppMode.SPEECH_TO_TEXT ? (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden">
            
            {/* Ambient Background Animation */}
            {isRecording && (
              <>
                 <div className="absolute w-64 h-64 bg-red-100 rounded-full animate-ping opacity-20"></div>
                 <div className="absolute w-48 h-48 bg-red-200 rounded-full animate-pulse opacity-20 delay-75"></div>
              </>
            )}

            <div className={`relative z-10 transition-all duration-300 ${isRecording ? 'scale-110' : 'scale-100'}`}>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                  isRecording 
                    ? 'bg-gradient-to-br from-red-500 to-pink-600 hover:shadow-red-500/30' 
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600 hover:shadow-blue-500/30 hover:-translate-y-1'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRecording ? <StopCircle className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
              </button>
            </div>
            
            <div className="mt-8 text-center z-10">
               <h3 className="text-xl font-bold text-slate-800 mb-1">
                 {isRecording ? 'Listening...' : 'Ready to Record'}
               </h3>
               <p className="text-slate-500">
                 {isRecording ? 'Speak clearly into your microphone' : 'Tap the microphone to start'}
               </p>
            </div>

            {isRecording && (
               <div className="mt-6 flex gap-1 h-8 items-end justify-center z-10">
                 {[...Array(5)].map((_, i) => (
                   <div key={i} className="w-1.5 bg-red-500 rounded-full animate-music" style={{ animationDelay: `${i * 0.1}s` }}></div>
                 ))}
               </div>
            )}
          </div>

          {(isLoading || transcription || error) && (
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[150px] relative animate-in slide-in-from-bottom-4">
               {isLoading ? (
                 <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 py-8">
                   <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                   <span className="font-medium">Processing Audio...</span>
                 </div>
               ) : error ? (
                 <div className="text-red-500 text-center py-8">{error}</div>
               ) : (
                 <div className="prose prose-slate max-w-none">
                   <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transcription Result</span>
                      <button 
                        onClick={() => navigator.clipboard.writeText(transcription)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                   </div>
                   <p className="text-slate-800 text-lg leading-relaxed whitespace-pre-wrap">{transcription}</p>
                 </div>
               )}
             </div>
          )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-1">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter the text you want the AI to speak..."
                className="w-full h-64 p-6 rounded-xl outline-none resize-none text-lg text-slate-800 placeholder:text-slate-300"
              />
              <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center border-t border-slate-100">
                <span className="text-xs text-slate-400 font-medium">{textInput.length} characters</span>
                <button 
                  onClick={() => setTextInput('')}
                  className="px-3 py-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              </div>
            </div>
            
             {error && (
               <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                 <div className="mt-0.5 min-w-[1.25rem]">⚠️</div>
                 {error}
               </div>
            )}
          </div>

          <div className="space-y-6">
             {/* Configuration Panel */}
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-blue-500" />
                  Voice Settings
                </h3>
                
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-600 block">Select Voice</label>
                  <div className="space-y-2">
                    {AVAILABLE_VOICES.map((voice) => (
                      <button
                        key={voice.id}
                        onClick={() => setSelectedVoice(voice.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                          selectedVoice === voice.id 
                            ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-medium">{voice.label}</span>
                        {selectedVoice === voice.id && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleTTS}
                  disabled={!textInput.trim() || isLoading}
                  className="w-full mt-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                  Generate Audio
                </button>
             </div>

             {/* Audio Player Card */}
             {audioUrl && (
               <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl animate-in slide-in-from-right-4 ring-1 ring-white/10">
                 <div className="flex items-start justify-between mb-6">
                   <div>
                     <div className="text-xs font-bold text-blue-300 uppercase tracking-wide mb-1">Now Playing</div>
                     <div className="font-medium text-lg">AI Speech Output</div>
                   </div>
                   <div className="p-2 bg-white/10 rounded-lg">
                      <FileAudio className="w-6 h-6 text-blue-300" />
                   </div>
                 </div>

                 <div className="flex items-center gap-4 mb-2">
                   <button
                     onClick={togglePlayback}
                     className="w-14 h-14 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
                   >
                     {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-1 fill-current" />}
                   </button>
                   <div className="flex-1 h-12 flex flex-col justify-center">
                      <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                         <div className={`h-full bg-gradient-to-r from-blue-400 to-indigo-400 ${isPlaying ? 'w-full transition-[width] duration-[10s] ease-linear' : 'w-0'}`}></div>
                      </div>
                   </div>
                 </div>
                 
                 <audio
                   ref={audioRef}
                   src={audioUrl}
                   className="hidden"
                 />
               </div>
             )}
          </div>
        </div>
      )}
      
      {/* CSS for custom animation */}
      <style>{`
        @keyframes music {
          0%, 100% { height: 0.5rem; }
          50% { height: 1.5rem; }
        }
        .animate-music {
          animation: music 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default SpeechPanel;