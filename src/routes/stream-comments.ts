import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { StreamComment } from '../models/StreamComment';
import { Stream } from '../models/Stream';

const router = Router();

// Get comments for a stream
router.get('/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;

    const comments = await StreamComment.find({ stream: streamId })
      .populate('user', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    res.json(comments);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create a comment
router.post('/:streamId', auth, async (req: AuthRequest, res) => {
  try {
    const { streamId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    // Verify stream exists
    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ message: 'Stream not found' });
    }

    const comment = await StreamComment.create({
      stream: streamId,
      user: req.user!._id,
      text: text.trim(),
    });

    const populatedComment = await StreamComment.findById(comment._id)
      .populate('user', 'name profilePhoto')
      .lean();

    res.status(201).json(populatedComment);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a comment
router.delete('/:commentId', auth, async (req: AuthRequest, res) => {
  try {
    const { commentId } = req.params;

    const comment = await StreamComment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Only allow deletion by comment owner or stream broadcaster
    const stream = await Stream.findById(comment.stream);
    const isOwner = comment.user.toString() === req.user!._id.toString();
    const isBroadcaster = stream?.broadcasterId?.toString() === req.user!._id.toString();

    if (!isOwner && !isBroadcaster) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await StreamComment.findByIdAndDelete(commentId);
    res.json({ message: 'Comment deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

