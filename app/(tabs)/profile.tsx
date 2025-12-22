import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { useAuth } from '@/hooks/use-auth';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { brandYellow } from '@/constants/theme';
import { api } from '@/lib/api';
import { Post, Stream, UserStats } from '@/types';
import { API_URL } from '@/constants/config';
import { Video } from 'expo-av';

type TabType = 'posts' | 'saved';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [stats, setStats] = useState<UserStats>({ postsCount: 0, followersCount: 0, followingCount: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedStreams, setSavedStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postImageUri, setPostImageUri] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState('');
  const [uploadingPost, setUploadingPost] = useState(false);
  const [localProfilePhoto, setLocalProfilePhoto] = useState<string | undefined>(user?.profilePhoto);
  const [suggestedUsers, setSuggestedUsers] = useState<{ _id: string; name: string; profilePhoto?: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState(user?.paypalEmail || '');
  const [updatingPayPal, setUpdatingPayPal] = useState(false);

  useEffect(() => {
    if (user?.token) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  useEffect(() => {
    setLocalProfilePhoto(user?.profilePhoto);
  }, [user?.profilePhoto]);

  useEffect(() => {
    setPaypalEmail(user?.paypalEmail || '');
  }, [user?.paypalEmail]);

  const handleUpdatePayPalEmail = async () => {
    if (!user?.token) return;
    
    if (!paypalEmail || !paypalEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid PayPal email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(paypalEmail)) {
      Alert.alert('Invalid Format', 'Please enter a valid email address format.');
      return;
    }

    setUpdatingPayPal(true);
    try {
      await api.patch('/users/me/paypal-email', { paypalEmail }, user.token);
      await updateUser(); // Refresh user data
      setShowPayPalModal(false);
      Alert.alert('Success', 'PayPal email updated successfully!');
    } catch (err: any) {
      const errorCode = err.response?.data?.code;
      const errorMessage = err.response?.data?.message || err.message;
      
      if (errorCode === 'INVALID_FORMAT' || errorCode === 'INVALID_EMAIL') {
        Alert.alert('Invalid Email', 'Please enter a valid PayPal email address.');
      } else {
        Alert.alert('Error', errorMessage || 'Failed to update PayPal email. Please try again.');
      }
    } finally {
      setUpdatingPayPal(false);
    }
  };

  const loadData = async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const [statsData, postsData, savedPostsData, savedStreamsData] = await Promise.all([
        api.get<UserStats>('/users/me/stats', user.token),
        api.get<Post[]>('/posts/me', user.token),
        api.get<Post[]>('/posts/saved', user.token),
        api.get<Stream[]>('/streams/saved', user.token),
      ]);
      setStats(statsData);
      setPosts(postsData);
      setSavedPosts(savedPostsData);
      setSavedStreams(savedStreamsData);
      loadSuggestedUsers();
    } catch (err: any) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedUsers = async () => {
    if (!user?.token) return;
    setLoadingUsers(true);
    try {
      const users = await api.get<{ _id: string; name: string; profilePhoto?: string }[]>('/users?limit=10', user.token);
      setSuggestedUsers(users);
    } catch (err: any) {
      console.error('Failed to load suggested users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user?.token) return;
    try {
      await api.post(`/users/${userId}/follow`, {}, user.token);
      await loadData(); // Refresh stats
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to follow user');
    }
  };

  const pickProfilePhoto = async () => {
    if (!user?.token) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const mediaType =
      (ImagePicker as any).MediaType?.Images ??
      (ImagePicker as any).MediaTypeOptions?.Images;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePhoto(result.assets[0].uri);
    }
  };

  const uploadProfilePhoto = async (uri: string) => {
    if (!user?.token) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri,
        name: filename,
        type,
      } as any);

      const response = await fetch(`${API_URL}/upload/image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      await api.patch('/users/me', { profilePhoto: data.url }, user.token);
      
      // Update immediately in local state for instant UI update
      setLocalProfilePhoto(data.url);
      
      // Update user in auth context to keep it in sync
      if (user.token) {
        await updateUser(user.token);
      }
      
      Alert.alert('Success', 'Profile photo updated');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCreatePost = () => {
    setShowPostModal(true);
    setPostImageUri(null);
    setPostCaption('');
  };

  const pickPostImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const mediaType =
      (ImagePicker as any).MediaType?.Images ??
      (ImagePicker as any).MediaTypeOptions?.Images;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPostImageUri(result.assets[0].uri);
    }
  };

  const uploadPost = async () => {
    if (!user?.token || !postImageUri) {
      Alert.alert('Error', 'Please select an image');
      return;
    }

    setUploadingPost(true);
    try {
      // Upload image
      const formData = new FormData();
      const filename = postImageUri.split('/').pop() || 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri: postImageUri,
        name: filename,
        type,
      } as any);

      const uploadResponse = await fetch(`${API_URL}/upload/image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Image upload failed');
      }

      const uploadData = await uploadResponse.json();

      // Create post
      await api.post(
        '/posts',
        {
          images: [uploadData.url],
          caption: postCaption || undefined,
        },
        user.token
      );

      Alert.alert('Success', 'Post created');
      setShowPostModal(false);
      setPostImageUri(null);
      setPostCaption('');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create post');
    } finally {
      setUploadingPost(false);
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <Header showSearch />
        <View style={styles.emptyState}>
          <ThemedText type="title" style={styles.welcomeTitle}>
            Welcome
          </ThemedText>
          <ThemedText style={styles.welcomeText}>
            Sign in to manage your profile, cart, orders, and live store.
          </ThemedText>
          <Pressable style={styles.authButton} onPress={() => router.push('/auth/login')}>
            <ThemedText style={styles.authButtonText}>Log in</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.authButton, styles.authButtonSecondary]}
            onPress={() => router.push('/auth/register')}
          >
            <ThemedText style={[styles.authButtonText, styles.authButtonTextSecondary]}>
              Create account
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Header
        showSearch={false}
        showBack={false}
        showMenu={true}
        rightAction={{
          onPress: handleCreatePost,
          icon: 'plus',
          circular: true,
        }}
        onMenuPress={() => {
          Alert.alert('Menu', 'Menu options', [
            { text: 'Live Streaming', onPress: () => router.push('/(tabs)/live') },
            { text: 'Settings', onPress: () => {} },
            { text: 'Logout', onPress: logout, style: 'destructive' },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.profilePictureContainer}>
            {localProfilePhoto ? (
              <Image source={{ uri: localProfilePhoto }} style={styles.profilePicture} />
            ) : (
              <View style={styles.profilePicture}>
                <View style={styles.avatarPlaceholder} />
              </View>
            )}
            <Pressable
              style={styles.cameraButton}
              onPress={pickProfilePhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <IconSymbol name="camera.fill" size={16} color="#1A1A1A" />
              )}
            </Pressable>
          </View>

          <View style={styles.profileInfo}>
            <ThemedText style={styles.profileName}>{user.name}</ThemedText>
            <View style={styles.stats}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{formatCount(stats.postsCount)}</ThemedText>
                <ThemedText style={styles.statLabel}>Posts</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{formatCount(stats.followersCount)}</ThemedText>
                <ThemedText style={styles.statLabel}>Followers</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{formatCount(stats.followingCount)}</ThemedText>
                <ThemedText style={styles.statLabel}>Following</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.profileHandle}>@{user.email.split('@')[0]}</ThemedText>
            <ThemedText style={styles.profileBio}>
              {user.bio || `Hello, I'm ${user.name}. Welcome to my profile!`}
            </ThemedText>
          </View>
        </View>

        {/* Payment Settings Section */}
        <View style={styles.settingsSection}>
          <ThemedText style={styles.settingsTitle}>Payment Settings</ThemedText>
          <View style={styles.paypalSection}>
            <View style={styles.paypalInfo}>
              <ThemedText style={styles.paypalLabel}>PayPal Email</ThemedText>
              <ThemedText style={styles.paypalValue}>
                {user?.paypalEmail || 'Not linked'}
              </ThemedText>
              {!user?.paypalEmail && (
                <ThemedText style={styles.paypalHint}>
                  Link your PayPal account to make purchases
                </ThemedText>
              )}
            </View>
            <Pressable
              style={styles.paypalButton}
              onPress={() => {
                setPaypalEmail(user?.paypalEmail || '');
                setShowPayPalModal(true);
              }}
            >
              <ThemedText style={styles.paypalButtonText}>
                {user?.paypalEmail ? 'Update' : 'Link PayPal'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Follow Flow Band */}
        {suggestedUsers.length > 0 && (
          <View style={styles.followFlowContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.followFlowScroll}>
              {suggestedUsers.map((suggestedUser) => (
                <Pressable
                  key={suggestedUser._id}
                  style={styles.followFlowItem}
                  onPress={() => handleFollow(suggestedUser._id)}
                >
                  <View style={styles.followFlowAvatar}>
                    {suggestedUser.profilePhoto ? (
                      <Image source={{ uri: suggestedUser.profilePhoto }} style={styles.followFlowAvatarImage} />
                    ) : (
                      <View style={styles.followFlowAvatarPlaceholder}>
                        <ThemedText style={styles.followFlowAvatarText}>
                          {suggestedUser.name.charAt(0).toUpperCase()}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText style={styles.followFlowName} numberOfLines={1}>
                    {suggestedUser.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              Posts
            </ThemedText>
            {activeTab === 'posts' && <View style={styles.tabUnderline} />}
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
            onPress={() => setActiveTab('saved')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>
              Saved
            </ThemedText>
            {activeTab === 'saved' && <View style={styles.tabUnderline} />}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={brandYellow} />
          </View>
        ) : (
          <View style={styles.grid}>
            {activeTab === 'posts' &&
              posts.map((post) => (
                <Pressable
                  key={post._id}
                  style={styles.gridItem}
                  onPress={() => {
                    if (post.images && post.images[0]) {
                      setSelectedImage(post.images[0]);
                      setShowImageModal(true);
                    }
                  }}
                >
                  {post.images && post.images[0] ? (
                    <Image source={{ uri: post.images[0] }} style={styles.gridImage} />
                  ) : (
                    <View style={styles.gridImagePlaceholder}>
                      <IconSymbol name="photo" size={30} color="#ccc" />
                    </View>
                  )}
                </Pressable>
              ))}
            {activeTab === 'posts' && posts.length === 0 && (
              <View style={styles.emptyGrid}>
                <ThemedText style={styles.emptyText}>No posts yet</ThemedText>
                <Pressable style={styles.createPostButton} onPress={handleCreatePost}>
                  <ThemedText style={styles.createPostButtonText}>Create your first post</ThemedText>
                </Pressable>
              </View>
            )}
            {activeTab === 'saved' && (
              <>
                {savedPosts.length === 0 && savedStreams.length === 0 ? (
                  <View style={styles.emptyGrid}>
                    <ThemedText style={styles.emptyText}>No saved items</ThemedText>
                  </View>
                ) : (
                  <>
                    {savedPosts.map((post) => (
                      <Pressable
                        key={`saved-post-${post._id}`}
                        style={styles.gridItem}
                        onPress={() => {
                          if (post.images && post.images[0]) {
                            setSelectedImage(post.images[0]);
                            setShowImageModal(true);
                          }
                        }}
                      >
                        {post.images && post.images[0] ? (
                          <Image source={{ uri: post.images[0] }} style={styles.gridImage} />
                        ) : (
                          <View style={styles.gridImagePlaceholder}>
                            <IconSymbol name="photo" size={30} color="#ccc" />
                          </View>
                        )}
                      </Pressable>
                    ))}
                    {savedStreams.map((stream) => (
                      <Pressable
                        key={`saved-stream-${stream._id}`}
                        style={styles.gridItem}
                        onPress={() => {
                          if (stream.playbackUrl) {
                            setSelectedStream(stream);
                            setShowVideoModal(true);
                          }
                        }}
                      >
                        <View style={styles.videoThumb}>
                          {stream.store?.logo ? (
                            <Image source={{ uri: stream.store.logo }} style={styles.videoThumbImage} />
                          ) : (
                            <View style={styles.gridImagePlaceholder}>
                              <IconSymbol name="play.fill" size={30} color="#ccc" />
                            </View>
                          )}
                          <View style={styles.videoPlayOverlay}>
                            <IconSymbol name="play.fill" size={28} color="#FFFFFF" />
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Post Creation Modal */}
      <Modal
        visible={showPostModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPostModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowPostModal(false)}>
                <ThemedText style={styles.modalCancel}>Cancel</ThemedText>
              </Pressable>
              <ThemedText style={styles.modalTitle}>Create Post</ThemedText>
              <Pressable onPress={uploadPost} disabled={!postImageUri || uploadingPost}>
                <ThemedText
                  style={[
                    styles.modalPost,
                    (!postImageUri || uploadingPost) && styles.modalPostDisabled,
                  ]}
                >
                  {uploadingPost ? 'Posting...' : 'Post'}
                </ThemedText>
              </Pressable>
            </View>

            {!postImageUri ? (
              <Pressable style={styles.pickImageButton} onPress={pickPostImage}>
                <IconSymbol name="photo" size={40} color="#666" />
                <ThemedText style={styles.pickImageText}>Pick an image</ThemedText>
              </Pressable>
            ) : (
              <View style={styles.postImageContainer}>
                <Image source={{ uri: postImageUri }} style={styles.postImagePreview} />
                <TextInput
                  style={styles.captionInput}
                  placeholder="Write a caption..."
                  placeholderTextColor="#999"
                  value={postCaption}
                  onChangeText={setPostCaption}
                  multiline
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <Pressable style={styles.imageModalClose} onPress={() => setShowImageModal(false)}>
            <ThemedText style={styles.imageModalCloseText}>Close</ThemedText>
          </Pressable>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.imageModalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* PayPal Email Modal */}
      <Modal
        visible={showPayPalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPayPalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>PayPal Email</ThemedText>
              <Pressable onPress={() => setShowPayPalModal(false)}>
                <IconSymbol name="chevron.down" size={24} color="#666" />
              </Pressable>
            </View>
            
            <ThemedText style={styles.modalSubtitle}>
              Link your PayPal account to make purchases. Your email will be used for payment processing.
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>PayPal Email Address</ThemedText>
              <TextInput
                style={styles.modalInput}
                placeholder="your.email@example.com"
                placeholderTextColor="#999"
                value={paypalEmail}
                onChangeText={setPaypalEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowPayPalModal(false)}
              >
                <ThemedText style={styles.modalButtonTextCancel}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleUpdatePayPalEmail}
                disabled={updatingPayPal}
              >
                {updatingPayPal ? (
                  <ActivityIndicator color="#1A1A1A" />
                ) : (
                  <ThemedText style={styles.modalButtonTextSave}>Save</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Saved Video Player Modal */}
      <Modal
        visible={showVideoModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowVideoModal(false)}
      >
        <ThemedView style={styles.videoModalContainer}>
          <View style={styles.videoModalHeader}>
            <Pressable onPress={() => setShowVideoModal(false)}>
              <ThemedText style={styles.imageModalCloseText}>Close</ThemedText>
            </Pressable>
            <ThemedText style={styles.videoModalTitle} numberOfLines={1}>
              {selectedStream?.title || 'Saved stream'}
            </ThemedText>
          </View>
          {selectedStream?.playbackUrl ? (
            <Video
              source={{ uri: selectedStream.playbackUrl }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode="contain"
              shouldPlay
            />
          ) : (
            <View style={styles.emptyGrid}>
              <ThemedText style={styles.emptyText}>No playback URL for this stream</ThemedText>
            </View>
          )}
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  welcomeTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  authButton: {
    width: '100%',
    backgroundColor: brandYellow,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  authButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: brandYellow,
  },
  authButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 16,
  },
  authButtonTextSecondary: {
    color: brandYellow,
  },
  profileSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
    overflow: 'visible',
  },
  profilePictureContainer: {
    position: 'relative',
    width: 108,
    height: 108,
    marginRight: 0,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  avatarPlaceholder: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: '#E0E0E0',
  },
  followFlowContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  followFlowScroll: {
    flexDirection: 'row',
  },
  followFlowItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  followFlowAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: brandYellow,
  },
  followFlowAvatarImage: {
    width: '100%',
    height: '100%',
  },
  followFlowAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followFlowAvatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#666',
  },
  followFlowName: {
    fontSize: 12,
    color: '#1A1A1A',
    textAlign: 'center',
    maxWidth: 70,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 100,
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  stats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  profileHandle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  profileBio: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: brandYellow,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 2,
  },
  gridItem: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 2,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  gridImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  videoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumbImage: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGrid: {
    width: '100%',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCancel: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modalPost: {
    fontSize: 16,
    fontWeight: '600',
    color: brandYellow,
  },
  modalPostDisabled: {
    opacity: 0.5,
  },
  pickImageButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 40,
  },
  pickImageText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  postImageContainer: {
    flex: 1,
  },
  postImagePreview: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
  },
  imageModalCloseText: {
    color: '#fff',
    fontSize: 14,
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
  videoModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  videoModalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  videoPlayer: {
    flex: 1,
    backgroundColor: '#000',
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  settingsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  paypalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paypalInfo: {
    flex: 1,
  },
  paypalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  paypalValue: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  paypalHint: {
    fontSize: 12,
    color: '#999',
  },
  paypalButton: {
    backgroundColor: brandYellow,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  paypalButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 14,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonSave: {
    backgroundColor: brandYellow,
  },
  modalButtonTextCancel: {
    color: '#666',
    fontWeight: '600',
  },
  modalButtonTextSave: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
});
