// WebRTC Streaming Client - Handles WebRTC peer connections for live streaming
import { API_URL } from '@/constants/config';
import io, { Socket } from 'socket.io-client';

interface PeerConnection {
  pc: RTCPeerConnection;
  streamId: string;
  userId: string;
  isBroadcaster: boolean;
}

class WebRTCStreamingClient {
  private socket: Socket | null = null;
  private peerConnections: Map<string, PeerConnection> = new Map(); // key: userId or streamId

  connect(token: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.cleanup();
  }

  private cleanup() {
    // Close all peer connections
    this.peerConnections.forEach((pc) => {
      pc.pc.close();
    });
    this.peerConnections.clear();
  }

  // Create a peer connection for broadcaster
  createBroadcasterConnection(streamId: string): RTCPeerConnection {
    const existing = this.peerConnections.get(`broadcaster:${streamId}`);
    if (existing) {
      return existing.pc;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.peerConnections.set(`broadcaster:${streamId}`, {
      pc,
      streamId,
      userId: '',
      isBroadcaster: true,
    });

    return pc;
  }

  // Create a peer connection for viewer
  createViewerConnection(streamId: string, broadcasterId: string): RTCPeerConnection {
    const key = `viewer:${streamId}:${broadcasterId}`;
    const existing = this.peerConnections.get(key);
    if (existing) {
      return existing.pc;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.peerConnections.set(key, {
      pc,
      streamId,
      userId: broadcasterId,
      isBroadcaster: false,
    });

    return pc;
  }

  // Get peer connection
  getPeerConnection(streamId: string, userId?: string, isBroadcaster?: boolean): RTCPeerConnection | null {
    if (isBroadcaster) {
      return this.peerConnections.get(`broadcaster:${streamId}`)?.pc || null;
    }
    if (userId) {
      return this.peerConnections.get(`viewer:${streamId}:${userId}`)?.pc || null;
    }
    return null;
  }

  // Remove peer connection
  removePeerConnection(streamId: string, userId?: string, isBroadcaster?: boolean) {
    if (isBroadcaster) {
      const pc = this.peerConnections.get(`broadcaster:${streamId}`);
      if (pc) {
        pc.pc.close();
        this.peerConnections.delete(`broadcaster:${streamId}`);
      }
    } else if (userId) {
      const key = `viewer:${streamId}:${userId}`;
      const pc = this.peerConnections.get(key);
      if (pc) {
        pc.pc.close();
        this.peerConnections.delete(key);
      }
    }
  }

  // Send offer to viewer
  sendOffer(streamId: string, viewerId: string, offer: RTCSessionDescriptionInit) {
    if (this.socket) {
      this.socket.emit('stream-offer', { streamId, viewerId, offer });
    }
  }

  // Send answer to broadcaster
  sendAnswer(streamId: string, broadcasterId: string, answer: RTCSessionDescriptionInit) {
    if (this.socket) {
      this.socket.emit('stream-answer', { streamId, broadcasterId, answer });
    }
  }

  // Send ICE candidate
  sendIceCandidate(streamId: string, targetUserId: string, candidate: RTCIceCandidateInit) {
    if (this.socket) {
      this.socket.emit('stream-ice-candidate', { streamId, targetUserId, candidate });
    }
  }
}

export const webrtcStreamingClient = new WebRTCStreamingClient();

