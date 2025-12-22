import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Platform, Alert } from 'react-native';
import { ThemedText } from './themed-text';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';
import { API_URL } from '@/constants/config';

interface AudioCallProps {
  visible: boolean;
  onClose: () => void;
  otherUserId: string;
  otherUserName: string;
  postId: string;
}

export function AudioCall({ visible, onClose, otherUserId, otherUserName, postId }: AudioCallProps) {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected' | 'ended'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (visible) {
      // Initialize call immediately when modal opens
      initializeCall();
    } else {
      endCall();
    }

    return () => {
      if (visible) {
        endCall();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const initializeCall = async () => {
    try {
      // For mobile, show a simple call interface
      // WebRTC requires native modules (react-native-webrtc) for mobile
      if (Platform.OS !== 'web') {
        // On mobile, just show the call interface
        // In production, you would integrate react-native-webrtc or Agora
        setCallStatus('calling');
        // Simulate call connection after 2 seconds
        setTimeout(() => {
          setCallStatus('connected');
        }, 2000);
        return;
      }

      // Web platform - use WebRTC
      if (navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });

        localStreamRef.current = stream;

        const configuration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        };

        const peerConnection = new RTCPeerConnection(configuration);
        peerConnectionRef.current = peerConnection;

        stream.getAudioTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        peerConnection.ontrack = (event) => {
          const remoteStream = event.streams[0];
          remoteStreamRef.current = remoteStream;
          setCallStatus('connected');
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate && wsRef.current) {
            wsRef.current.send(JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate,
              to: otherUserId,
              from: user?.id,
              postId,
            }));
          }
        };

        connectSignalingServer();
        setCallStatus('calling');
      }
    } catch (err: any) {
      console.error('Failed to initialize audio call:', err);
      // Don't show alert, just close silently on mobile
      if (Platform.OS === 'web') {
        Alert.alert('Error', err.message || 'Failed to initialize audio call');
      }
      onClose();
    }
  };

  const connectSignalingServer = () => {
    const wsUrl = API_URL.replace('http', 'ws').replace('https', 'wss');
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (user?.token) {
          ws.send(JSON.stringify({
            type: 'auth',
            token: user.token,
          }));
        }

        ws.send(JSON.stringify({
          type: 'join',
          userId: user?.id,
          postId,
        }));

        // Create offer immediately
        setTimeout(() => createOffer(), 100);
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'offer':
            await handleOffer(message.offer);
            break;
          case 'answer':
            await handleAnswer(message.answer);
            break;
          case 'ice-candidate':
            await handleIceCandidate(message.candidate);
            break;
          case 'call-accepted':
            setCallStatus('ringing');
            break;
          case 'call-rejected':
            onClose();
            break;
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (err) {
      console.error('Failed to connect to signaling server:', err);
    }
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current) return;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      if (wsRef.current && user?.id) {
        wsRef.current.send(JSON.stringify({
          type: 'offer',
          offer,
          to: otherUserId,
          from: user.id,
          postId,
        }));
      }
    } catch (err: any) {
      console.error('Failed to create offer:', err);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          answer,
          to: otherUserId,
          from: user?.id,
          postId,
        }));
      }
    } catch (err: any) {
      console.error('Failed to handle offer:', err);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err: any) {
      console.error('Failed to handle answer:', err);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err: any) {
      console.error('Failed to add ICE candidate:', err);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track: MediaStreamTrack) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setCallStatus('ended');
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.headerText}>
            {callStatus === 'calling' && 'Calling...'}
            {callStatus === 'ringing' && 'Ringing...'}
            {callStatus === 'connected' && 'Connected'}
            {callStatus === 'idle' && 'Audio Call'}
          </ThemedText>
          <ThemedText style={styles.userName}>{otherUserName}</ThemedText>
        </View>

        <View style={styles.content}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <MaterialIcons name="person" size={80} color="#fff" />
            </View>
          </View>

          <View style={styles.statusContainer}>
            {callStatus === 'connected' && (
              <ThemedText style={styles.statusText}>Call in progress</ThemedText>
            )}
            {callStatus === 'calling' && (
              <ThemedText style={styles.statusText}>Connecting...</ThemedText>
            )}
            {callStatus === 'ringing' && (
              <ThemedText style={styles.statusText}>Ringing...</ThemedText>
            )}
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
          >
            <MaterialIcons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
          </Pressable>

          <Pressable
            style={[styles.controlButton, styles.endCallButton]}
            onPress={endCall}
          >
            <MaterialIcons name="call-end" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  userName: {
    fontSize: 14,
    color: '#999',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    marginBottom: 40,
  },
  avatarCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusContainer: {
    marginTop: 20,
  },
  statusText: {
    fontSize: 16,
    color: '#999',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#EF4444',
  },
  endCallButton: {
    backgroundColor: '#EF4444',
  },
});

