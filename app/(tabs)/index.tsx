import { useEffect, useState, useRef } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
// Using expo-av for now (will migrate to expo-audio in future SDK)
import { Audio } from 'expo-av';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { ChatMenu } from '@/components/chat-menu';
import { EmojiPicker } from '@/components/emoji-picker';
import { GifPicker } from '@/components/gif-picker';
import { VideoCall } from '@/components/video-call';
import { AudioCall } from '@/components/audio-call';
import { CallInitiationModal } from '@/components/call-initiation-modal';
import { api } from '@/lib/api';
import { Post, Message, PostComment, MessageType } from '@/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { brandYellow } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { MaterialIcons } from '@expo/vector-icons';

type PostChatUser = {
  user: {
    _id: string;
    name: string;
    profilePhoto?: string;
  };
  lastMessage?: Message;
  unreadCount: number;
};

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedPostOwner, setSelectedPostOwner] = useState<{ _id: string; name: string; profilePhoto?: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [messageText, setMessageText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [postOwnerChats, setPostOwnerChats] = useState<PostChatUser[]>([]);
  const [showPostOwnerChatList, setShowPostOwnerChatList] = useState(false);
  const [selectedChatUser, setSelectedChatUser] = useState<{ _id: string; name: string; profilePhoto?: string } | null>(null);
  const [isPostOwnerChatMode, setIsPostOwnerChatMode] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showAudioCall, setShowAudioCall] = useState(false);
  const [showCallInitiation, setShowCallInitiation] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [followers, setFollowers] = useState<{ _id: string; name: string; profilePhoto?: string }[]>([]);
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});

  // Admin users are redirected to the dedicated admin page
  useEffect(() => {
    if (user?.role === 'admin') {
      router.replace('/admin' as any);
    }
  }, [user?.role, router]);

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await api.get<Post[]>('/posts/feed', user?.token);
      setPosts(data);
      // Initialize saved state for posts from backend
      if (user?.token) {
        try {
          const saved = await api.get<Post[]>('/posts/saved', user.token);
          const map: Record<string, boolean> = {};
          saved.forEach((post) => {
            map[post._id] = true;
          });
          setSavedPosts(map);
    } catch (err) {
          console.log('Failed to load saved posts:', err);
        }
      }
      // Load unread counts for all posts
      if (user?.token) {
        await loadUnreadCounts(data);
        await loadFollowers();
      }
    } catch (err) {
      console.log('Failed to load posts:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const loadUnreadCounts = async (postsData: Post[]) => {
    if (!user?.token) return;
    const counts: Record<string, number> = {};
    for (const post of postsData) {
      const postOwnerId = (post.user as any)._id?.toString() || (post.user as any).toString();
      if (postOwnerId === user.id) {
        // For post owner, get total unread chats for this post
        try {
          const result = await api.get<{ totalUnread: number }>(`/messages/post/${post._id}/users`, user.token);
          counts[post._id] = result.totalUnread;
        } catch (err) {
          console.log('Failed to load unread count for post:', err);
        }
      } else {
        // For regular user, get unread messages from post owner for this post
        try {
          const result = await api.get<{ unreadCount: number }>(`/messages/unread/${post._id}/${postOwnerId}`, user.token);
          counts[post._id] = result.unreadCount;
        } catch (err) {
          console.log('Failed to load unread count:', err);
        }
      }
    }
    setUnreadCounts(counts);
  };

  useEffect(() => {
    load();
  }, [user?.token]);

  // Track view when post is displayed
  const trackView = async (postId: string) => {
    if (!user?.token) return;
    try {
      await api.post(`/posts/${postId}/view`, {}, user.token);
    } catch (err) {
      console.log('Failed to track view:', err);
    }
  };

  const loadFollowers = async () => {
    if (!user?.token) return;
    try {
      const followersData = await api.get<{ _id: string; name: string; profilePhoto?: string }[]>('/users/me/followers', user.token);
      setFollowers(followersData);
    } catch (err) {
      console.log('Failed to load followers:', err);
    }
  };

  const renderFollowersFlow = () => {
    if (!user || followers.length === 0) return null;
    return (
      <View style={styles.followersFlowContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.followersFlowScroll}>
          {followers.map((follower) => (
            <Pressable key={follower._id} style={styles.followersFlowItem}>
              <View style={styles.followersFlowAvatar}>
                {follower.profilePhoto ? (
                  <Image source={{ uri: follower.profilePhoto }} style={styles.followersFlowAvatarImage} />
                ) : (
                  <View style={styles.followersFlowAvatarPlaceholder}>
                    <ThemedText style={styles.followersFlowAvatarText}>
                      {follower.name.charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                )}
              </View>
              <ThemedText style={styles.followersFlowName} numberOfLines={1}>
                {follower.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderStories = () => (
    <View style={styles.storiesContainer}>
      <View style={styles.storiesHeader}>
        <ThemedText style={styles.storiesTitle}>Stories</ThemedText>
        <Pressable>
          <View style={styles.sortRow}>
            <ThemedText style={styles.sortText}>Sort by Time</ThemedText>
            <IconSymbol name="chevron.down" size={12} color="#666" />
          </View>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storiesScroll}>
        <Pressable style={styles.storyCircle}>
          <View style={[styles.storyCircleInner, styles.addStory]}>
            <IconSymbol name="plus" size={20} color="#1A1A1A" />
          </View>
        </Pressable>
        {followers.map((follower) => (
          <Pressable key={follower._id} style={styles.storyCircle}>
            <View style={styles.storyCircleInner}>
              {follower.profilePhoto ? (
                <Image source={{ uri: follower.profilePhoto }} style={styles.storyAvatarImage} />
              ) : (
                <View style={styles.storyAvatar}>
                  <ThemedText style={styles.storyAvatarText}>
                    {follower.name.charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const formatTimeSinceView = (viewDate: Date, postDate: Date): string => {
    const diffInSeconds = Math.floor((viewDate.getTime() - postDate.getTime()) / 1000);
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const openComments = async (post: Post) => {
    setSelectedPost(post);
    setShowCommentModal(true);
    await loadComments(post._id);
  };

  const loadComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const data = await api.get<PostComment[]>(`/posts/${postId}/comments`);
      setComments(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const addComment = async () => {
    if (!user?.token || !selectedPost || !commentText.trim()) return;
    setSendingComment(true);
    try {
      const newComment = await api.post<PostComment>(
        `/posts/${selectedPost._id}/comments`,
        { text: commentText.trim() },
        user.token
      );
      setComments([...comments, newComment]);
      setCommentText('');
      // Refresh posts to update comment count
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add comment');
    } finally {
      setSendingComment(false);
    }
  };

  const openChat = async (post: Post) => {
    if (!user?.token) {
      Alert.alert('Login required', 'Please log in to chat');
      return;
    }
    const postOwnerId = ((post.user as any)._id?.toString() || (post.user as any).toString());
    const isPostOwner = user.id === postOwnerId;

    setSelectedPost(post);

    if (isPostOwner) {
      // Post owner - show chat list for this post
      setIsPostOwnerChatMode(true);
      setShowPostOwnerChatList(true);
      await loadPostOwnerChats(post._id);
    } else {
      // Regular user - open 1:1 chat with post owner for this post
      setIsPostOwnerChatMode(false);
      const postUser = post.user as any;
      setSelectedPostOwner({ _id: postOwnerId, name: postUser?.name || 'Unknown', profilePhoto: postUser?.profilePhoto });
      setShowChatModal(true);
      await loadMessages(post._id, postOwnerId);
    }
  };

  const loadPostOwnerChats = async (postId: string) => {
    if (!user?.token) return;
    try {
      const result = await api.get<{ totalUnread: number; users: PostChatUser[] }>(`/messages/post/${postId}/users`, user.token);
      setPostOwnerChats(result.users);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load chats');
    }
  };

  const openChatWithUser = async (chatUser: { _id: string; name: string; profilePhoto?: string }) => {
    if (!selectedPost) return;
    setSelectedChatUser(chatUser);
    setSelectedPostOwner(null);
    setShowPostOwnerChatList(false);
    setShowChatModal(true);
    await loadMessages(selectedPost._id, chatUser._id);
  };

  const loadMessages = async (postId: string, userId: string) => {
    if (!user?.token) return;
    setLoadingMessages(true);
    try {
      const data = await api.get<Message[]>(`/messages/conversation/${postId}/${userId}`, user.token);
      setMessages(data);
      // Refresh unread counts
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (type: MessageType = 'text', mediaUrl?: string, fileName?: string, fileSize?: number, duration?: number, text?: string) => {
    if (!user?.token || !selectedPost) return;
    const receiverId = selectedPostOwner?._id || selectedChatUser?._id;
    if (!receiverId) return;
    const messageContent = text || messageText.trim();
    if (type === 'text' && !messageContent) return;

    setSendingMessage(true);
    try {
      const newMessage = await api.post<Message>(
        '/messages',
        {
          receiverId,
          postId: selectedPost._id,
          type,
          text: type === 'text' ? messageContent : (messageContent || ''),
          mediaUrl,
          fileName,
          fileSize,
          duration,
        },
        user.token
      );
      setMessages([...messages, newMessage]);
      setMessageText('');
      load();
      if (showPostOwnerChatList) {
        await loadPostOwnerChats(selectedPost._id);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const pickImage = async () => {
    setShowChatMenu(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0] && user?.token && selectedPost) {
      try {
        setSendingMessage(true);
        const formData = new FormData();
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('image', { uri, name: filename, type } as any);
        const uploadResult = await api.upload<{ url: string; filename: string; size: number }>('/upload/image', formData, user.token);
        await sendMessage('image', uploadResult.url, filename, uploadResult.size);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to upload image');
      } finally {
        setSendingMessage(false);
      }
    }
  };

  const pickVideo = async () => {
    setShowChatMenu(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0] && user?.token && selectedPost) {
      try {
        setSendingMessage(true);
        const formData = new FormData();
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop() || 'video.mp4';
        const duration = result.assets[0].duration || 0;
        formData.append('video', { uri, name: filename, type: 'video/mp4' } as any);
        const uploadResult = await api.upload<{ url: string; filename: string; size: number }>('/upload/video', formData, user.token);
        await sendMessage('video', uploadResult.url, filename, uploadResult.size, Math.round(duration / 1000));
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to upload video');
      } finally {
        setSendingMessage(false);
      }
    }
  };

  const pickFile = async () => {
    setShowChatMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets[0] && user?.token && selectedPost) {
        setSendingMessage(true);
        try {
          const formData = new FormData();
          const uri = result.assets[0].uri;
          const filename = result.assets[0].name;
          const fileSize = result.assets[0].size || 0;
          formData.append('file', { uri, name: filename, type: result.assets[0].mimeType || 'application/octet-stream' } as any);
          const uploadResult = await api.upload<{ url: string; filename: string; size: number }>('/upload/file', formData, user.token);
          await sendMessage('file', uploadResult.url, filename, uploadResult.size);
        } catch (err: any) {
          Alert.alert('Error', err.message || 'Failed to upload file');
        } finally {
          setSendingMessage(false);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to pick file');
    }
  };

  const startRecording = async () => {
    setShowChatMenu(false);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone permissions');
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((prev) => prev + 1), 1000);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    try {
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (!uri || !user?.token || !selectedPost) {
        recordingRef.current = null;
        return;
      }
      
      setSendingMessage(true);
      try {
        const formData = new FormData();
        const filename = `audio_${Date.now()}.m4a`;
        formData.append('audio', { uri, name: filename, type: 'audio/m4a' } as any);
        const uploadResult = await api.upload<{ url: string; filename: string; size: number }>('/upload/audio', formData, user.token);
        await sendMessage('audio', uploadResult.url, filename, uploadResult.size, recordingDuration);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to upload audio');
      } finally {
        setSendingMessage(false);
      }
      
      recordingRef.current = null;
      setRecordingDuration(0);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to stop recording');
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
    }
  };

  const cancelRecording = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (err) {
        // Ignore
      }
    }
    recordingRef.current = null;
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const insertEmoji = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    setShowChatMenu(false);
  };

  const selectGif = async (gifUrl: string) => {
    setShowGifPicker(false);
    setShowChatMenu(false);
    if (!user?.token || !selectedPost) return;
    const receiverId = selectedPostOwner?._id || selectedChatUser?._id;
    if (!receiverId) return;
    setSendingMessage(true);
    try {
      await sendMessage('gif', gifUrl);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send GIF');
    } finally {
      setSendingMessage(false);
    }
  };

  const openCallInitiation = () => {
    if (!selectedPost) return;
    const receiverId = selectedPostOwner?._id || selectedChatUser?._id;
    const receiverName = selectedPostOwner?.name || selectedChatUser?.name;
    if (!receiverId || !receiverName) return;
    setShowCallInitiation(true);
  };

  const handleStartVideo = () => {
    setShowCallInitiation(false);
    setShowVideoCall(true);
  };

  const handleStartAudio = () => {
    setShowCallInitiation(false);
    setShowAudioCall(true);
  };

  const renderPost = ({ item }: { item: Post }) => {
    const postUser = item.user as any;
    const userName = postUser?.name || 'Unknown User';
    const userPhoto = postUser?.profilePhoto;
    const postOwnerId = postUser?._id?.toString() || postUser?.toString();
    const isPostOwner = user?.id === postOwnerId;
    const isLiked = user?.token && item.likes?.some((id: any) => id.toString() === user.id);
    const unreadCount = unreadCounts[item._id] || 0;
    const isSaved = !!savedPosts[item._id];

    return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postUser}>
            {userPhoto ? (
              <Image source={{ uri: userPhoto }} style={styles.postAvatar} />
            ) : (
          <View style={styles.postAvatar} />
            )}
          <View>
              <ThemedText style={styles.postName}>{isPostOwner ? 'Me' : userName}</ThemedText>
              <ThemedText style={styles.postTime}>{formatTimeAgo(item.createdAt)}</ThemedText>
          </View>
        </View>
          <Pressable
            style={[
              styles.postSaveTopButton,
              (isPostOwner || isSaved) && styles.postSaveTopButtonDisabled,
            ]}
            disabled={isPostOwner || isSaved}
            onPress={async () => {
              if (!user?.token || isPostOwner || isSaved) return;
              try {
                await api.post(`/posts/${item._id}/save`, {}, user.token);
                setSavedPosts((prev) => ({ ...prev, [item._id]: true }));
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Failed to save post');
              }
            }}
          >
            <ThemedText
              style={[
                styles.postSaveTopText,
                isSaved && styles.postSaveTopTextSaved,
                isPostOwner && styles.postSaveTopTextDisabled,
              ]}
            >
              {isSaved ? 'Saved' : 'Save'}
            </ThemedText>
        </Pressable>
      </View>

      {item.images && item.images[0] ? (
          <Image
            source={{ uri: item.images[0] }}
            style={styles.postImage}
            onLoad={() => trackView(item._id)}
          />
      ) : (
        <View style={[styles.postImage, styles.postImagePlaceholder]}>
          <IconSymbol name="photo" size={40} color="#ccc" />
        </View>
      )}

      <View style={styles.postEngagement}>
        <Pressable
            style={[styles.engagementItem, isPostOwner && styles.engagementItemDisabled]}
          onPress={async () => {
              if (isPostOwner) return; // Disabled for post owner
            if (!user?.token) {
                Alert.alert('Login required', 'Please log in to like posts');
              return;
            }
            try {
                await api.post(`/posts/${item._id}/like`, {}, user.token);
                load();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }}
            disabled={isPostOwner}
        >
            <IconSymbol
              name={isLiked ? 'heart.fill' : 'heart'}
              size={20}
              color={isLiked ? '#EF4444' : isPostOwner ? '#ccc' : '#666'}
            />
            <ThemedText style={[styles.engagementText, isPostOwner && styles.engagementTextDisabled]}>
              {`${item.likesCount ?? item.likes?.length ?? 0} Likes`}
          </ThemedText>
        </Pressable>
          <Pressable
            style={styles.engagementItem}
            onPress={() => openComments(item)}
          >
          <IconSymbol name="bubble.left.fill" size={20} color="#666" />
          <ThemedText style={styles.engagementText}>
              {`Comment${item.commentsCount ? ` (${item.commentsCount})` : ''}`}
          </ThemedText>
        </Pressable>
          <Pressable
            style={styles.engagementItem}
            onPress={() => openChat(item)}
          >
            <IconSymbol name="paperplane.fill" size={20} color={brandYellow} />
            <View style={styles.chatButtonContainer}>
              <ThemedText style={styles.engagementText}>Chat</ThemedText>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <ThemedText style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </ThemedText>
                </View>
              )}
            </View>
          </Pressable>
      </View>

        {item.caption && (
          <ThemedText style={styles.postCaption}>
            <ThemedText style={styles.postCaptionBold}>{isPostOwner ? 'Me' : userName}{' '}</ThemedText>
            {item.caption}
          </ThemedText>
        )}
        {item.likesCount && item.likesCount > 0 && (
      <ThemedText style={styles.postLikes}>
            {`${item.likesCount} ${item.likesCount === 1 ? 'like' : 'likes'}`}
      </ThemedText>
        )}
    </View>
  );
  };

  return (
    <ThemedView style={styles.container}>
      <Header showSearch showNotifications showMessages />
      <FlatList
        ListHeaderComponent={
          <View>
            {renderStories()}
          </View>
        }
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderPost}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>No posts yet</ThemedText>
            {user?.token && (
              <Pressable
                style={styles.createPostButton}
                onPress={() => router.push('/(tabs)/profile')}
              >
                <ThemedText style={styles.createPostButtonText}>Create your first post</ThemedText>
              </Pressable>
            )}
          </View>
        }
      />

      {/* Comments Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowCommentModal(false);
          setSelectedPost(null);
          setComments([]);
          setCommentText('');
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => {
                setShowCommentModal(false);
                setSelectedPost(null);
                setComments([]);
                setCommentText('');
              }}
            >
              <IconSymbol name="chevron.left" size={24} color="#1A1A1A" />
            </Pressable>
            <ThemedText style={styles.modalTitle}>Comments</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.commentsList} contentContainerStyle={styles.commentsListContent}>
            {loadingComments ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={brandYellow} />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <ThemedText style={styles.emptyCommentsText}>No comments yet</ThemedText>
              </View>
            ) : (
              comments.map((comment) => {
                const commentUser = comment.user as any;
                const commentDate = new Date(comment.createdAt);
                const postDate = selectedPost ? new Date(selectedPost.createdAt) : commentDate;
                return (
                  <View key={comment._id} style={styles.commentItem}>
                    {commentUser?.profilePhoto ? (
                      <Image source={{ uri: commentUser.profilePhoto }} style={styles.commentAvatar} />
                    ) : (
                      <View style={styles.commentAvatar} />
                    )}
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <ThemedText style={styles.commentName}>{commentUser?.name || 'Unknown'}</ThemedText>
                        <ThemedText style={styles.commentTime}>{formatTimeSinceView(commentDate, postDate)}</ThemedText>
                      </View>
                      <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {selectedPost && user?.id !== ((selectedPost.user as any)._id?.toString() || (selectedPost.user as any).toString()) && (
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <Pressable
                style={[styles.commentSendButton, (!commentText.trim() || sendingComment) && styles.commentSendButtonDisabled]}
                onPress={addComment}
                disabled={!commentText.trim() || sendingComment}
              >
                {sendingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <IconSymbol name="plus" size={20} color="#fff" />
                )}
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Post Owner Chat List Modal (WhatsApp style) */}
      <Modal
        visible={showPostOwnerChatList}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowPostOwnerChatList(false);
          setSelectedPost(null);
          setPostOwnerChats([]);
          setIsPostOwnerChatMode(false);
        }}
      >
        <View style={styles.chatListContainer}>
          <View style={styles.chatListHeader}>
            <Pressable
              onPress={() => {
                setShowPostOwnerChatList(false);
                setSelectedPost(null);
                setPostOwnerChats([]);
                setIsPostOwnerChatMode(false);
              }}
            >
              <IconSymbol name="chevron.left" size={24} color="#1A1A1A" />
            </Pressable>
            <ThemedText style={styles.chatListTitle}>Chats</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.chatListScroll}>
            {postOwnerChats.length === 0 ? (
              <View style={styles.emptyChatList}>
                <ThemedText style={styles.emptyChatListText}>No chats yet</ThemedText>
              </View>
            ) : (
              postOwnerChats.map((chatUser) => (
                <Pressable
                  key={chatUser.user._id}
                  style={styles.chatListItem}
                  onPress={() => openChatWithUser(chatUser.user)}
                >
                  {chatUser.user.profilePhoto ? (
                    <Image source={{ uri: chatUser.user.profilePhoto }} style={styles.chatListAvatar} />
                  ) : (
                    <View style={styles.chatListAvatar} />
                  )}
                  <View style={styles.chatListItemContent}>
                    <View style={styles.chatListItemHeader}>
                      <ThemedText style={styles.chatListItemName}>{chatUser.user.name}</ThemedText>
                      {chatUser.lastMessage && (
                        <ThemedText style={styles.chatListItemTime}>
                          {new Date(chatUser.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                      )}
                    </View>
                    {chatUser.lastMessage && (
                      <ThemedText style={styles.chatListItemPreview} numberOfLines={1}>
                        {chatUser.lastMessage.text}
                      </ThemedText>
                    )}
                  </View>
                  {chatUser.unreadCount > 0 && (
                    <View style={styles.chatListUnreadBadge}>
                      <ThemedText style={styles.chatListUnreadBadgeText}>
                        {chatUser.unreadCount > 99 ? '99+' : String(chatUser.unreadCount)}
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Chat Modal (1:1) */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => {
          if (isPostOwnerChatMode && selectedChatUser) {
            setShowChatModal(false);
            setShowPostOwnerChatList(true);
            setSelectedChatUser(null);
          } else {
            setShowChatModal(false);
            setSelectedPostOwner(null);
            setSelectedChatUser(null);
            setIsPostOwnerChatMode(false);
          }
          setMessages([]);
          setMessageText('');
        }}
      >
        <View style={styles.chatContainer}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <View style={styles.chatHeader}>
            <Pressable
              onPress={() => {
                if (isPostOwnerChatMode && selectedChatUser) {
                  // Post owner - go back to chat list
                  setShowChatModal(false);
                  setShowPostOwnerChatList(true);
                  setSelectedChatUser(null);
                } else {
                  // Regular user or closing - close chat
                  setShowChatModal(false);
                  setSelectedPostOwner(null);
                  setSelectedChatUser(null);
                  setIsPostOwnerChatMode(false);
                }
                setMessages([]);
                setMessageText('');
              }}
            >
              <IconSymbol name="chevron.left" size={24} color="#1A1A1A" />
            </Pressable>
            {(selectedPostOwner || selectedChatUser) && (
              <View style={styles.chatHeaderUser}>
                {(selectedPostOwner?.profilePhoto || selectedChatUser?.profilePhoto) ? (
                  <Image
                    source={{ uri: selectedPostOwner?.profilePhoto || selectedChatUser?.profilePhoto }}
                    style={styles.chatHeaderAvatar}
                  />
                ) : (
                  <View style={styles.chatHeaderAvatar} />
                )}
                <View style={styles.chatHeaderUserInfo}>
                  <ThemedText style={styles.chatHeaderName}>
                    {selectedPostOwner?.name || selectedChatUser?.name}
                  </ThemedText>
                  {messages.length > 0 && (
                    <ThemedText style={styles.chatHeaderTime}>
                      {formatTimeAgo(messages[messages.length - 1].createdAt)}
                    </ThemedText>
                  )}
                </View>
              </View>
            )}
            {(selectedPostOwner || selectedChatUser) && (
              <Pressable onPress={openCallInitiation} style={styles.chatHeaderPhoneButton}>
                <MaterialIcons name="phone" size={24} color="#1A1A1A" />
              </Pressable>
            )}
          </View>

          <ScrollView
            style={styles.chatMessages}
            contentContainerStyle={styles.chatMessagesContent}
            ref={(ref) => {
              if (ref && messages.length > 0) {
                setTimeout(() => ref.scrollToEnd({ animated: true }), 100);
              }
            }}
          >
            {loadingMessages ? (
              <View style={styles.chatLoading}>
                <ActivityIndicator size="large" color={brandYellow} />
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.chatEmpty}>
                <ThemedText style={styles.chatEmptyText}>No messages yet. Start the conversation!</ThemedText>
              </View>
            ) : (
              messages.map((msg) => {
                const isSent = msg.sender._id === user?.id;
                const senderAvatar = isSent ? user?.profilePhoto : msg.sender.profilePhoto;
                return (
                  <View key={msg._id} style={[styles.chatMessageWrapper, isSent ? styles.chatMessageWrapperSent : styles.chatMessageWrapperReceived]}>
                    {!isSent && (
                      senderAvatar ? (
                        <Image
                          source={{ uri: senderAvatar }}
                          style={styles.chatMessageAvatar}
                        />
                      ) : (
                        <View style={styles.chatMessageAvatar} />
                      )
                    )}
                    <Pressable
                      style={[styles.chatMessage, isSent ? styles.chatMessageSent : styles.chatMessageReceived]}
                      onLongPress={() => {
                        if (isSent) {
                          Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                if (!user?.token) return;
                                try {
                                  await api.delete(`/messages/${msg._id}`, user.token);
                                  setMessages((prev) => prev.filter((m) => m._id !== msg._id));
                                } catch (err: any) {
                                  Alert.alert('Error', err.message || 'Failed to delete message');
                                }
                              },
                            },
                          ]);
                        }
                      }}
                    >
                      {msg.type === 'image' && msg.mediaUrl ? (
                        <Image source={{ uri: msg.mediaUrl }} style={styles.chatMediaImage} />
                      ) : msg.type === 'video' && msg.mediaUrl ? (
                        <View style={styles.chatMediaVideo}>
                          <Image source={{ uri: msg.mediaUrl }} style={styles.chatMediaVideoThumb} />
                          <MaterialIcons name="play-circle-filled" size={48} color="#fff" style={styles.playIcon} />
                        </View>
                      ) : msg.type === 'audio' && msg.mediaUrl ? (
                        <View style={styles.chatAudioContainer}>
                          <MaterialIcons name="audiotrack" size={24} color={isSent ? '#1A1A1A' : '#666'} />
                          <View style={styles.chatAudioInfo}>
                            <ThemedText style={[styles.chatAudioText, isSent && styles.chatMessageTextSent]}>
                              Audio Message
                            </ThemedText>
                            <ThemedText style={[styles.chatAudioDuration, isSent && styles.chatMessageTimeSent]}>
                              {msg.duration ? `${Math.floor(msg.duration / 60)}:${String(msg.duration % 60).padStart(2, '0')}` : '0:00'}
                            </ThemedText>
                          </View>
                        </View>
                      ) : msg.type === 'file' && msg.mediaUrl ? (
                        <View style={styles.chatFileContainer}>
                          <MaterialIcons name="insert-drive-file" size={32} color={isSent ? '#1A1A1A' : '#666'} />
                          <View style={styles.chatFileInfo}>
                            <ThemedText style={[styles.chatFileText, isSent && styles.chatMessageTextSent]} numberOfLines={1}>
                              {msg.fileName || 'File'}
                            </ThemedText>
                            {msg.fileSize && (
                              <ThemedText style={[styles.chatFileSize, isSent && styles.chatMessageTimeSent]}>
                                {(msg.fileSize / 1024).toFixed(1)} KB
                              </ThemedText>
                            )}
                          </View>
                        </View>
                      ) : msg.type === 'gif' && msg.mediaUrl ? (
                        <Image source={{ uri: msg.mediaUrl }} style={styles.chatGifImage} />
                      ) : null}
                      {msg.text && (
                        <ThemedText style={[styles.chatMessageText, isSent && styles.chatMessageTextSent]}>
                          {msg.text}
                        </ThemedText>
                      )}
                      <View style={styles.chatMessageFooter}>
                        <ThemedText style={[styles.chatMessageTime, isSent && styles.chatMessageTimeSent]}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                        {isSent && (
                          <View style={styles.messageTicks}>
                            {msg.read ? (
                              <MaterialIcons name="done-all" size={14} color="#4CAF50" />
                            ) : msg.delivered ? (
                              <MaterialIcons name="done-all" size={14} color="#999" />
                            ) : (
                              <MaterialIcons name="done" size={14} color="#999" />
                            )}
                          </View>
                        )}
                      </View>
                    </Pressable>
                    {isSent && (
                      senderAvatar ? (
                        <Image
                          source={{ uri: senderAvatar }}
                          style={styles.chatMessageAvatar}
                        />
                      ) : (
                        <View style={styles.chatMessageAvatar} />
                      )
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {isRecording ? (
            <View style={styles.recordingContainer}>
              <Pressable onPress={cancelRecording} style={styles.recordingCancelButton}>
                <MaterialIcons name="close" size={24} color="#EF4444" />
              </Pressable>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <ThemedText style={styles.recordingText}>
                  {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                </ThemedText>
              </View>
              <Pressable onPress={stopRecording} style={styles.recordingStopButton}>
                <MaterialIcons name="stop" size={24} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.chatInputContainer}>
              <Pressable
                style={styles.chatMenuButton}
                onPress={() => setShowChatMenu(!showChatMenu)}
              >
                <MaterialIcons name="add-circle" size={28} color={brandYellow} />
              </Pressable>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={500}
              />
              <Pressable
                style={styles.chatEmojiButton}
                onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <MaterialIcons name="mood" size={24} color="#666" />
              </Pressable>
              {messageText.trim() && (
                <Pressable
                  style={[styles.chatSendButton, sendingMessage && styles.chatSendButtonDisabled]}
                  onPress={() => sendMessage('text')}
                  disabled={sendingMessage}
                >
                  {sendingMessage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <IconSymbol name="paperplane.fill" size={20} color="#fff" />
                  )}
                </Pressable>
              )}
            </View>
          )}
          <ChatMenu
            visible={showChatMenu}
            onClose={() => setShowChatMenu(false)}
            onPickImage={pickImage}
            onPickVideo={pickVideo}
            onPickFile={pickFile}
            onShowGifs={() => {
              setShowChatMenu(false);
              setShowGifPicker(true);
            }}
          />
          <GifPicker
            visible={showGifPicker}
            onClose={() => setShowGifPicker(false)}
            onSelect={selectGif}
          />
          <EmojiPicker
            visible={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
            onSelect={insertEmoji}
          />
        </View>
      </Modal>

      {/* Call Initiation Modal */}
      {selectedPost && (selectedPostOwner || selectedChatUser) && (
        <CallInitiationModal
          visible={showCallInitiation}
          onClose={() => setShowCallInitiation(false)}
          onStartVideo={handleStartVideo}
          onStartAudio={handleStartAudio}
          userName={selectedPostOwner?.name || selectedChatUser?.name || 'User'}
          userAvatar={selectedPostOwner?.profilePhoto || selectedChatUser?.profilePhoto}
        />
      )}

      {/* Audio Call Modal */}
      {selectedPost && (selectedPostOwner || selectedChatUser) && (
        <AudioCall
          visible={showAudioCall}
          onClose={() => setShowAudioCall(false)}
          otherUserId={selectedPostOwner?._id || selectedChatUser?._id || ''}
          otherUserName={selectedPostOwner?.name || selectedChatUser?.name || 'User'}
          postId={selectedPost._id}
        />
      )}

      {/* Video Call Modal */}
      {selectedPost && (selectedPostOwner || selectedChatUser) && (
        <VideoCall
          visible={showVideoCall}
          onClose={() => setShowVideoCall(false)}
          otherUserId={selectedPostOwner?._id || selectedChatUser?._id || ''}
          otherUserName={selectedPostOwner?.name || selectedChatUser?.name || 'User'}
          postId={selectedPost._id}
        />
      )}
      </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  list: {
    paddingBottom: 20,
  },
  storiesContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  storiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  storiesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  sortText: {
    fontSize: 12,
    color: '#666',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storiesScroll: {
    paddingHorizontal: 16,
  },
  storyCircle: {
    marginRight: 12,
  },
  storyCircleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  addStory: {
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  storyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  storyAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
  },
  postCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  postUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  postName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  postTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  postImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#f0f0f0',
  },
  postImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  postSaveTopButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  postSaveTopButtonDisabled: {
    opacity: 0.6,
  },
  postSaveTopText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  postSaveTopTextSaved: {
    color: '#EF4444',
    fontWeight: '700',
  },
  postSaveTopTextDisabled: {
    color: '#ccc',
  },
  postEngagement: {
    flexDirection: 'row',
    gap: 20,
    padding: 12,
    alignItems: 'center',
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engagementItemDisabled: {
    opacity: 0.5,
  },
  engagementText: {
    fontSize: 14,
    color: '#666',
  },
  engagementTextDisabled: {
    color: '#ccc',
  },
  chatButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  postCaption: {
    fontSize: 14,
    color: '#1A1A1A',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  postCaptionBold: {
    fontWeight: '600',
  },
  postLikes: {
    fontSize: 12,
    color: '#666',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  createPostButton: {
    backgroundColor: brandYellow,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createPostButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  commentsList: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  commentsListContent: {
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyComments: {
    padding: 40,
    alignItems: 'center',
  },
  emptyCommentsText: {
    color: '#999',
    fontSize: 14,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    backgroundColor: '#f9f9f9',
  },
  commentSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  chatListContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
  },
  chatListTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  chatListScroll: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyChatList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyChatListText: {
    color: '#999',
    fontSize: 14,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  chatListAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  chatListItemContent: {
    flex: 1,
  },
  chatListItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatListItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  chatListItemTime: {
    fontSize: 12,
    color: '#999',
  },
  chatListItemPreview: {
    fontSize: 14,
    color: '#666',
  },
  chatListUnreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatListUnreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#fff',
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
  },
  chatHeaderUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginLeft: 12,
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  chatHeaderUserInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  chatHeaderTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  chatHeaderPhoneButton: {
    padding: 8,
    marginRight: -8,
  },
  chatMessages: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  chatMessagesContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 20,
  },
  chatLoading: {
    padding: 20,
    alignItems: 'center',
  },
  chatLoadingText: {
    color: '#666',
  },
  chatEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  chatEmptyText: {
    color: '#999',
    fontSize: 14,
  },
  chatMessageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 8,
    width: '100%',
  },
  chatMessageWrapperSent: {
    justifyContent: 'flex-end',
  },
  chatMessageWrapperReceived: {
    justifyContent: 'flex-start',
  },
  chatMessage: {
    maxWidth: '70%',
    width: '100%',
    padding: 12,
    borderRadius: 16,
  },
  chatMessageSent: {
    backgroundColor: brandYellow,
    borderBottomRightRadius: 4,
  },
  chatMessageReceived: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  chatMessageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  chatMessageText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  chatMessageTextSent: {
    color: '#1A1A1A',
  },
  chatMessageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  chatMessageTime: {
    fontSize: 10,
    color: '#999',
  },
  chatMessageTimeSent: {
    color: '#666',
  },
  messageTicks: {
    marginLeft: 2,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
    gap: 8,
    width: '100%',
    minHeight: 60,
    zIndex: 1000,
    elevation: 10,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 40,
    backgroundColor: '#f9f9f9',
    color: '#1A1A1A',
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  chatMenuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  chatEmojiButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  recordingCancelButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  recordingStopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMediaImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  chatMediaVideo: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  chatMediaVideoThumb: {
    width: '100%',
    height: '100%',
  },
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -24,
  },
  chatAudioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  chatAudioInfo: {
    flex: 1,
  },
  chatAudioText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  chatAudioDuration: {
    fontSize: 12,
    color: '#999',
  },
  chatFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  chatFileInfo: {
    flex: 1,
  },
  chatFileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  chatFileSize: {
    fontSize: 12,
    color: '#999',
  },
  chatGifImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  followersFlowContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  followersFlowScroll: {
    flexDirection: 'row',
  },
  followersFlowItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  followersFlowAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: brandYellow,
  },
  followersFlowAvatarImage: {
    width: '100%',
    height: '100%',
  },
  followersFlowAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followersFlowAvatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#666',
  },
  followersFlowName: {
    fontSize: 12,
    color: '#1A1A1A',
    textAlign: 'center',
    maxWidth: 70,
  },
});
