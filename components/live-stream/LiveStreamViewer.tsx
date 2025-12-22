import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Alert, ActivityIndicator, Platform } from 'react-native';
import { RTCView, RTCPeerConnection } from 'react-native-webrtc';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';
import { webrtcStreamingClient } from '@/services/webrtc-streaming-client';
import { Stream } from '@/types';
import { brandYellow } from '@/constants/theme';
import { StreamComments } from './StreamComments';

interface LiveStreamViewerProps {
  stream: Stream;
  onClose: () => void;
}

export function LiveStreamViewer({ stream, onClose }: LiveStreamViewerProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);
  const broadcasterIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (stream.status === 'live' && stream.broadcasterId && user?.token) {
      joinStream();
    } else {
      setError('Stream is not live');
      setLoading(false);
    }

    return () => {
      leaveStream();
    };
  }, [stream.status, stream.broadcasterId, user?.token]);

  const joinStream = async () => {
    if (!user?.token || !stream._id || !stream.broadcasterId) return;

    setLoading(true);
    setError(null);

    try {
      const broadcasterId = typeof stream.broadcasterId === 'string' 
        ? stream.broadcasterId 
        : stream.broadcasterId._id?.toString() || stream.broadcasterId.toString();
      
      broadcasterIdRef.current = broadcasterId;

      // Connect to WebSocket
      socketRef.current = webrtcStreamingClient.connect(user.token);
      
      socketRef.current.on('viewer-count-updated', (data: { streamId: string; viewerCount: number }) => {
        if (data.streamId === stream._id) {
          setViewerCount(data.viewerCount);
        }
      });

      socketRef.current.on('stream-ended', (data: { streamId: string }) => {
        if (data.streamId === stream._id) {
          Alert.alert('Stream Ended', 'The broadcaster has ended the stream');
          onClose();
        }
      });

      socketRef.current.on('stream-offer', async (data: { streamId: string; broadcasterId: string; offer: RTCSessionDescriptionInit }) => {
        if (data.streamId === stream._id && data.broadcasterId === broadcasterId) {
          await handleOffer(data.offer);
        }
      });

      socketRef.current.on('stream-ice-candidate', async (data: { streamId: string; fromUserId: string; candidate: RTCIceCandidateInit }) => {
        if (data.streamId === stream._id && data.fromUserId === broadcasterId && peerConnectionRef.current) {
          if (data.candidate) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          }
        }
      });

      // Join stream room
      socketRef.current.emit('join-stream', { streamId: stream._id });

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          setLoading(false);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current && broadcasterId) {
          webrtcStreamingClient.sendIceCandidate(stream._id, broadcasterId, event.candidate.toJSON());
        }
      };

      peerConnectionRef.current = pc;

      // Wait for offer from broadcaster (will be sent when broadcaster detects viewer)
    } catch (error: any) {
      console.error('Failed to join stream:', error);
      setError(error.message || 'Failed to join stream. The stream may have ended.');
      setLoading(false);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current || !broadcasterIdRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Create answer
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      // Send answer to broadcaster
      webrtcStreamingClient.sendAnswer(stream._id, broadcasterIdRef.current, answer);
    } catch (error) {
      console.error('Error handling offer:', error);
      setError('Failed to establish connection with broadcaster');
      setLoading(false);
    }
  };

  const leaveStream = async () => {
    if (!user?.token || !stream._id) return;

    try {
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Stop remote stream
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
        remoteStreamRef.current = null;
      }

      // Leave stream room
      if (socketRef.current) {
        socketRef.current.emit('leave-stream', { streamId: stream._id });
        webrtcStreamingClient.disconnect();
        socketRef.current = null;
      }
    } catch (error: any) {
      console.error('Failed to leave stream:', error);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={brandYellow} />
        <ThemedText style={styles.loadingText}>Connecting to stream...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <ThemedText style={styles.closeButtonText}>Close</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {remoteStreamRef.current ? (
        <RTCView
          streamURL={remoteStreamRef.current.toURL()}
          style={styles.video}
          objectFit="contain"
        />
      ) : (
        <View style={styles.placeholder}>
          <MaterialIcons name="videocam" size={64} color="#666" />
          <ThemedText style={styles.placeholderText}>Waiting for stream...</ThemedText>
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={styles.viewerCount}>
            <MaterialIcons name="visibility" size={16} color="#fff" />
            <ThemedText style={styles.viewerCountText}>{viewerCount}</ThemedText>
          </View>
        </View>

        {stream.broadcasterId && (
          <View style={styles.broadcasterInfo}>
            <ThemedText style={styles.broadcasterName}>
              {typeof stream.broadcasterId === 'object' ? stream.broadcasterId.name : 'Broadcaster'}
            </ThemedText>
            <ThemedText style={styles.streamTitle}>{stream.title}</ThemedText>
          </View>
        )}
      </View>

      <StreamComments streamId={stream._id} roomId={stream.roomId || stream._id} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  placeholderText: {
    marginTop: 16,
    color: '#999',
    fontSize: 16,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  viewerCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  broadcasterInfo: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  broadcasterName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  streamTitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
  errorText: {
    marginTop: 16,
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: brandYellow,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 16,
  },
});
