import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { webrtcStreamingClient } from '@/services/webrtc-streaming-client';
import { StreamComment } from '@/types';
import { brandYellow } from '@/constants/theme';

interface StreamCommentsProps {
  streamId: string;
  roomId?: string;
}

export function StreamComments({ streamId, roomId }: StreamCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<StreamComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user?.token || !streamId) return;

    loadComments();

    // Connect to WebSocket for real-time comments
    socketRef.current = webrtcStreamingClient.connect(user.token);

    socketRef.current.on('new-comment', (data: { streamId: string; text: string; userId: string; userName: string; createdAt: string }) => {
      if (data.streamId === streamId) {
        const newComment: StreamComment = {
          _id: `temp_${Date.now()}`,
          stream: streamId,
          user: {
            _id: data.userId,
            name: data.userName,
          },
          text: data.text,
          createdAt: data.createdAt,
          updatedAt: data.createdAt,
        };
        setComments((prev) => [newComment, ...prev]);
        // Scroll to top to show new comment
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off('new-comment');
      }
    };
  }, [streamId, user?.token]);

  const loadComments = async () => {
    if (!user?.token) return;

    try {
      const data = await api.get<StreamComment[]>(`/stream-comments/${streamId}?limit=50`, user.token);
      setComments(data.reverse()); // Reverse to show newest at top
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const sendComment = async () => {
    if (!commentText.trim() || !user?.token || sending) return;

    setSending(true);
    try {
      const comment = await api.post<StreamComment>(
        `/stream-comments/${streamId}`,
        { text: commentText.trim() },
        user.token
      );

      // Emit via WebSocket for real-time broadcast
      if (socketRef.current) {
        socketRef.current.emit('stream-comment', {
          streamId,
          text: comment.text,
        });
      }

      setCommentText('');
    } catch (error: any) {
      console.error('Failed to send comment:', error);
    } finally {
      setSending(false);
    }
  };

  const renderComment = ({ item }: { item: StreamComment }) => {
    const isOwnComment = item.user._id === user?.id;

    return (
      <View style={[styles.comment, isOwnComment && styles.ownComment]}>
        {item.user.profilePhoto ? (
          <Image source={{ uri: item.user.profilePhoto }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <ThemedText style={styles.avatarText}>
              {item.user.name.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
        )}
        <View style={styles.commentContent}>
          <ThemedText style={styles.commentName}>{item.user.name}</ThemedText>
          <ThemedText style={styles.commentText}>{item.text}</ThemedText>
          <ThemedText style={styles.commentTime}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.commentsList}>
        <FlatList
          ref={flatListRef}
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item._id}
          inverted
          contentContainerStyle={styles.commentsContent}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          placeholderTextColor="#999"
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          editable={!sending}
        />
        <Pressable
          style={[styles.sendButton, (!commentText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={sendComment}
          disabled={!commentText.trim() || sending}
        >
          <MaterialIcons
            name="send"
            size={20}
            color={commentText.trim() && !sending ? '#fff' : '#999'}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '40%',
    backgroundColor: 'transparent',
  },
  commentsList: {
    flex: 1,
    maxHeight: 200,
  },
  commentsContent: {
    padding: 12,
    gap: 12,
  },
  comment: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 12,
  },
  ownComment: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  ownCommentName: {
    color: '#1A1A1A',
  },
  ownCommentText: {
    color: '#1A1A1A',
  },
  ownCommentTime: {
    color: 'rgba(0,0,0,0.5)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  commentContent: {
    flex: 1,
  },
  commentName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    backgroundColor: '#fff',
    color: '#1A1A1A',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});

