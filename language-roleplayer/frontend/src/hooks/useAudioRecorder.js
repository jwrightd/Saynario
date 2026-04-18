/**
 * Custom hook for managing microphone audio recording.
 * Streams 16 kHz mono PCM chunks so backend VAD can inspect samples directly.
 */

import { useState, useRef, useCallback } from 'react';

const TARGET_SAMPLE_RATE = 16000;

function appendFloat32Buffer(existing, incoming) {
  const combined = new Float32Array(existing.length + incoming.length);
  combined.set(existing, 0);
  combined.set(incoming, existing.length);
  return combined;
}

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
  if (inputSampleRate === outputSampleRate) {
    return buffer;
  }

  if (inputSampleRate < outputSampleRate) {
    return buffer;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.round(buffer.length / sampleRateRatio));
  const result = new Float32Array(outputLength);
  let inputOffset = 0;

  for (let outputOffset = 0; outputOffset < outputLength; outputOffset += 1) {
    const nextInputOffset = Math.min(
      buffer.length,
      Math.round((outputOffset + 1) * sampleRateRatio),
    );

    let sum = 0;
    let count = 0;
    for (let i = inputOffset; i < nextInputOffset; i += 1) {
      sum += buffer[i];
      count += 1;
    }

    result[outputOffset] = count > 0 ? sum / count : 0;
    inputOffset = nextInputOffset;
  }

  return result;
}

function encodePcm16Base64(buffer) {
  const pcmBuffer = new ArrayBuffer(buffer.length * 2);
  const view = new DataView(pcmBuffer);

  for (let i = 0; i < buffer.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, buffer[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(i * 2, intSample, true);
  }

  const bytes = new Uint8Array(pcmBuffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

export default function useAudioRecorder({
  onAudioChunk,
  onRecordingStop,
  chunkIntervalMs = 250,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const processorNodeRef = useRef(null);
  const muteNodeRef = useRef(null);
  const inputBufferRef = useRef(new Float32Array(0));

  const emitBufferedAudio = useCallback((flushAll = false) => {
    const audioContext = audioContextRef.current;
    if (!audioContext || !onAudioChunk) {
      return;
    }

    const targetInputFrames = Math.max(
      1,
      Math.round(audioContext.sampleRate * (chunkIntervalMs / 1000)),
    );

    while (
      inputBufferRef.current.length >= targetInputFrames ||
      (flushAll && inputBufferRef.current.length > 0)
    ) {
      const frameCount = flushAll
        ? inputBufferRef.current.length
        : targetInputFrames;
      const chunk = inputBufferRef.current.slice(0, frameCount);
      inputBufferRef.current = inputBufferRef.current.slice(frameCount);

      const downsampled = downsampleBuffer(
        chunk,
        audioContext.sampleRate,
        TARGET_SAMPLE_RATE,
      );

      if (downsampled.length > 0) {
        onAudioChunk(encodePcm16Base64(downsampled));
      }
    }
  }, [chunkIntervalMs, onAudioChunk]);

  const teardownAudioGraph = useCallback(async () => {
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (muteNodeRef.current) {
      muteNodeRef.current.disconnect();
      muteNodeRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) {
      return;
    }

    try {
      setError(null);
      inputBufferRef.current = new Float32Array(0);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const muteNode = audioContext.createGain();
      muteNode.gain.value = 0;

      sourceNodeRef.current = source;
      processorNodeRef.current = processor;
      muteNodeRef.current = muteNode;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        inputBufferRef.current = appendFloat32Buffer(
          inputBufferRef.current,
          new Float32Array(inputData),
        );
        emitBufferedAudio(false);
      };

      source.connect(processor);
      processor.connect(muteNode);
      muteNode.connect(audioContext.destination);

      await audioContext.resume();
      setIsRecording(true);
    } catch (err) {
      await teardownAudioGraph();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setError(err.message || 'Failed to access microphone');
      console.error('Microphone error:', err);
    }
  }, [emitBufferedAudio, isRecording, teardownAudioGraph]);

  const stopRecording = useCallback(async () => {
    emitBufferedAudio(true);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    await teardownAudioGraph();
    inputBufferRef.current = new Float32Array(0);
    setIsRecording(false);

    if (onRecordingStop) {
      onRecordingStop();
    }
  }, [emitBufferedAudio, onRecordingStop, teardownAudioGraph]);

  return { isRecording, startRecording, stopRecording, error };
}
