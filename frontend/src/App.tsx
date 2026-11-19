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

  // Barge-in: one call ends the stream, pending synthesis and playback. A new turn gets a new generation number,
  // so anything still in flight from the old turn sees the mismatch and drops out.
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const endPlayRef = useRef<(() => void) | null>(null);

  const stopAll = () => {
    genRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    const el = audioRef.current;
    if (el) {
      el.onended = null;
      el.pause();
    }
    endPlayRef.current?.();
    endPlayRef.current = null;
    setIsSpeaking(false);
  };

  const synth = async (text: string, signal: AbortSignal): Promise<Blob> => {
    const res = await axios.post(`${API_BASE}/voice/synthesize`, { text }, { signal });
    const bytes = Uint8Array.from(atob(res.data.audio), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: res.data.content_type || 'audio/mpeg' });
  };

  const playBlob = (blob: Blob, gen: number) =>
    new Promise<void>((resolve) => {
      const el = audioRef.current ?? new Audio();
      audioRef.current = el;
      const url = URL.createObjectURL(blob);
      const done = () => {
        URL.revokeObjectURL(url);
        endPlayRef.current = null;
        resolve();
      };
      if (gen !== genRef.current) return done();
      endPlayRef.current = done;
      el.onended = done;
      el.onerror = done;
      el.src = url;
      setIsSpeaking(true);
      el.play().catch(done);
    });

  const speakReply = async (text: string) => {
    const gen = genRef.current;
    const ctl = new AbortController();
    abortRef.current = ctl;
    let player: Promise<void> = Promise.resolve();
    try {
      const res = await fetch(`${API_BASE}/voice/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) {
        let detail = 'Sorry, I encountered an error.';
        if (res.status === 402) detail = 'Monthly spend cap reached. Chat is paused until next month.';
        setMessages((m) => [...m, { text: detail, isUser: false }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let idx = -1;
      const onSentence = (sentence: string) => {
        if (gen !== genRef.current) return;
        // One chat bubble per reply, grown sentence by sentence.
        setMessages((m) => {
          if (idx >= 0 && m[idx] && !m[idx].isUser) {
            const copy = [...m];
            copy[idx] = { text: `${copy[idx].text} ${sentence}`, isUser: false };
            return copy;
          }
          idx = m.length;
          return [...m, { text: sentence, isUser: false }];
        });
        // Synthesis of this sentence starts now, while earlier ones are still playing.
        const blobP = synth(sentence, ctl.signal).catch(() => null);
        player = player.then(async () => {
          const blob = await blobP;
          if (blob && gen === genRef.current) await playBlob(blob, gen);
        });
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          const ev = /^event: (.+)$/m.exec(block)?.[1];
          const data = /^data: (.+)$/m.exec(block)?.[1];
          if (ev === 'sentence' && data) onSentence(JSON.parse(data).text);
          else if (ev === 'error') setMessages((m) => [...m, { text: 'Sorry, I could not finish that reply.', isUser: false }]);
        }
      }
      await player;
    } catch (error) {
      if (gen === genRef.current) {
        console.error('Error:', error);
        setMessages((m) => [...m, { text: 'Sorry, I encountered an error.', isUser: false }]);
      }
    } finally {
      if (gen === genRef.current) {
        abortRef.current = null;
        setIsSpeaking(false);
      }
    }
  };

  const handleVoiceInput = async (audio: Blob) => {
    setIsListening(false);
    const gen = genRef.current;

    // Convert audio to base64
    const audioBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(audio);
    });

    try {
      const ctl = new AbortController();
      abortRef.current = ctl;
      const response = await axios.post(
        `${API_BASE}/voice/transcribe`,
        { audio: audioBase64.split(',')[1], language: 'en' },
        { signal: ctl.signal },
      );
      if (gen !== genRef.current) return; // pressed again while transcribing
      const text = response.data.text;
      setMessages((m) => [...m, { text, isUser: true }]);
      await speakReply(text);
    } catch (error) {
      if (gen !== genRef.current) return;
      console.error('Error:', error);
      setMessages((m) => [...m, { text: 'Sorry, I encountered an error.', isUser: false }]);
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
                  onPress={() => {
                    unlockAudio();
                    stopAll();
                  }}
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
