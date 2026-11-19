import React from 'react';

export type IconName = 'chat'|'tasks'|'briefings'|'memory'|'settings'|'chevron'|'arrow'|'spark'|'lock'|'calendar'|'activity'|'menu'|'check'|'plus'|'mic'|'shield'|'search'|'wallet'|'bell'|'volume'|'link'|'pause'|'refresh'|'clock'|'send';

const shapes: Record<IconName, React.ReactNode> = {
  chat: <><path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-3.9-.9L4 20l1.4-4.1A8 8 0 1 1 20 11.5Z"/><path d="M8 10h8M8 13.5h5"/></>,
  tasks: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 10 1.5 1.5L12 9M14 10h3M8 16h9"/></>,
  briefings: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
  memory: <><path d="M12 3c-4.7 0-8 3.7-8 8.2 0 2.9 1.6 5.3 4 6.5V21h8v-3.3c2.4-1.2 4-3.6 4-6.5C20 6.7 16.7 3 12 3Z"/><path d="M8 10c0-1.7 1.2-3 2.8-3M11 15h5"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15.2 21 16.5l-2 3.4-1.9-.7a8 8 0 0 1-2.3 1.3l-.3 2h-4l-.4-2a8 8 0 0 1-2.2-1.3l-1.9.7-2-3.4 1.6-1.3a8 8 0 0 1 0-2.5L4 11.4 6 8l1.9.6a8 8 0 0 1 2.2-1.3l.4-2h4l.3 2a8 8 0 0 1 2.3 1.3L19 8l2 3.4-1.6 1.3a8 8 0 0 1 0 2.5Z" transform="translate(0 -1) scale(.96)" /></>,
  chevron: <path d="m9 6 6 6-6 6"/>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  spark: <><path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2ZM20 17l.7 1.3L22 19l-1.3.7L20 21l-.7-1.3L18 19l1.3-.7L20 17Z"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h3"/></>,
  activity: <><path d="M2 12h4l3-6 4 12 3-6h6"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></>,
  shield: <><path d="M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z"/><path d="m9 12 2 2 4-4"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  wallet: <><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13M16 14h5"/></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  volume: <><path d="M4 9v6h4l5 4V5L8 9H4ZM17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></>,
  link: <><path d="M9 15 15 9M10 7l2-2a4 4 0 0 1 6 6l-2 2M14 17l-2 2a4 4 0 0 1-6-6l2-2"/></>,
  pause: <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.4-2"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
  send: <path d="m3 20 18-8L3 4l2 7 10 1-10 1-2 7Z"/>
};

export default function Icon({name, size=20, className=''}: {name:IconName; size?:number; className?:string}) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}
