import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

  return (
    <div className="task-list">
      <h2>Briefings</h2>
      {error && <p>{error}</p>}
      {!error && briefings.length === 0 && <p>No briefings yet.</p>}
      {briefings.map((b) => (
        <div key={b.id} className="task">
          <h4>
            {b.kind.replace('_', ' ')} · {new Date(b.created_at).toLocaleString()}
          </h4>
          <p className="briefing-text">{b.text}</p>
          {b.delivered ? (
            <span className="status done">read</span>
          ) : (
            <button onClick={() => markDelivered(b.id)}>Mark as read</button>
          )}
        </div>
      ))}
    </div>
  );
};

export default Briefings;
