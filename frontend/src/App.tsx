import React, { useCallback, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Icon, { IconName } from './components/Icon';
import { BrandMark, BrandPartners } from './components/Brand';
import VoiceButton from './components/VoiceButton';
import ChatView from './components/ChatView';
import TaskList from './components/TaskList';
import MemoryReview from './components/MemoryReview';
import Settings from './components/Settings';
import Briefings from './components/Briefings';
import Calls from './components/Calls';
import EchelonDashboards from './components/EchelonDashboards';
import AvatarPulse, { PresenceMode } from './components/AvatarPulse';
import axios from 'axios';

const API_BASE = '/api';
// An empty WAV. Playing it inside the press unlocks this element for the reply, which arrives after several network calls.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

function App() {
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const setCallPresence = useCallback((active:boolean)=>setCallActive(active),[]);
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

type NavItem = {path:string; label:string; icon:IconName; subtitle:string};
const NAV:NavItem[] = [
  {path:'/', label:'Conversation', icon:'chat', subtitle:'Your direct line to Marcus'},
  {path:'/calls', label:'Calls', icon:'phone', subtitle:'PIN-approved outbound calls'},
  {path:'/echelon', label:'ECHELON', icon:'dashboard', subtitle:'Live owner-scoped dashboards'},
  {path:'/tasks', label:'Tasks', icon:'tasks', subtitle:'Track work and approvals'},
  {path:'/briefings', label:'Briefings', icon:'briefings', subtitle:'The latest updates in one place'},
  {path:'/memory', label:'Memory', icon:'memory', subtitle:'Review what Marcus retains'},
  {path:'/settings', label:'Settings', icon:'settings', subtitle:'Preferences, alerts and controls'}
];

function Navigation({compact=false}:{compact?:boolean}) {
  return <nav className={compact ? 'mobile-links' : 'sidebar-links'} aria-label={compact ? 'Mobile navigation' : 'Main navigation'}>
    {NAV.map(item=><NavLink end={item.path==='/'} to={item.path} key={item.path} className={({isActive})=>'nav-item'+(isActive?' is-active':'')}>
      <Icon name={item.icon} size={compact?20:19}/>
      <span>{item.label}</span>
      {!compact && <Icon name="chevron" size={15} className="nav-chevron"/>}
    </NavLink>)}
  </nav>;
}

function WorkspaceHeader(){
  const location=useLocation();
  const page=NAV.find(p=>p.path===location.pathname) || NAV[0];
  return <header className="workspace-header">
    <div className="mobile-brand"><BrandMark size={36}/><span>Marcus <strong>Vale</strong></span></div>
    <div className="page-identity">
      <div className="eyebrow">YOUR PRIVATE WORKSPACE <span aria-hidden="true">/</span> {page.label.toUpperCase()}</div>
      <h1>{page.label}</h1>
      <p>{page.subtitle}</p>
    </div>
    <div className="header-tools">
      <span className="header-date"><Icon name="calendar" size={16}/>{new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span>
      <span className="private-label"><Icon name="lock" size={14}/>Private assistant</span>
    </div>
  </header>;
}

  return (
    <Router future={{v7_startTransition:true,v7_relativeSplatPath:true}}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Marcus Vale navigation">
          <div className="sidebar-brand">
            <BrandMark size={48}/>
            <div className="wordmark"><strong>Marcus Vale</strong><span>BY WHINK APPS</span></div>
          </div>
          <div className="sidebar-section-title">WORKSPACE</div>
          <Navigation/>
          <div className="sidebar-bottom">
            <div className="assistant-mini">
              <BrandMark size={44}/>
              <div><strong>Your executive assistant</strong><span>Here whenever you need him.</span></div>
            </div>
            <div className="sidebar-divider"/>
            <span className="sidebar-section-title">PART OF THE WHINK FAMILY</span>
            <BrandPartners/>
          </div>
        </aside>

        <div className="workspace">
          <WorkspaceHeader/>
          <main className="workspace-content" id="main-content">
            <Routes>
              <Route path="/" element={
                <section className="conversation-screen" aria-label="Conversation with Marcus">
                  <div className="welcome-hero">
                    <div className="hero-orbit hero-orbit-a" aria-hidden="true"/>
                    <div className="hero-orbit hero-orbit-b" aria-hidden="true"/>
                    <div className="welcome-copy">
                      <span className="eyebrow hero-eyebrow"><span className="status-point"/> YOUR PRIVATE EXECUTIVE ASSISTANT</span>
                      <h2>Good to have you here, <em>Victor.</em></h2>
                      <p>One clear conversation. A calmer, more organized day. Tell Marcus what's on your mind and he'll help you move forward.</p>
                      <div className="hero-tags"><span><Icon name="mic" size={14}/>Voice-first</span><span><Icon name="shield" size={14}/>Approval-led actions</span></div>
                    </div>
                    <div className="hero-mark" aria-hidden="true"><BrandMark size={210}/><div><span>PRIVATE</span><strong>MARCUS VALE</strong><small>VOICE · CALLS · ECHELON</small></div></div>
                  </div>
                  <div className="conversation-card">
                    <div className="card-heading">
                      <span><Icon name="chat" size={18}/> Conversation</span>
                      <span className="caption-soft">Your messages appear here</span>
                    </div>
                    <ChatView messages={messages}/>
                    <div className="voice-dock">
                      <div className="voice-dock-copy"><span className="dock-label">READY WHEN YOU ARE</span><strong>Press and hold to talk with Marcus</strong><small>Release to send. You can interrupt a spoken reply.</small></div>
                      <VoiceButton
                        isListening={isListening}
                        isSpeaking={isSpeaking}
                        onStart={()=>setIsListening(true)}
                        onStop={()=>setIsListening(false)}
                        onPress={()=>{unlockAudio();stopAll();}}
                        onVoiceInput={handleVoiceInput}
                      />
                    </div>
                  </div>
                </section>
              }/>
              <Route path="/tasks" element={<TaskList/>}/>
              <Route path="/calls" element={<Calls onCallStateChange={setCallPresence}/>}/>
              <Route path="/echelon" element={<EchelonDashboards/>}/>
              <Route path="/briefings" element={<Briefings/>}/>
              <Route path="/memory" element={<MemoryReview/>}/>
              <Route path="/settings" element={<Settings/>}/>
            </Routes>
          </main>
          <footer className="workspace-footer"><span>Marcus Vale <span aria-hidden="true">·</span> A WHINK Apps experience</span><span>Thoughtfully built for the way you work.</span></footer>
        </div>
        <div className="mobile-navigation"><Navigation compact/></div>
      </div>
      <AvatarPulse mode={(isListening?'listening':callActive?'calling':isSpeaking?'speaking':null) as PresenceMode|null}/>
    </Router>
  );
}

export default App;
