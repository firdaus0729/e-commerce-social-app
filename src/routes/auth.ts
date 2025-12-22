import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { env } from '../config/env';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

const signToken = (userId: string) => 
  jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Email, password, and name are required' });
  }
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }
  const hashed = await bcrypt.hash(password, 10);
  // Special-case admin registration by fixed credentials
  const role = email === 'admin@bisht.com' && password === 'sandeep1995' ? 'admin' : 'user';
  const user = await User.create({ email, password: hashed, name, role });
  const token = signToken(user._id.toString());
  res.status(201).json({
    token,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      store: user.store?.toString(),
      profilePhoto: user.profilePhoto,
      bio: user.bio,
    },
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Special handling for admin credentials: allow login without prior registration
  if (email === 'admin@bisht.com' && password === 'sandeep1995') {
    let user = await User.findOne({ email });
    // If admin user doesn't exist, create it
    if (!user) {
      const hashed = await bcrypt.hash(password, 10);
      user = await User.create({
        email,
        password: hashed,
        name: 'Admin',
        role: 'admin',
      });
    } else {
      // Ensure existing admin user has admin role
      if (user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
      }
    }
    const token = signToken(user._id.toString());
    return res.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        store: user.store?.toString(),
        profilePhoto: user.profilePhoto,
        bio: user.bio,
      },
    });
  }
  
  // Regular login flow for non-admin users
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = signToken(user._id.toString());
  res.json({
    token,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      store: user.store?.toString(),
      profilePhoto: user.profilePhoto,
      bio: user.bio,
    },
  });
});

router.get('/me', auth, async (req: AuthRequest, res) => {
  const user = req.user!;
  res.json({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    store: user.store?.toString(),
    profilePhoto: user.profilePhoto,
    bio: user.bio,
  });
});

router.put('/change-password', auth, async (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = req.user!;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Old password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  // Verify old password
  const ok = await bcrypt.compare(oldPassword, user.password);
  if (!ok) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  // Hash new password and update
  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  await user.save();

  res.json({ message: 'Password changed successfully' });
});

export default router;

