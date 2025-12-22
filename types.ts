export type Role = 'user' | 'seller' | 'admin';

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  store?: string;
  token?: string;
  profilePhoto?: string;
  bio?: string;
  paypalEmail?: string;
};

export type Store = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  owner?: string;
};

export type Product = {
  _id: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  images?: string[];
  stock?: number;
  visits?: number;
  commentsCount?: number;
  likes?: number;
  dislikes?: number;
  averageRating?: number;
  reviewCount?: number;
  store?: string;
};

export type Review = {
  _id: string;
  product: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  rating: number;
  comment?: string;
  createdAt: string;
};

export type Stream = {
  _id: string;
  title: string;
  playbackUrl?: string;
  status: 'scheduled' | 'live' | 'ended';
  roomId?: string;
  broadcasterId?: {
    _id: string;
    name: string;
    profilePhoto?: string;
  };
  store?: {
    _id: string;
    name: string;
    logo?: string;
  };
  pinnedProduct?: Product;
  viewerCount?: number;
  startTime?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type Cart = {
  _id: string;
  items: CartItem[];
  currency: string;
};

export type AdminUserSummary = {
  id: string;
  name: string;
  email?: string;
  profilePhoto?: string;
};

export type AdminProductSummary = {
  id: string;
  title: string;
  price: number;
  image: string | null;
  seller: AdminUserSummary | null;
  buyers: AdminUserSummary[];
};

export type AdminTransaction = {
  id: string;
  total: number;
  currency: string;
  paymentProvider?: 'stripe' | 'paypal';
  createdAt: string;
  seller: AdminUserSummary | null;
  buyer: AdminUserSummary | null;
};

export type Post = {
  _id: string;
  user: {
    _id: string;
    name: string;
    profilePhoto?: string;
  };
  images: string[];
  caption?: string;
  views: string[];
  likes: string[];
  likesCount?: number;
  viewsCount?: number;
  commentsCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type PostComment = {
  _id: string;
  post: string;
  user: {
    _id: string;
    name: string;
    profilePhoto?: string;
  };
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type UserStats = {
  postsCount: number;
  followersCount: number;
  followingCount: number;
};

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'gif';

export type Message = {
  _id: string;
  sender: {
    _id: string;
    name: string;
    profilePhoto?: string;
  };
  receiver: {
    _id: string;
    name: string;
    profilePhoto?: string;
  };
  post: string | {
    _id: string;
  };
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  delivered: boolean;
  read: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StreamComment = {
  _id: string;
  stream: string;
  user: {
    _id: string;
    name: string;
    profilePhoto?: string;
  };
  text: string;
  createdAt: string;
  updatedAt: string;
};

