import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Icon from './Icon';

const API_BASE='/api';
const ACTIVE=new Set(['queued','ringing','in-progress']);

export default function Calls({onCallStateChange}:{onCallStateChange:(active:boolean)=>void}) {
  const [configured,setConfigured]=useState(false);
  const [to,setTo]=useState('');
  const [message,setMessage]=useState('Victor, this is Marcus. I am calling with an update.');
  const [pin,setPin]=useState('');
  const [call,setCall]=useState<{call_id:string;status:string}|null>(null);
  const [notice,setNotice]=useState('');

  useEffect(()=>{ axios.get(`${API_BASE}/calls/config`).then(r=>setConfigured(!!r.data.configured)).catch(()=>setConfigured(false)); },[]);
  useEffect(()=>{
    const active=!!call && ACTIVE.has(call.status);
    onCallStateChange(active);
    if(!active) return;
    const id=window.setInterval(()=>axios.get(`${API_BASE}/calls/${call.call_id}`).then(r=>setCall(r.data)).catch(()=>setNotice('Could not refresh call status.')),3000);
    return()=>window.clearInterval(id);
  },[call?.call_id,call?.status,onCallStateChange]);
  useEffect(()=>()=>onCallStateChange(false),[onCallStateChange]);

  const start=async()=>{
    setNotice('');
    try{
      const r=await axios.post(`${API_BASE}/calls`,{message,to:to.trim()||null},{headers:{'X-Approval-Pin':pin}});
      setCall(r.data); setNotice('Call queued securely.');
    }catch(e:any){
      const status=e?.response?.status;
      setNotice(status===403?'Wrong PIN.':status===422?e.response.data.detail:status===503?'Phone calls are not configured yet.':'The call could not be started.');
    }
    setPin('');
  };

  return <div className="calls-screen">
    <div className="page-intro"><div><span className="eyebrow">PRIVATE OUTBOUND VOICE</span><h2>Call when it matters.</h2><p>Marcus can call your saved number or a specific E.164 number after PIN approval.</p></div><span className={`status ${configured?'done':'pending'}`}>{configured?'Calling ready':'Setup required'}</span></div>
    <div className="call-layout">
      <section className="section call-composer">
        <h3><Icon name="phone" size={19}/>Start a call</h3>
        <p className="section-intro">Calls can incur Twilio charges, so every call requires your approval PIN.</p>
        <label className="field-label">Destination <span className="field-hint">Leave blank to call your saved number</span><input value={to} onChange={e=>setTo(e.target.value)} placeholder="+14035550123" autoComplete="tel"/></label>
        <label className="field-label">What Marcus should say<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={1200}/></label>
        <label className="field-label">Approval PIN<input type="password" value={pin} onChange={e=>setPin(e.target.value)} autoComplete="off" placeholder="Required for this call"/></label>
        <button onClick={start} disabled={!configured||!pin||!message.trim()}><Icon name="phone" size={17}/>Call now</button>
        {notice&&<p role="status" className="small-note">{notice}</p>}
      </section>
      <section className="section call-state">
        <span className="eyebrow">LIVE CALL STATE</span>
        <div className={`call-orb ${call&&ACTIVE.has(call.status)?'is-live':''}`}><Icon name="phone" size={30}/></div>
        <h3>{call?call.status.replace('-', ' '):'No active call'}</h3>
        <p>{call?'Marcus will remain visible while the call is active.':'Start a PIN-approved call to see its live status here.'}</p>
        {call?.call_id&&<code>{call.call_id}</code>}
      </section>
    </div>
  </div>;
}
