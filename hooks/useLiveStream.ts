import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Stream } from '@/types';
import { webrtcStreamingClient } from '@/services/webrtc-streaming-client';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';

export function useLiveStream(streamId: string | null) {
  const { user } = useAuth();
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!streamId || !user?.token) return;

    // Connect to WebSocket
    socketRef.current = webrtcStreamingClient.connect(user.token);

    socketRef.current.on('viewer-count-updated', (data: { streamId: string; viewerCount: number }) => {
      if (data.streamId === streamId) {
        setViewerCount(data.viewerCount);
      }
    });

    socketRef.current.on('stream-ended', (data: { streamId: string }) => {
      if (data.streamId === streamId) {
        setStream((prev) => prev ? { ...prev, status: 'ended' } : null);
      }
    });

    // Join stream room
    socketRef.current.emit('join-stream', { streamId });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-stream', { streamId });
      }
    };
  }, [streamId, stream?.roomId, user?.token]);

  const loadStream = async () => {
    if (!streamId || !user?.token) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Stream>(`/streams/${streamId}`, user.token);
      setStream(data);
      setViewerCount(data.viewerCount || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load stream');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (streamId) {
      loadStream();
    }
  }, [streamId]);

  return {
    stream,
    loading,
    error,
    viewerCount,
    reload: loadStream,
  };
}

