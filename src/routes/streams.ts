import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { Stream } from '../models/Stream';
import { SavedStream } from '../models/SavedStream';
import { Store } from '../models/Store';
import { webrtcStreamingService } from '../services/webrtc-streaming';

const router = Router();

// Create a new stream
router.post('/', auth, async (req: AuthRequest, res) => {
  try {
    const { title, pinnedProduct } = req.body;
    const store = await Store.findOne({ owner: req.user!._id });
    if (!store) return res.status(400).json({ message: 'Create a store first' });
    
    const roomId = `stream_${Date.now()}_${req.user!._id}`;
    
    const stream = await Stream.create({
      title,
      store: store._id,
      status: 'scheduled',
      roomId,
      broadcasterId: req.user!._id,
      pinnedProduct,
      viewerCount: 0,
    });
    
    res.status(201).json(stream);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get all streams (with live status)
router.get('/', async (_req, res) => {
  try {
    const streams = await Stream.find()
      .populate('broadcasterId', 'name profilePhoto')
      .populate('store', 'name logo')
      .populate('pinnedProduct')
      .sort({ createdAt: -1 })
      .limit(50);
    
    // Update viewer counts from WebRTC service
    const streamsWithViewers = await Promise.all(
      streams.map(async (stream) => {
        if (stream.status === 'live') {
          const viewerCount = webrtcStreamingService.getViewerCount(stream._id.toString());
          if (viewerCount !== stream.viewerCount) {
            stream.viewerCount = viewerCount;
            await stream.save();
          }
        }
        return stream;
      })
    );
    
    res.json(streamsWithViewers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get live streams only
router.get('/live', async (_req, res) => {
  try {
    const streams = await Stream.find({ status: 'live' })
      .populate('broadcasterId', 'name profilePhoto')
      .populate('store', 'name logo')
      .populate('pinnedProduct')
      .sort({ createdAt: -1 });
    
    res.json(streams);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Save a stream (idempotent - saving the same stream twice keeps it saved)
router.post('/:id/save', auth, async (req: AuthRequest, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) return res.status(404).json({ message: 'Stream not found' });

    const userId = req.user!._id;

    const existing = await SavedStream.findOne({ user: userId, stream: stream._id });
    if (existing) {
      return res.json({ saved: true });
    }

    await SavedStream.create({ user: userId, stream: stream._id });
    return res.status(201).json({ saved: true });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.json({ saved: true });
    }
    return res.status(500).json({ message: error.message });
  }
});

// Get current user's saved streams
router.get('/saved', auth, async (req: AuthRequest, res) => {
  try {
    const saved = await SavedStream.find({ user: req.user!._id })
      .sort({ createdAt: -1 })
      .lean();

    const streamIds = saved.map((s) => s.stream);
    const streams = await Stream.find({ _id: { $in: streamIds } })
      .populate('broadcasterId', 'name profilePhoto')
      .populate('store', 'name logo')
      .populate('pinnedProduct')
      .sort({ createdAt: -1 });

    res.json(streams);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get stream by ID
router.get('/:id', async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id)
      .populate('broadcasterId', 'name profilePhoto')
      .populate('store', 'name logo')
      .populate('pinnedProduct');
    
    if (!stream) return res.status(404).json({ message: 'Stream not found' });
    
    // Update viewer count if live
    if (stream.status === 'live') {
      const viewerCount = webrtcStreamingService.getViewerCount(stream._id.toString());
      if (viewerCount !== stream.viewerCount) {
        stream.viewerCount = viewerCount;
        await stream.save();
      }
    }
    
    res.json(stream);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Start a stream (create WebRTC room)
router.post('/:id/start', auth, async (req: AuthRequest, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) return res.status(404).json({ message: 'Stream not found' });
    
    if (stream.broadcasterId?.toString() !== req.user!._id.toString()) {
      return res.status(403).json({ message: 'Only the broadcaster can start the stream' });
    }
    
    if (stream.status === 'live') {
      return res.status(400).json({ message: 'Stream is already live' });
    }
    
    // Create WebRTC streaming room
    webrtcStreamingService.createRoom(stream._id.toString(), req.user!._id.toString());
    
    // Update stream
    stream.status = 'live';
    stream.startTime = new Date();
    await stream.save();
    
    res.json({ 
      stream,
      roomId: stream._id.toString(),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Stop a stream
router.post('/:id/stop', auth, async (req: AuthRequest, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) return res.status(404).json({ message: 'Stream not found' });
    
    if (stream.broadcasterId?.toString() !== req.user!._id.toString()) {
      return res.status(403).json({ message: 'Only the broadcaster can stop the stream' });
    }
    
    if (stream.status !== 'live') {
      return res.status(400).json({ message: 'Stream is not live' });
    }
    
    // Close WebRTC streaming room
    webrtcStreamingService.closeRoom(stream._id.toString());
    
    // Update stream
    stream.status = 'ended';
    await stream.save();
    
    res.json(stream);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Update stream status
router.patch('/:id/status', auth, async (req: AuthRequest, res) => {
  try {
    const { status, pinnedProduct } = req.body;
    const store = await Store.findOne({ owner: req.user!._id });
    if (!store) return res.status(400).json({ message: 'Create a store first' });
    
    const stream = await Stream.findOneAndUpdate(
      { _id: req.params.id, store: store._id },
      { status, pinnedProduct },
      { new: true }
    );
    
    if (!stream) return res.status(404).json({ message: 'Stream not found' });
    
    res.json(stream);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// WebRTC doesn't need RTP capabilities endpoint - removed

export default router;

