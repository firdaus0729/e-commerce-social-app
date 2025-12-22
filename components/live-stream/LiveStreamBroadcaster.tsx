import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Alert, ActivityIndicator, Platform } from 'react-native';
import { RTCView, mediaDevices, RTCPeerConnection } from 'react-native-webrtc';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { webrtcStreamingClient } from '@/services/webrtc-streaming-client';
import { Stream } from '@/types';
import { brandYellow } from '@/constants/theme';
import { StreamComments } from './StreamComments';

interface LiveStreamBroadcasterProps {
  stream: Stream;
  onStop: () => void;
}

export function LiveStreamBroadcaster({ stream, onStop }: LiveStreamBroadcasterProps) {
  const { user } = useAuth();
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [loading, setLoading] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map()); // key: viewerId
  const socketRef = useRef<any>(null);
  const broadcasterPcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (stream.status === 'live' && !isStreaming && user?.token) {
      startStreaming();
    }

    return () => {
      if (isStreaming) {
        stopStreaming();
      }
    };
  }, [stream.status, stream.roomId]);

  const startStreaming = async () => {
    if (!user?.token || !stream._id) {
      Alert.alert('Error', 'Missing required information to start stream');
      return;
    }

    setLoading(true);
    try {
      // Request permissions and get user media
      const mediaStream = await mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      localStreamRef.current = mediaStream;

      // Connect to WebSocket
      socketRef.current = webrtcStreamingClient.connect(user.token);
      
      socketRef.current.on('viewer-count-updated', (data: { streamId: string; viewerCount: number }) => {
        if (data.streamId === stream._id) {
          setViewerCount(data.viewerCount);
        }
      });

      socketRef.current.on('viewer-joined', async (data: { streamId: string; viewerId: string }) => {
        if (data.streamId === stream._id) {
          await handleNewViewer(data.viewerId);
        }
      });

      socketRef.current.on('viewer-left', (data: { streamId: string; viewerId: string }) => {
        if (data.streamId === stream._id) {
          removeViewerConnection(data.viewerId);
        }
      });

      socketRef.current.on('stream-answer', async (data: { streamId: string; viewerId: string; answer: RTCSessionDescriptionInit }) => {
        if (data.streamId === stream._id) {
          const pc = peerConnectionsRef.current.get(data.viewerId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
        }
      });

      socketRef.current.on('stream-ice-candidate', async (data: { streamId: string; fromUserId: string; candidate: RTCIceCandidateInit }) => {
        if (data.streamId === stream._id) {
          const pc = peerConnectionsRef.current.get(data.fromUserId);
          if (pc && data.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          }
        }
      });

      // Join stream room as broadcaster
      socketRef.current.emit('join-stream', { streamId: stream._id });

      setIsStreaming(true);
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to start streaming:', error);
      Alert.alert('Error', error.message || 'Failed to start streaming. Please check your camera and microphone permissions.');
      setLoading(false);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    }
  };

  const handleNewViewer = async (viewerId: string) => {
    if (!localStreamRef.current) return;

    try {
      // Create peer connection for this viewer
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Add local tracks to peer connection
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          webrtcStreamingClient.sendIceCandidate(stream._id, viewerId, event.candidate.toJSON());
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      webrtcStreamingClient.sendOffer(stream._id, viewerId, offer);

      peerConnectionsRef.current.set(viewerId, pc);
    } catch (error) {
      console.error('Error handling new viewer:', error);
    }
  };

  const removeViewerConnection = (viewerId: string) => {
    const pc = peerConnectionsRef.current.get(viewerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(viewerId);
    }
  };

  const stopStreaming = async () => {
    if (!user?.token || !stream._id) return;

    try {
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        localStreamRef.current = null;
      }

      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => {
        pc.close();
      });
      peerConnectionsRef.current.clear();

      // Stop stream on server
      await api.post(`/streams/${stream._id}/stop`, {}, user.token);

      // Disconnect WebSocket
      if (socketRef.current) {
        socketRef.current.emit('leave-stream', { streamId: stream._id });
        webrtcStreamingClient.disconnect();
        socketRef.current = null;
      }

      setIsStreaming(false);
      onStop();
    } catch (error: any) {
      console.error('Failed to stop streaming:', error);
      Alert.alert('Error', error.message || 'Failed to stop stream');
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={brandYellow} />
        <ThemedText style={styles.loadingText}>Starting stream...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {localStreamRef.current && (
        <RTCView
          streamURL={localStreamRef.current.toURL()}
          style={styles.video}
          objectFit="cover"
          mirror={true}
        />
      )}

      <View style={styles.overlay}>
        <View style={styles.header}>
          <View style={styles.viewerCount}>
            <MaterialIcons name="visibility" size={16} color="#fff" />
            <ThemedText style={styles.viewerCountText}>{viewerCount}</ThemedText>
          </View>
          <Pressable onPress={stopStreaming} style={styles.stopButton}>
            <ThemedText style={styles.stopButtonText}>End Stream</ThemedText>
          </Pressable>
        </View>

        <View style={styles.controls}>
          <Pressable onPress={toggleMute} style={[styles.controlButton, isMuted && styles.controlButtonActive]}>
            <MaterialIcons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
          </Pressable>
          <Pressable onPress={toggleVideo} style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}>
            <MaterialIcons name={isVideoOff ? 'videocam-off' : 'videocam'} size={24} color="#fff" />
          </Pressable>
        </View>
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
  stopButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  stopButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    padding: 20,
    paddingBottom: 40,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#EF4444',
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
});
