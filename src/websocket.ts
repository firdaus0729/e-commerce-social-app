import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './config/env';
import { User } from './models/User';
import { webrtcStreamingService } from './services/webrtc-streaming';

interface SocketUser {
  userId: string;
  socketId: string;
}

const connectedUsers = new Map<string, SocketUser>();

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, env.jwtSecret) as { userId: string };
      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.data.userId = user._id.toString();
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    connectedUsers.set(userId, { userId, socketId: socket.id });

    console.log(`User ${userId} connected`);

    socket.on('join', (data: { postId: string }) => {
      socket.join(`post:${data.postId}`);
      socket.join(`user:${userId}`);
    });

    socket.on('call-user', async (data: { to: string; offer: RTCSessionDescriptionInit; postId: string }) => {
      const targetUser = connectedUsers.get(data.to);
      if (targetUser) {
        io.to(targetUser.socketId).emit('incoming-call', {
          from: userId,
          offer: data.offer,
          postId: data.postId,
        });
      }
    });

    socket.on('call-accepted', (data: { to: string; answer: RTCSessionDescriptionInit }) => {
      const targetUser = connectedUsers.get(data.to);
      if (targetUser) {
        io.to(targetUser.socketId).emit('call-accepted', {
          from: userId,
          answer: data.answer,
        });
      }
    });

    socket.on('call-rejected', (data: { to: string }) => {
      const targetUser = connectedUsers.get(data.to);
      if (targetUser) {
        io.to(targetUser.socketId).emit('call-rejected', {
          from: userId,
        });
      }
    });

    socket.on('ice-candidate', (data: { to: string; candidate: RTCIceCandidateInit }) => {
      const targetUser = connectedUsers.get(data.to);
      if (targetUser) {
        io.to(targetUser.socketId).emit('ice-candidate', {
          from: userId,
          candidate: data.candidate,
        });
      }
    });

    // Live streaming events - WebRTC signaling
    socket.on('join-stream', async (data: { streamId: string }) => {
      try {
        socket.join(`stream:${data.streamId}`);
        
        // Add viewer to room
        const viewerCount = webrtcStreamingService.addViewer(data.streamId, userId);
        
        // Notify broadcaster of new viewer
        const roomInfo = webrtcStreamingService.getRoomInfo(data.streamId);
        if (roomInfo && roomInfo.broadcasterId) {
          const broadcaster = connectedUsers.get(roomInfo.broadcasterId);
          if (broadcaster) {
            io.to(broadcaster.socketId).emit('viewer-joined', {
              streamId: data.streamId,
              viewerId: userId,
              viewerCount,
            });
          }
        }
        
        // Broadcast updated viewer count to all viewers
        io.to(`stream:${data.streamId}`).emit('viewer-count-updated', {
          streamId: data.streamId,
          viewerCount,
        });
      } catch (error) {
        console.error('Error joining stream:', error);
      }
    });

    socket.on('leave-stream', (data: { streamId: string }) => {
      socket.leave(`stream:${data.streamId}`);
      
      // Remove viewer from room
      const viewerCount = webrtcStreamingService.removeViewer(data.streamId, userId);
      
      // Notify broadcaster
      const roomInfo = webrtcStreamingService.getRoomInfo(data.streamId);
      if (roomInfo && roomInfo.broadcasterId) {
        const broadcaster = connectedUsers.get(roomInfo.broadcasterId);
        if (broadcaster) {
          io.to(broadcaster.socketId).emit('viewer-left', {
            streamId: data.streamId,
            viewerId: userId,
            viewerCount,
          });
        }
      }
      
      // Broadcast updated viewer count
      io.to(`stream:${data.streamId}`).emit('viewer-count-updated', {
        streamId: data.streamId,
        viewerCount,
      });
    });

    // WebRTC signaling for live streaming
    socket.on('stream-offer', (data: { streamId: string; viewerId: string; offer: RTCSessionDescriptionInit }) => {
      // Broadcaster sends offer to viewer
      const viewer = connectedUsers.get(data.viewerId);
      if (viewer) {
        io.to(viewer.socketId).emit('stream-offer', {
          streamId: data.streamId,
          broadcasterId: userId,
          offer: data.offer,
        });
      }
    });

    socket.on('stream-answer', (data: { streamId: string; broadcasterId: string; answer: RTCSessionDescriptionInit }) => {
      // Viewer sends answer to broadcaster
      const broadcaster = connectedUsers.get(data.broadcasterId);
      if (broadcaster) {
        io.to(broadcaster.socketId).emit('stream-answer', {
          streamId: data.streamId,
          viewerId: userId,
          answer: data.answer,
        });
      }
    });

    socket.on('stream-ice-candidate', (data: { streamId: string; targetUserId: string; candidate: RTCIceCandidateInit }) => {
      // Forward ICE candidate to target user
      const targetUser = connectedUsers.get(data.targetUserId);
      if (targetUser) {
        io.to(targetUser.socketId).emit('stream-ice-candidate', {
          streamId: data.streamId,
          fromUserId: userId,
          candidate: data.candidate,
        });
      }
    });

    socket.on('stream-started', (data: { streamId: string }) => {
      // Broadcast to all users that a stream has started
      io.emit('stream-live', { streamId: data.streamId });
    });

    socket.on('stream-ended', (data: { streamId: string }) => {
      // Broadcast to all users that a stream has ended
      io.emit('stream-ended', { streamId: data.streamId });
    });

    // Stream comments
    socket.on('stream-comment', (data: { streamId: string; text: string }) => {
      // Broadcast comment to all viewers
      io.to(`stream:${data.streamId}`).emit('new-comment', {
        streamId: data.streamId,
        text: data.text,
        userId: userId,
        userName: 'User', // Will be populated from DB if needed
        createdAt: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      console.log(`User ${userId} disconnected`);
    });
  });

  return io;
}

