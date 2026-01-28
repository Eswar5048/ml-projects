import React from 'react';
import { AppMode } from '../types';
import { Camera, Image as ImageIcon, Mic, MessageSquare, Hand } from 'lucide-react';

interface SidebarProps {
  currentMode: AppMode;
  onModeSelect: (mode: AppMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, onModeSelect }) => {
  const menuItems = [
    {
      mode: AppMode.CLASSIFICATION,
      label: 'Image Classification',
      icon: <Camera className="w-5 h-5" />,
      description: 'Identify images with AI'
    },
    {
      mode: AppMode.OBJECT_DETECTION,
      label: 'Object Detection',
      icon: <ImageIcon className="w-5 h-5" />,
      description: 'Find objects in scenes'
    },
    {
      mode: AppMode.HAND_GESTURES,
      label: 'Hand Gestures',
      icon: <Hand className="w-5 h-5" />,
      description: 'Recognize hand signs'
    },
    {
      mode: AppMode.SPEECH_TO_TEXT,
      label: 'Speech to Text',
      icon: <Mic className="w-5 h-5" />,
      description: 'Convert voice to text'
    },
    {
      mode: AppMode.TEXT_TO_SPEECH,
      label: 'Text to Speech',
      icon: <MessageSquare className="w-5 h-5" />,
      description: 'Convert text to voice'
    },
  ];

  return (
    <div className="w-full md:w-72 bg-slate-900 text-white flex flex-col h-full border-r border-slate-800">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          AI Assistant
        </h1>
        <p className="text-xs text-slate-400 mt-1">Multi-Modal Vision & Speech</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.mode}
            onClick={() => onModeSelect(item.mode)}
            className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group text-left ${
              currentMode === item.mode
                ? 'bg-blue-600 shadow-lg shadow-blue-900/50'
                : 'hover:bg-slate-800'
            }`}
          >
            <div className={`p-2 rounded-lg mr-3 ${currentMode === item.mode ? 'bg-blue-500/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
              {item.icon}
            </div>
            <div>
              <div className="font-medium text-sm">{item.label}</div>
              <div className={`text-xs mt-0.5 ${currentMode === item.mode ? 'text-blue-200' : 'text-slate-500'}`}>
                {item.description}
              </div>
            </div>
          </button>
        ))}
      </nav>

      <div className="p-6 border-t border-slate-800">
        <div className="text-xs text-slate-500 text-center">
          Powered by Gemini 2.5
        </div>
      </div>
    </div>
  );
};

export default Sidebar;