import React from 'react';
import { MarcusPortrait } from './Brand';

export type PresenceMode = 'listening' | 'speaking' | 'calling';

export default function AvatarPulse({mode}:{mode:PresenceMode|null}) {
  if (!mode) return null;
  const label = mode === 'listening' ? 'Marcus is listening' : mode === 'calling' ? 'Marcus is on a call' : 'Marcus is speaking';
  return <div className={`avatar-presence is-${mode}`} role="status" aria-live="polite" aria-label={label}>
    <div className="avatar-ripple avatar-ripple-a"/>
    <div className="avatar-ripple avatar-ripple-b"/>
    <MarcusPortrait/>
    <span>{label}</span>
  </div>;
}
