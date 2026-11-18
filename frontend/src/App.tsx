import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import VoiceButton from './components/VoiceButton';
import ChatView from './components/ChatView';
import TaskList from './components/TaskList';
import MemoryReview from './components/MemoryReview';
import Settings from './components/Settings';
import Briefings from './components/Briefings';
import axios from 'axios';

const API_BASE = '/api';
// An empty WAV. Playing it inside the press unlocks this element for the reply, which arrives after several network calls.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

function App() {
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // iOS Safari only lets audio start from a user gesture, so the one element is made and unlocked in the press.
  const unlockAudio = () => {
    if (audioRef.current) return;
    const el = new Audio(SILENT_WAV);
    el.play().catch(() => {});
    audioRef.current = el;
  };

  const handleVoiceInput = async (audio: Blob) => {
    setIsListening(false);
    
    // Convert audio to base64
    const audioBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(audio);
    });

    // Send to backend for transcription
    try {
      const response = await axios.post(`${API_BASE}/voice/transcribe`, {
        audio: audioBase64.split(',')[1], // Remove data:audio/wav;base64,
        language: 'en',
      });

      const text = response.data.text;
      setMessages((m) => [...m, { text, isUser: true }]);

      // Send to LLM
      const llmResponse = await axios.post(`${API_BASE}/voice/chat`, { prompt: text });
      const reply = llmResponse.data.response;
      setMessages((m) => [...m, { text: reply, isUser: false }]);

      // Synthesize speech
      const audioResponse = await axios.post(`${API_BASE}/voice/synthesize`, { text: reply });
      const audioData = audioResponse.data.audio;
      const audioBlob = new Blob([new Uint8Array(atob(audioData).split('').map(c => c.charCodeAt(0)))], { type: audioResponse.data.content_type || 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioElement = audioRef.current ?? new Audio();
      audioRef.current = audioElement;
      audioElement.src = audioUrl;
      audioElement.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      setIsSpeaking(true);
      await audioElement.play().catch(() => setIsSpeaking(false));
    } catch (error) {
      console.error('Error:', error);
      setMessages((m) => [...m, { text: "Sorry, I encountered an error.", isUser: false }]);
    }
  };

  return (
    <Router>
      <div className="app">
        <header className="header">
          <h1>Marcus Vale</h1>
          <p>Executive Assistant to Victor Igboekwe</p>
          <nav>
            <Link to="/">Chat</Link>
            <Link to="/tasks">Tasks</Link>
            <Link to="/briefings">Briefings</Link>
            <Link to="/memory">Memory</Link>
            <Link to="/settings">Settings</Link>
          </nav>
        </header>
        
        <main className="main">
          <Routes>
            <Route path="/" element={
              <>
                <ChatView messages={messages} />
                <VoiceButton 
                  isListening={isListening} 
                  isSpeaking={isSpeaking}
                  onStart={() => setIsListening(true)}
                  onStop={() => setIsListening(false)}
                  onPress={unlockAudio}
                  onVoiceInput={handleVoiceInput}
                />
              </>
            } />
            <Route path="/tasks" element={<TaskList />} />
            <Route path="/briefings" element={<Briefings />} />
            <Route path="/memory" element={<MemoryReview />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
