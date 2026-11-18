import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

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
        <span className={`status ${task.status}`}>{task.status}</span>
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

  const lane = (key: string, title: string) => (
    <div className="lane">
      <h3>{title}</h3>
      {tasks.filter((t) => t.lane === key).map(renderTask)}
    </div>
  );

  return (
    <div className="task-list">
      <h2>Tasks</h2>

      <div className="task-form">
        <input
          type="password"
          autoComplete="off"
          placeholder="Approval PIN (kept in memory only)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        {frozen ? (
          <button disabled={!pin} onClick={resume}>
            Resume Marcus (frozen)
          </button>
        ) : (
          <button onClick={freeze}>Freeze everything</button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}

      <div className="task-form">
        <input
          type="text"
          placeholder="Task title"
          value={newTask.title}
          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
        />
        <textarea
          placeholder="Task goal"
          value={newTask.goal}
          onChange={(e) => setNewTask({ ...newTask, goal: e.target.value })}
        />
        <select value={newTask.lane} onChange={(e) => setNewTask({ ...newTask, lane: e.target.value })}>
          <option value="lane1">Lane 1 (Marcus)</option>
          <option value="lane2">Lane 2 (ECHELON)</option>
          <option value="lane3">Lane 3 (Victor)</option>
        </select>
        <button onClick={createTask}>Add Task</button>
      </div>

      <div className="lanes">
        {lane('lane1', '📌 Lane 1 (Marcus)')}
        {lane('lane2', '🤖 Lane 2 (ECHELON)')}
        {lane('lane3', '👤 Lane 3 (Victor)')}
      </div>
    </div>
  );
};

export default TaskList;
