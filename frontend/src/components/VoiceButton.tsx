import React, { useEffect, useRef } from 'react';
import { acquireMicrophone } from '../lib/microphone-capture';
import { recorderMime } from '../lib/recorder-mime';

interface VoiceButtonProps {
  isListening: boolean;
  isSpeaking: boolean;
  onStart: () => void;
  onStop: () => void;
  onVoiceInput: (audio: Blob) => void;
  // Runs inside the press itself, so the page can unlock audio playback while the browser still allows it.
  onPress?: () => void;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ isListening, isSpeaking, onStart, onStop, onVoiceInput, onPress }) => {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // True from press to release. The permission prompt can answer after the finger is up.
  const heldRef = useRef(false);
  // True while a microphone request is unanswered, so a quick release and re-press cannot start a second one.
  const pendingRef = useRef(false);

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    if (heldRef.current || recorderRef.current || pendingRef.current) return; // one recorder at a time
    heldRef.current = true;
    pendingRef.current = true;
    onPress?.();
    try {
      const stream = await acquireMicrophone(() => navigator.mediaDevices.getUserMedia({ audio: true }), () => heldRef.current);
      if (!stream) return; // released first: the helper already stopped the tracks, nothing was recorded
      streamRef.current = stream;
      const mimeType = recorderMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        recorderRef.current = null;
        releaseStream();
        if (blob.size > 0) onVoiceInput(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      onStart();
    } catch (error) {
      heldRef.current = false;
      releaseStream();
      console.error('Error accessing microphone:', error);
    } finally {
      pendingRef.current = false;
    }
  };

  const stopRecording = () => {
    heldRef.current = false;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      onStop();
    }
  };

  useEffect(() => {
    return () => {
      heldRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.onstop = null;
      releaseStream();
    };
  }, []);

  return (
    <button
      className={`voice-button ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
      onPointerDown={(e) => {
        // Keep the release event even if the finger drifts off the button.
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* not every browser allows it; the button still works without */
        }
        startRecording();
      }}
      onPointerUp={stopRecording}
      onPointerCancel={stopRecording}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isListening ? '🎤 Listening...' : isSpeaking ? '🔊 Speaking...' : '🎤 Hold to Talk'}
    </button>
  );
};

export default VoiceButton;
