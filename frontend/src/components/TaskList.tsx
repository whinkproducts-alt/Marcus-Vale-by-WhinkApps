import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Icon from './Icon';

const API_BASE = '/api';
const POLL_MS = 10000;
// Tasks that may already have an ECHELON handoff, so their live status is worth asking for.
const WITH_HANDOFF = ['handed_off', 'awaiting_confirmation', 'blocked', 'done', 'failed', 'cancelled'];

type Task = { id: string; title: string; goal: string; lane: string; status: string };
type Live = { echelonStatus?: string; resultSummary?: string | null; stale?: boolean };

// Approval ids are not secret (the PIN guards creating one), so a reload keeps them for this tab only.
const loadApprovals = (): Record<string, string> => {
  try {
    return JSON.parse(sessionStorage.getItem('marcus-approvals') || '{}');
  } catch {
    return {};
  }
};
const saveApprovals = (a: Record<string, string>) => {
  try {
    sessionStorage.setItem('marcus-approvals', JSON.stringify(a));
  } catch {
    /* storage can be blocked; the page still works until reload */
  }
};

const errorText = (e: any): string => {
  if (e?.response?.status === 429) return 'PIN locked, restart the backend or wait 15 minutes.';
  if (e?.response?.status === 403) return 'Wrong PIN.';
  const d = e?.response?.data?.detail;
  return typeof d === 'string' ? d : 'Request failed. Try again.';
};

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState({ title: '', goal: '', lane: 'lane1' });
  const [live, setLive] = useState<Record<string, Live>>({});
  const [approvals, setApprovals] = useState<Record<string, string>>(loadApprovals);
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState('');
  // The PIN lives in React memory only: never localStorage, never a cookie.
  const [pin, setPin] = useState('');
  const pinRef = useRef('');
  pinRef.current = pin;

  const pinHeaders = () => ({ headers: { 'X-Approval-Pin': pinRef.current } });

  const fail = (e: any) => {
    if (e?.response?.status === 403) setPin('');
    setError(errorText(e));
  };

  const load = async () => {
    try {
      const [t, c] = await Promise.all([axios.get(`${API_BASE}/tasks/`), axios.get(`${API_BASE}/control/status`)]);
      const list: Task[] = t.data.tasks;
      setTasks(list);
      setFrozen(!!c.data.frozen);
      const next: Record<string, Live> = {};
      await Promise.all(
        list
          .filter((x) => WITH_HANDOFF.includes(x.status))
          .map(async (x) => {
            try {
              const r = await axios.get(`${API_BASE}/echelon/status/${x.id}`);
              next[x.id] = {
                echelonStatus: r.data.handoff?.status,
                resultSummary: r.data.result_summary,
                stale: r.data.stale,
              };
            } catch {
              /* 404 means no handoff yet; ECHELON off gives 503. Neither needs a message here. */
            }
          }),
      );
      setLive(next);
    } catch (e) {
      console.error('Error loading tasks:', e);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const createTask = async () => {
    try {
      await axios.post(`${API_BASE}/tasks/`, newTask);
      setNewTask({ title: '', goal: '', lane: 'lane1' });
      setError('');
      load();
    } catch (e) {
      fail(e);
    }
  };

  const remember = (taskId: string, approvalId: string) => {
    const next = { ...approvals, [taskId]: approvalId };
    setApprovals(next);
    saveApprovals(next);
  };

  const approve = async (task: Task): Promise<string | null> => {
    try {
      const r = await axios.post(`${API_BASE}/tasks/${task.id}/approve`, null, { params: { method: 'tap' }, ...pinHeaders() });
      remember(task.id, r.data.approval.id);
      setError('');
      setPin(''); // one entry, one approval: the next one asks again
      return r.data.approval.id;
    } catch (e) {
      fail(e);
      return null;
    }
  };

  const send = async (task: Task) => {
    try {
      await axios.post(`${API_BASE}/echelon/handoff`, null, { params: { task_id: task.id, approval_id: approvals[task.id] } });
      setError('');
      load();
    } catch (e) {
      const st = (e as any)?.response?.status;
      if (st === 400 || st === 409) {
        // The stored approval is spent or stale: forget it so Approve shows again.
        const next = { ...approvals };
        delete next[task.id];
        setApprovals(next);
        saveApprovals(next);
      }
      fail(e);
    }
  };

  // ECHELON asked for a second yes (money or proprietary work): a NEW approval, then confirm.
  const confirmSecond = async (task: Task) => {
    const approvalId = await approve(task);
    if (!approvalId) return;
    try {
      await axios.post(`${API_BASE}/echelon/confirm`, null, { params: { task_id: task.id, approval_id: approvalId } });
      load();
    } catch (e) {
      fail(e);
    }
  };

  const freeze = async () => {
    try {
      await axios.post(`${API_BASE}/control/freeze`);
      setError('');
      load();
    } catch (e) {
      fail(e);
    }
  };

  const resume = async () => {
    try {
      await axios.post(`${API_BASE}/control/resume`, null, pinHeaders());
      setError('');
      setPin('');
      load();
    } catch (e) {
      fail(e);
    }
  };

  const renderTask = (task: Task) => {
    const info = live[task.id] || {};
    return (
      <div key={task.id} className="task">
        <h4>{task.title}</h4>
        <p>{task.goal}</p>
        <span className={`status ${task.status}`}>{task.status.replace(/_/g, ' ')}</span>
        {info.echelonStatus && <span className="status"> ECHELON: {info.echelonStatus}</span>}
        {info.stale && <p>Status may be out of date: ECHELON did not answer.</p>}
        {task.status === 'pending' && !approvals[task.id] && (
          <button disabled={!pin} onClick={() => approve(task)}>
            Approve
          </button>
        )}
        {task.status === 'pending' && approvals[task.id] && (
          <button disabled={frozen} onClick={() => send(task)}>
            Send to ECHELON
          </button>
        )}
        {task.status === 'awaiting_confirmation' && (
          <div className="task">
            <strong>Second approval needed.</strong>
            <p>ECHELON is holding this task until you approve it again.</p>
            <button disabled={!pin || frozen} onClick={() => confirmSecond(task)}>
              Approve again and confirm
            </button>
          </div>
        )}
        {/* Model output is untrusted: shown as plain text, never as markup. */}
        {info.resultSummary && <p className="briefing-text">{info.resultSummary}</p>}
      </div>
    );
  };

  const lane = (key: string, title: string) => {
    const items=tasks.filter(t=>t.lane===key);
    return <section className="lane" aria-label={title} key={key}>
      <h3>{title}<span>{items.length} {items.length===1?'task':'tasks'}</span></h3>
      {items.length ? items.map(renderTask) : <div className="empty-state"><Icon name="tasks" size={25}/><strong>All clear</strong>No tasks in this lane yet.</div>}
    </section>;
  };
  const pending=tasks.filter(t=>t.status==='pending' || t.status==='awaiting_confirmation').length;
  const active=tasks.filter(t=>['in_progress','handed_off','blocked'].includes(t.status)).length;
  const finished=tasks.filter(t=>t.status==='done').length;

  return (
    <div className="task-list">
      <div className="page-intro">
        <div><span className="eyebrow">WORK MANAGEMENT</span><h2>Keep things moving.</h2><p>Give Marcus the goal, oversee approvals, and follow every handoff.</p></div>
      </div>
      <div className="metric-strip" aria-label="Task overview">
        <div className="metric"><Icon className="metric-icon" name="tasks"/><span className="metric-label">Total tasks</span><strong>{tasks.length}</strong></div>
        <div className="metric"><Icon className="metric-icon" name="clock"/><span className="metric-label">Need attention</span><strong>{pending}</strong></div>
        <div className="metric"><Icon className="metric-icon" name="check"/><span className="metric-label">Completed</span><strong>{finished}</strong></div>
      </div>
      <section className="control-panel" aria-label="Assistant control">
        <div><h3><Icon name={frozen?'pause':'shield'} size={16}/> {frozen?'Execution is frozen':'You stay in control'}</h3><p>Approvals require your PIN. Freezing stops new execution until you resume.</p></div>
        <div className="control-actions">
          <label className="visually-hidden" htmlFor="task-pin">Approval PIN</label>
          <input id="task-pin" type="password" autoComplete="off" placeholder="Approval PIN" value={pin} onChange={e=>setPin(e.target.value)}/>
          {frozen
            ? <button className="action-button" disabled={!pin} onClick={resume}><Icon name="refresh" size={15}/>Resume Marcus</button>
            : <button className="action-button danger-button" onClick={freeze}><Icon name="pause" size={15}/>Freeze actions</button>}
        </div>
      </section>
      {error && <p role="alert">{error}</p>}
      <section className="task-form" aria-label="Create new task">
        <h3>New task</h3>
        <p>Set a clear goal. Marcus won't send it to ECHELON until you explicitly approve it.</p>
        <div className="form-row">
          <label className="field-label">Task title
            <input type="text" placeholder="What needs to get done?" value={newTask.title} onChange={e=>setNewTask({...newTask,title:e.target.value})}/>
          </label>
          <label className="field-label">Assigned lane
            <select value={newTask.lane} onChange={e=>setNewTask({...newTask,lane:e.target.value})}>
              <option value="lane1">Marcus · Intake</option><option value="lane2">ECHELON · Execution</option><option value="lane3">Victor · Review</option>
            </select>
          </label>
        </div>
        <label className="field-label">Goal and context
          <textarea placeholder="Describe the outcome you need…" value={newTask.goal} onChange={e=>setNewTask({...newTask,goal:e.target.value})}/>
        </label>
        <div><button className="action-button" onClick={createTask} disabled={!newTask.title.trim() || !newTask.goal.trim()}><Icon name="plus" size={16}/>Create task</button></div>
      </section>
      <div className="page-intro"><div><span className="eyebrow">YOUR WORKFLOW</span><h2>Three lanes. One view.</h2><p>{active} currently active · {pending} needing attention</p></div></div>
      <div className="lanes">
        {lane('lane1','Marcus · Intake')}
        {lane('lane2','ECHELON · Execution')}
        {lane('lane3','Victor · Review')}
      </div>
    </div>
  );
};

export default TaskList;
