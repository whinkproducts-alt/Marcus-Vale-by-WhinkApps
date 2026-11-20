import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from './Icon';
import { BrandMark } from './Brand';

const API_BASE = '/api';

const Settings: React.FC = () => {
  const [spendStatus, setSpendStatus] = useState<{
    total_spend: number;
    cap: number;
    warning_threshold: number;
    is_warning: boolean;
    is_blocked: boolean;
  } | null>(null);

  type Chan = { configured: boolean; enabled: boolean };
  const LABELS: Record<string, string> = { whatsapp: 'WhatsApp', telegram: 'Telegram', email: 'Email' };
  const [chans, setChans] = useState<Record<string, Chan>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  // The PIN lives in React memory only: never localStorage, never a cookie.
  const [alertPin, setAlertPin] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [voice,setVoice]=useState('am_michael');
  const [voices,setVoices]=useState<Array<{id:string;label:string}>>([]);
  const [voiceMsg,setVoiceMsg]=useState('');

  const loadChans = async () => {
    try {
      const r = await axios.get(`${API_BASE}/settings/alert-channels`);
      setChans(r.data);
      setPicked(Object.fromEntries(Object.entries(r.data as Record<string, Chan>).map(([k, v]) => [k, v.enabled])));
    } catch (error) {
      setAlertMsg('Could not load alert channels.');
    }
  };

  const saveChans = async () => {
    const status = (e: any) => e?.response?.status;
    try {
      const r = await axios.put(
        `${API_BASE}/settings/alert-channels`,
        { channels: Object.keys(picked).filter((k) => picked[k]) },
        { headers: { 'X-Approval-Pin': alertPin } }
      );
      setChans(r.data);
      setAlertMsg('Saved.');
    } catch (e) {
      const code = status(e);
      setAlertMsg(
        code === 403 ? 'Wrong PIN.' : code === 429 ? 'PIN locked. Try again later.' :
        code === 400 ? 'A channel is not configured on the server.' : 'Could not save.'
      );
    }
    setAlertPin('');
  };

  useEffect(() => {
    fetchSpendStatus();
    loadChans();
    axios.get(`${API_BASE}/settings/voice`).then(r=>{setVoice(r.data.voice);setVoices(r.data.choices||[]);}).catch(()=>setVoiceMsg('Voice choices are unavailable.'));
  }, []);

  const saveVoice=async()=>{
    try{const r=await axios.put(`${API_BASE}/settings/voice`,{voice});setVoice(r.data.voice);setVoiceMsg('Voice updated.');}
    catch{setVoiceMsg('Could not update the voice.');}
  };

  const fetchSpendStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/spend/status`);
      setSpendStatus(response.data);
    } catch (error) {
      console.error('Error fetching spend status:', error);
    }
  };

  const percent=spendStatus && spendStatus.cap>0 ? Math.max(0,Math.min(100,spendStatus.total_spend/spendStatus.cap*100)) : 0;
  const money=(value:number)=>'$'+value.toFixed(2);
  return (
    <div className="settings">
      <div className="page-intro"><div><span className="eyebrow">YOUR ASSISTANT, YOUR RULES</span><h2>Make it yours.</h2><p>Manage spending limits, private alerts, voice services and integrations.</p></div></div>
      <div className="settings-grid">
        <section className="section settings-profile">
          <h3><Icon name="spark" size={19}/>Meet your assistant</h3>
          <div className="profile-row"><BrandMark size={88}/><div><span className="eyebrow">MARCUS VALE</span><strong>Your executive assistant</strong><small>Private assistant to Victor Igboekwe</small></div></div>
          <p className="small-note">Built for thoughtful assistance, clear approvals and a consistent daily workflow.</p>
        </section>
        <section className="section">
          <h3><Icon name="wallet" size={19}/>Spending overview</h3>
          <p className="section-intro">Live values reported by the backend. Limits are not changed from this screen.</p>
          {spendStatus?<div className="spend-status">
            <div className="spend-figures"><strong>{money(spendStatus.total_spend)}</strong><span>of {money(spendStatus.cap)} limit</span></div>
            <div className="spend-track" role="progressbar" aria-label="Spend as a percentage of cap" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{width:percent+'%'}}/></div>
            <div className="spend-meta"><span>Warning at {money(spendStatus.warning_threshold)}</span><span>{percent.toFixed(0)}% of cap used</span></div>
            <span className={'status '+(spendStatus.is_blocked?'failed':spendStatus.is_warning?'pending':'done')}>{spendStatus.is_blocked?'Spend blocked':spendStatus.is_warning?'Approaching cap':'Within limit'}</span>
          </div>:<p className="small-note">Spending status unavailable. Connect to the backend to view current values.</p>}
        </section>
        <section className="section">
          <h3><Icon name="bell" size={19}/>Notifications & alerts</h3>
          <p className="section-intro">Only generic alerts are sent. Your tasks and briefing content stay out of notifications.</p>
          {Object.entries(LABELS).map(([key,label])=><div className="setting-row" key={key}>
            <div><span className="setting-name">{label}</span><small>{chans[key]?.configured?'Available for notifications':'Not configured on the server'}</small></div>
            <label className="switch" aria-label={'Enable '+label+' alerts'}>
              <input type="checkbox" disabled={!chans[key]?.configured} checked={!!picked[key]} onChange={e=>setPicked({...picked,[key]:e.target.checked})}/>
              <span className="slider"/>
            </label>
          </div>)}
          <label className="field-label" htmlFor="alert-approval-pin" style={{marginTop:16}}>Approval PIN
            <input id="alert-approval-pin" type="password" autoComplete="off" placeholder="Required to save alert preferences" value={alertPin} onChange={e=>setAlertPin(e.target.value)}/>
          </label>
          <button onClick={saveChans} disabled={!alertPin}><Icon name="check" size={15}/>Save alert preferences</button>
          {alertMsg && <p role="status" className="small-note">{alertMsg}</p>}
        </section>
        <section className="section">
          <h3><Icon name="volume" size={19}/>Voice services</h3>
          <p className="section-intro">Choose the voice Marcus uses in conversation. The selection is stored in the backend.</p>
          <div className="connection-item"><span>Speech to text</span><strong>Whisper · OmniRoute</strong></div>
          <div className="connection-item"><span>Text to speech</span><strong>Kokoro · OmniRoute</strong></div>
          <label className="field-label voice-choice">Marcus voice<select value={voice} onChange={e=>setVoice(e.target.value)}>{voices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <button onClick={saveVoice} disabled={!voices.length}><Icon name="check" size={15}/>Use this voice</button>
          {voiceMsg&&<p role="status" className="small-note">{voiceMsg}</p>}
          <p className="small-note">Press and hold the voice button in Conversation to record a request.</p>
        </section>
        <section className="section settings-wide">
          <h3><Icon name="link" size={19}/>ECHELON integration</h3>
          <p className="section-intro">Task handoffs are managed by ECHELON after explicit approval. This page does not independently verify its connection.</p>
          <div className="connection-item"><span>Execution</span><strong>Approval-gated</strong></div>
          <div className="connection-item"><span>Connection state</span><strong>Check individual task handoffs</strong></div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
