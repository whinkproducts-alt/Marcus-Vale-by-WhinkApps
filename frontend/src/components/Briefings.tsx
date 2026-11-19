import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from './Icon';

const API_BASE = '/api';

type Briefing = { id: string; kind: string; text: string; delivered: boolean; created_at: string };

const Briefings: React.FC = () => {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const response = await axios.get(`${API_BASE}/briefings/`);
      setBriefings(response.data.briefings);
      setError('');
    } catch (e) {
      console.error('Error fetching briefings:', e);
      setError('Could not load briefings.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markDelivered = async (id: string) => {
    try {
      await axios.post(`${API_BASE}/briefings/${id}/delivered`);
      load();
    } catch (e) {
      console.error('Error marking briefing delivered:', e);
      setError('Could not mark it as read.');
    }
  };

  const unread=briefings.filter(b=>!b.delivered).length;
  return (
    <div className="task-list">
      <div className="page-intro">
        <div><span className="eyebrow">EXECUTIVE INTELLIGENCE</span><h2>Your briefings, at a glance.</h2><p>Updates worth your attention, organized in one quiet place.</p></div>
        <button className="action-button secondary-button" type="button" onClick={load}><Icon name="refresh" size={16}/>Refresh</button>
      </div>
      <div className="metric-strip" aria-label="Briefing overview">
        <div className="metric"><Icon name="briefings" className="metric-icon"/><span className="metric-label">Total briefings</span><strong>{briefings.length}</strong></div>
        <div className="metric"><Icon name="bell" className="metric-icon"/><span className="metric-label">Unread</span><strong>{unread}</strong></div>
        <div className="metric"><Icon name="check" className="metric-icon"/><span className="metric-label">Read</span><strong>{briefings.length-unread}</strong></div>
      </div>
      {error && <p role="alert">{error}</p>}
      {!error && briefings.length===0 &&
        <div className="section empty-state"><Icon name="briefings" size={35}/><strong>Your briefing desk is clear.</strong>New briefings will appear here when available.</div>}
      <div className="briefing-stack">
        {briefings.map(b=><article key={b.id} className="briefing-entry">
          <div className="briefing-entry-header">
            <div><span className="eyebrow">MARCUS VALE / BRIEFING</span><h3>{b.kind.replace(/_/g,' ')}</h3>
              <time dateTime={b.created_at}>{new Date(b.created_at).toLocaleString()}</time>
            </div>
            <span className={'status '+(b.delivered?'done':'pending')}>{b.delivered?'Read':'Unread'}</span>
          </div>
          <p className="briefing-text">{b.text}</p>
          {!b.delivered && <button className="action-button" onClick={()=>markDelivered(b.id)}><Icon name="check" size={15}/>Mark as read</button>}
        </article>)}
      </div>
    </div>
  );
};

export default Briefings;
