import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Post } from '../models/Post';

const router = Router();

// Get user profile with stats
router.get('/:userId', async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select('-password')
    .lean();
  if (!user) return res.status(404).json({ message: 'User not found' });

  const postsCount = await Post.countDocuments({ user: user._id });
  const followersCount = user.followers?.length || 0;
  const followingCount = user.following?.length || 0;

  res.json({
    ...user,
    postsCount,
    followersCount,
    followingCount,
  });
});

// Get current user stats
router.get('/me/stats', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!._id).lean();
  if (!user) return res.status(404).json({ message: 'User not found' });

  const postsCount = await Post.countDocuments({ user: req.user!._id });
  const followersCount = user.followers?.length || 0;
  const followingCount = user.following?.length || 0;

  res.json({
    postsCount,
    followersCount,
    followingCount,
  });
});

// Update user profile
router.patch('/me', auth, async (req: AuthRequest, res) => {
  const { name, bio, profilePhoto, paypalEmail } = req.body;
  const updateData: any = {};
  if (name) updateData.name = name;
  if (bio !== undefined) updateData.bio = bio;
  if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto;
  if (paypalEmail !== undefined) {
    // Validate PayPal email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (paypalEmail && !emailRegex.test(paypalEmail)) {
      return res.status(400).json({ 
        message: 'Invalid email format. Please enter a valid PayPal email address.',
        code: 'INVALID_FORMAT'
      });
    }
    updateData.paypalEmail = paypalEmail || null;
  }

  const user = await User.findByIdAndUpdate(
    req.user!._id,
    { $set: updateData },
    { new: true }
  ).select('-password');

  res.json({
    id: user!._id.toString(),
    email: user!.email,
    name: user!.name,
    role: user!.role,
    store: user!.store?.toString(),
    profilePhoto: user!.profilePhoto,
    bio: user!.bio,
    paypalEmail: user!.paypalEmail,
  });
});

// Update PayPal email specifically
router.patch('/me/paypal-email', auth, async (req: AuthRequest, res) => {
  const { paypalEmail } = req.body;
  
  if (!paypalEmail || !paypalEmail.includes('@')) {
    return res.status(400).json({ 
      message: 'Valid PayPal email is required',
      code: 'INVALID_EMAIL'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(paypalEmail)) {
    return res.status(400).json({ 
      message: 'Invalid email format. Please enter a valid PayPal email address.',
      code: 'INVALID_FORMAT'
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user!._id,
    { paypalEmail },
    { new: true }
  ).select('-password');

  res.json({ 
    message: 'PayPal email updated successfully',
    paypalEmail: user!.paypalEmail,
  });
});

// Follow a user
router.post('/:userId/follow', auth, async (req: AuthRequest, res) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user!._id.toString();

  if (targetUserId === currentUserId) {
    return res.status(400).json({ message: 'Cannot follow yourself' });
  }

  const targetUser = await User.findById(targetUserId);
  const currentUser = await User.findById(currentUserId);

  if (!targetUser || !currentUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Check if already following
  const isFollowing = currentUser.following.some(
    (id: any) => id.toString() === targetUserId
  );

  if (isFollowing) {
    // Unfollow
    currentUser.following = currentUser.following.filter(
      (id: any) => id.toString() !== targetUserId
    );
    targetUser.followers = targetUser.followers.filter(
      (id: any) => id.toString() !== currentUserId
    );
  } else {
    // Follow
    currentUser.following.push(targetUser._id);
    targetUser.followers.push(currentUser._id);
  }

  await currentUser.save();
  await targetUser.save();

  res.json({
    following: !isFollowing,
    followersCount: targetUser.followers.length,
    followingCount: currentUser.following.length,
  });
});

// Check if following a user
router.get('/:userId/following', auth, async (req: AuthRequest, res) => {
  const currentUser = await User.findById(req.user!._id);
  if (!currentUser) return res.status(404).json({ message: 'User not found' });

  const isFollowing = currentUser.following.some(
    (id: any) => id.toString() === req.params.userId
  );

  res.json({ following: isFollowing });
});

// Get all users (for follow suggestions)
router.get('/', auth, async (req: AuthRequest, res) => {
  const currentUserId = req.user!._id.toString();
  const limit = parseInt(req.query.limit as string) || 20;
  
  const users = await User.find({
    _id: { $ne: currentUserId },
    role: { $ne: 'admin' }, // Exclude admin users
  })
    .select('name profilePhoto email')
    .limit(limit)
    .lean();

  res.json(users);
});

// Get followers of current user
router.get('/me/followers', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!._id)
    .populate('followers', 'name profilePhoto')
    .lean();
  
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json(user.followers || []);
});

// Get following list of current user
router.get('/me/following', auth, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!._id)
    .populate('following', 'name profilePhoto')
    .lean();
  
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json(user.following || []);
});

export default router;

