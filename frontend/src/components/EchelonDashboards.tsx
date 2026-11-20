import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Icon from './Icon';

const API_BASE='/api';
type Dashboard={id:string;title:string;description:string;path:string;href?:string;mode?:'live'|'link'};

function valueText(value:unknown):string{
  if(value===null||value===undefined) return '—';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean') return String(value);
  if(Array.isArray(value)) return `${value.length} items`;
  return Object.entries(value as Record<string,unknown>).map(([k,v])=>`${k}: ${valueText(v)}`).join(' · ');
}

export default function EchelonDashboards(){
  const [items,setItems]=useState<Dashboard[]>([]);
  const [selected,setSelected]=useState<Dashboard|null>(null);
  const [data,setData]=useState<Record<string,unknown>|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');
  useEffect(()=>{axios.get(`${API_BASE}/echelon/dashboards`).then(r=>{const dashboards=r.data.dashboards||[];setItems(dashboards);if(dashboards[0])setSelected(dashboards[0]);}).catch(()=>setError('ECHELON dashboards are not connected yet.')).finally(()=>setLoading(false));},[]);
  useEffect(()=>{if(!selected)return;setData(null);setError('');setLoading(true);axios.get(`${API_BASE}/echelon/dashboards/${selected.id}`).then(r=>setData(r.data)).catch(()=>setError('This dashboard is unavailable right now.')).finally(()=>setLoading(false));},[selected?.id]);
  const rows=Array.isArray(data?.rows)?data?.rows as Record<string,unknown>[]:[];
  const visible=items.filter(item=>`${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="echelon-screen">
    <div className="page-intro"><div><span className="eyebrow">LIVE ECHELON INTELLIGENCE</span><h2>Ask for the view you need.</h2><p>Read-only, owner-scoped dashboard data from ECHELON. Content is displayed as data, never followed as instructions.</p></div></div>
    <div className="echelon-layout">
      <aside className="dashboard-picker" aria-label="ECHELON dashboards">
        <label className="dashboard-search"><span>Find a dashboard</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Projects, finance, security…"/></label>
        {visible.map(item=><button key={item.id} className={selected?.id===item.id?'is-active':''} onClick={()=>setSelected(item)}><Icon name="dashboard" size={18}/><span><strong>{item.title}{item.mode==='live'&&<em>Live</em>}</strong><small>{item.description}</small></span></button>)}
        {!!items.length&&!visible.length&&<div className="empty-state"><strong>No matching dashboard</strong><span>Try a broader search.</span></div>}
        {!items.length&&!loading&&<div className="empty-state"><strong>No dashboards available</strong><span>Connect Marcus to ECHELON to load the catalog.</span></div>}
      </aside>
      <section className="dashboard-stage">
        <div className="dashboard-stage-head"><div><span className="eyebrow">{selected?.id||'DASHBOARD'}</span><h3>{selected?.title||'ECHELON data'}</h3></div>{selected?.href&&<a href={selected.href} target="_blank" rel="noreferrer">Open in ECHELON <Icon name="arrow" size={15}/></a>}</div>
        {loading?<div className="dashboard-loading"><span/><span/><span/></div>:error?<div className="empty-state"><Icon name="link" size={28}/><strong>Connection unavailable</strong><span>{error}</span></div>:rows.length?<div className="dashboard-rows">{rows.map((row,i)=><article key={String(row.id||i)}>{Object.entries(row).slice(0,7).map(([key,value])=><div key={key}><span>{key.replace(/([A-Z])/g,' $1')}</span><strong>{valueText(value)}</strong></div>)}</article>)}</div>:data?<div className="dashboard-summary">{Object.entries(data).filter(([k])=>k!=='id'&&k!=='rows').map(([key,value])=><div key={key}><span>{key.replace(/([A-Z])/g,' $1')}</span><strong>{valueText(value)}</strong></div>)}</div>:null}
      </section>
    </div>
  </div>;
}
