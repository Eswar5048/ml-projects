import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import VisionPanel from './components/VisionPanel';
import SpeechPanel from './components/SpeechPanel';
import { AppMode } from './types';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.CLASSIFICATION);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Mobile menu toggle
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-white text-slate-800 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile by default */}
      <div className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar currentMode={currentMode} onModeSelect={(mode) => {
          setCurrentMode(mode);
          setIsSidebarOpen(false);
        }} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
        {/* Mobile Header */}
        <header className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between">
           <div className="font-bold">AI Assistant</div>
           <button onClick={toggleSidebar} className="p-2">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
             </svg>
           </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50">
          {(currentMode === AppMode.CLASSIFICATION || currentMode === AppMode.OBJECT_DETECTION || currentMode === AppMode.HAND_GESTURES) && (
            <VisionPanel mode={currentMode} />
          )}
          {(currentMode === AppMode.SPEECH_TO_TEXT || currentMode === AppMode.TEXT_TO_SPEECH) && (
            <SpeechPanel mode={currentMode} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;