import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Icon from './Icon';

const API_BASE = '/api';

const MemoryReview: React.FC = () => {
  const [memories, setMemories] = useState<Array<{
    id: string;
    content: string;
    layer: string;
    source: string;
    timestamp: string;
  }>>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    try {
      const response = await axios.get(`${API_BASE}/memory/`);
      setMemories(response.data.memories);
    } catch (error) {
      console.error('Error fetching memories:', error);
    }
  };

  const searchMemories = async () => {
    try {
      const response = await axios.get(`${API_BASE}/memory/search`, { params: { query: searchQuery } });
      setMemories(response.data.memories);
    } catch (error) {
      console.error('Error searching memories:', error);
    }
  };

  const layers=[
    {key:'layer1',title:'Original transcripts',description:'Layer 1 · Immutable history'},
    {key:'layer2',title:'Core facts',description:'Layer 2 · Important context'},
    {key:'layer3',title:'Searchable memory',description:'Layer 3 · Indexed information'}
  ];
  return (
    <div className="memory-review">
      <div className="page-intro"><div><span className="eyebrow">KNOWLEDGE & CONTEXT</span><h2>Everything in context.</h2><p>Review the information Marcus has stored, organized by memory layer.</p></div></div>
      <div className="metric-strip" aria-label="Memory overview">
        <div className="metric"><Icon name="memory" className="metric-icon"/><span className="metric-label">Visible memories</span><strong>{memories.length}</strong></div>
        <div className="metric"><Icon name="briefings" className="metric-icon"/><span className="metric-label">Transcripts</span><strong>{memories.filter(m=>m.layer==='layer1').length}</strong></div>
        <div className="metric"><Icon name="search" className="metric-icon"/><span className="metric-label">Indexed entries</span><strong>{memories.filter(m=>m.layer==='layer3').length}</strong></div>
      </div>
      <form className="memory-search" onSubmit={e=>{e.preventDefault();searchQuery.trim()?searchMemories():fetchMemories();}}>
        <label className="visually-hidden" htmlFor="memory-query">Search saved memories</label>
        <input id="memory-query" type="search" placeholder="Search your saved context…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
        <button type="submit"><Icon name="search" size={16}/>Search</button>
      </form>
      <div className="layers">
        {layers.map(layer=>{
          const list=memories.filter(m=>m.layer===layer.key);
          return <section className="layer" key={layer.key} aria-label={layer.title}>
            <span className="eyebrow">{layer.description}</span>
            <h3>{layer.title}<span>{list.length}</span></h3>
            {list.length?list.map(memory=><article className="memory" key={memory.id}>
              <p>{memory.content}</p>
              <small><time dateTime={memory.timestamp}>{new Date(memory.timestamp).toLocaleString()}</time> · {memory.source}</small>
            </article>):<div className="empty-state"><Icon name="memory" size={24}/><strong>Nothing here yet.</strong>No entries found in this layer.</div>}
          </section>
        })}
      </div>
    </div>
  );
};

export default MemoryReview;
