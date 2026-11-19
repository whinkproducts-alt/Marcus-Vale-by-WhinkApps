import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
  }, []);

  const fetchSpendStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/spend/status`);
      setSpendStatus(response.data);
    } catch (error) {
      console.error('Error fetching spend status:', error);
    }
  };

  return (
    <div className="settings">
      <h2>⚙️ Settings</h2>
      
      <div className="section">
        <h3>💰 Spend Cap</h3>
        {spendStatus && (
          <div className="spend-status">
            <p>Total Spend: ${spendStatus.total_spend.toFixed(2)}</p>
            <p>Cap: ${spendStatus.cap.toFixed(2)}</p>
            <p>Warning Threshold: ${spendStatus.warning_threshold.toFixed(2)}</p>
            <p className={spendStatus.is_warning ? 'warning' : spendStatus.is_blocked ? 'error' : ''}>
              Status: {spendStatus.is_blocked ? 'BLOCKED' : spendStatus.is_warning ? 'WARNING' : 'OK'}
            </p>
          </div>
        )}
      </div>
      
      <div className="section">
        <h3>🔔 Alerts</h3>
        <p>Only a generic ping, never your tasks or briefing text.</p>
        {Object.keys(LABELS).map((k) => (
          <label key={k} style={{ display: 'block' }}>
            <input
              type="checkbox"
              disabled={!chans[k]?.configured}
              checked={!!picked[k]}
              onChange={(e) => setPicked({ ...picked, [k]: e.target.checked })}
            />{' '}
            {LABELS[k]}
            {chans[k] && !chans[k].configured ? ' (not configured)' : ''}
          </label>
        ))}
        <input
          type="password"
          placeholder="Approval PIN"
          value={alertPin}
          onChange={(e) => setAlertPin(e.target.value)}
        />
        <button onClick={saveChans}>Save</button>
        {alertMsg && <p>{alertMsg}</p>}
      </div>

      <div className="section">
        <h3>🔊 Voice Settings</h3>
        <p>STT: Whisper (via OmniRoute)</p>
        <p>TTS: Kokoro (via OmniRoute)</p>
      </div>
      
      <div className="section">
        <h3>🤖 ECHELON Integration</h3>
        <p>Status: Connected</p>
      </div>
    </div>
  );
};

export default Settings;
