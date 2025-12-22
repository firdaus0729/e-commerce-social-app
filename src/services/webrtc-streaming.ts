// WebRTC Streaming Service - Manages live streaming rooms and viewer counts
// This replaces MediaSoup with a simpler WebRTC-based approach

interface StreamRoom {
  streamId: string;
  broadcasterId: string;
  viewers: Set<string>; // Set of viewer user IDs
  createdAt: Date;
}

class WebRTCStreamingService {
  private rooms: Map<string, StreamRoom> = new Map();

  // Create or get a stream room
  createRoom(streamId: string, broadcasterId: string): StreamRoom {
    const existing = this.rooms.get(streamId);
    if (existing) {
      return existing;
    }

    const room: StreamRoom = {
      streamId,
      broadcasterId,
      viewers: new Set(),
      createdAt: new Date(),
    };

    this.rooms.set(streamId, room);
    return room;
  }

  // Add a viewer to a stream
  addViewer(streamId: string, viewerId: string): number {
    const room = this.rooms.get(streamId);
    if (!room) {
      return 0;
    }

    room.viewers.add(viewerId);
    return room.viewers.size;
  }

  // Remove a viewer from a stream
  removeViewer(streamId: string, viewerId: string): number {
    const room = this.rooms.get(streamId);
    if (!room) {
      return 0;
    }

    room.viewers.delete(viewerId);
    return room.viewers.size;
  }

  // Get viewer count
  getViewerCount(streamId: string): number {
    const room = this.rooms.get(streamId);
    return room ? room.viewers.size : 0;
  }

  // Get room info
  getRoomInfo(streamId: string): StreamRoom | null {
    return this.rooms.get(streamId) || null;
  }

  // Close a room
  closeRoom(streamId: string): void {
    this.rooms.delete(streamId);
  }

  // Check if room exists
  hasRoom(streamId: string): boolean {
    return this.rooms.has(streamId);
  }
}

export const webrtcStreamingService = new WebRTCStreamingService();

