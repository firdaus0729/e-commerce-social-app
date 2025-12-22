import { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, Image, RefreshControl, ActivityIndicator } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { Stream } from '@/types';
import { brandYellow } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

interface StreamListProps {
  onSelectStream: (stream: Stream) => void;
  onCreateStream?: () => void;
}

export function StreamList({ onSelectStream, onCreateStream }: StreamListProps) {
  const { user } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savedStreams, setSavedStreams] = useState<Record<string, boolean>>({});

  const loadStreams = async () => {
    if (!user?.token) return;

    setLoading(true);
    try {
      const data = await api.get<Stream[]>('/streams', user.token);
      setStreams(data);
      // Initialize saved state for streams from backend
      try {
        const saved = await api.get<Stream[]>('/streams/saved', user.token);
        const map: Record<string, boolean> = {};
        saved.forEach((stream) => {
          map[stream._id] = true;
        });
        setSavedStreams(map);
      } catch (error) {
        console.error('Failed to load saved streams:', error);
      }
    } catch (error: any) {
      console.error('Failed to load streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStreams();
    setRefreshing(false);
  };

  useEffect(() => {
    loadStreams();
  }, [user?.token]);

  const renderStream = ({ item }: { item: Stream }) => {
    const isLive = item.status === 'live';
    const isOwnStream = item.broadcasterId?._id === user?.id;
    const broadcasterName = isOwnStream ? 'Me' : (item.broadcasterId?.name || 'Unknown');
    const storeName = item.store?.name || '';
    const isSaved = !!savedStreams[item._id];

    const handleSaveStream = async () => {
      if (!user?.token || isOwnStream || isSaved) return;
      try {
        await api.post(`/streams/${item._id}/save`, {}, user.token);
        setSavedStreams((prev) => ({ ...prev, [item._id]: true }));
      } catch (error) {
        console.error('Failed to save stream:', error);
      }
    };

    return (
      <Pressable
        style={styles.streamCard}
        onPress={() => onSelectStream(item)}
      >
        <View style={styles.streamThumbnail}>
          {item.store?.logo ? (
            <Image source={{ uri: item.store.logo }} style={styles.thumbnailImage} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <MaterialIcons name="videocam" size={40} color="#ccc" />
            </View>
          )}
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.liveText}>LIVE</ThemedText>
            </View>
          )}
          {item.viewerCount !== undefined && item.viewerCount > 0 && (
            <View style={styles.viewerBadge}>
              <MaterialIcons name="visibility" size={14} color="#fff" />
              <ThemedText style={styles.viewerText}>{item.viewerCount}</ThemedText>
            </View>
          )}
        </View>
        <View style={styles.streamInfo}>
          <ThemedText style={styles.streamTitle} numberOfLines={2}>
            {item.title}
          </ThemedText>
          <ThemedText style={styles.streamMeta} numberOfLines={1}>
            {broadcasterName} {storeName && `• ${storeName}`}
          </ThemedText>
          {isLive && item.startTime && (
            <ThemedText style={styles.streamTime}>
              Started {new Date(item.startTime).toLocaleTimeString()}
            </ThemedText>
          )}
        </View>
        <View style={styles.actions}>
          {item.playbackUrl && (
            <Pressable
              onPress={handleSaveStream}
              disabled={isOwnStream || isSaved}
              style={styles.saveButton}
            >
              <ThemedText
                style={[
                  styles.saveButtonText,
                  isSaved && styles.saveButtonTextSaved,
                  isOwnStream && styles.saveButtonTextDisabled,
                ]}
              >
                {isSaved ? 'Saved' : 'Save'}
              </ThemedText>
            </Pressable>
          )}
          <MaterialIcons name="chevron-right" size={24} color="#999" />
        </View>
      </Pressable>
    );
  };

  if (loading && streams.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={brandYellow} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {onCreateStream && (
        <Pressable style={styles.createButton} onPress={onCreateStream}>
          <MaterialIcons name="add-circle" size={24} color="#fff" />
          <ThemedText style={styles.createButtonText}>Create Stream</ThemedText>
        </Pressable>
      )}
      <FlatList
        data={streams}
        renderItem={renderStream}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="videocam-off" size={64} color="#ccc" />
            <ThemedText style={styles.emptyText}>No streams available</ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandYellow,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  streamCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  streamThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginRight: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  viewerBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  viewerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  streamInfo: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  saveButtonTextSaved: {
    color: '#EF4444',
    fontWeight: '700',
  },
  saveButtonTextDisabled: {
    color: '#ccc',
  },
  streamTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  streamMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  streamTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
});

