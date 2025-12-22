import { useEffect, useState } from 'react';
import { StyleSheet, Modal, View, Pressable, Alert, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { StreamList } from '@/components/live-stream/StreamList';
import { CreateStreamModal } from '@/components/live-stream/CreateStreamModal';
import { api } from '@/lib/api';
import { Stream } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { MaterialIcons } from '@expo/vector-icons';
import { brandYellow } from '@/constants/theme';

// Define styles first so they're available for fallback components
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: brandYellow,
    borderRadius: 8,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});

// Conditionally import WebRTC-dependent components
let LiveStreamViewer: any = null;
let LiveStreamBroadcaster: any = null;

try {
  // Try to import react-native-webrtc first to check if it's available
  require('react-native-webrtc');
  
  const viewerModule = require('@/components/live-stream/LiveStreamViewer');
  LiveStreamViewer = viewerModule.LiveStreamViewer;
  const broadcasterModule = require('@/components/live-stream/LiveStreamBroadcaster');
  LiveStreamBroadcaster = broadcasterModule.LiveStreamBroadcaster;
} catch (error: any) {
  console.warn('WebRTC components not available:', error?.message || error);
  // Create fallback components
  LiveStreamViewer = ({ stream, onClose }: any) => (
    <ThemedView style={styles.container}>
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <ThemedText style={styles.errorText}>WebRTC Module Not Available</ThemedText>
        <ThemedText style={styles.errorSubtext}>
          react-native-webrtc requires a development build.{'\n'}
          Run: npx expo prebuild{'\n'}
          Then: npx expo run:android or npx expo run:ios
        </ThemedText>
        <Pressable style={styles.errorButton} onPress={onClose}>
          <ThemedText style={styles.errorButtonText}>Close</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
  LiveStreamBroadcaster = ({ stream, onStop }: any) => (
    <ThemedView style={styles.container}>
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <ThemedText style={styles.errorText}>WebRTC Module Not Available</ThemedText>
        <ThemedText style={styles.errorSubtext}>
          react-native-webrtc requires a development build.{'\n'}
          Run: npx expo prebuild{'\n'}
          Then: npx expo run:android or npx expo run:ios
        </ThemedText>
        <Pressable style={styles.errorButton} onPress={onStop}>
          <ThemedText style={styles.errorButtonText}>Close</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

export default function LiveScreen() {
  const { user } = useAuth();
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [myStream, setMyStream] = useState<Stream | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectStream = async (stream: Stream) => {
    // If it's the user's own stream and not live, try to start it
    if (stream.broadcasterId?._id === user?.id && stream.status !== 'live') {
      try {
        if (user?.token) {
          const started = await api.post<{ stream: Stream; roomId: string }>(
            `/streams/${stream._id}/start`,
            {},
            user.token
          );
          setMyStream(started.stream);
          setIsBroadcasting(true);
          setRefreshKey((prev) => prev + 1); // Refresh stream list
          return;
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to start stream');
        return;
      }
    }
    
    // For viewing streams, only allow if live
    if (stream.status === 'live') {
      setSelectedStream(stream);
    } else {
      Alert.alert('Stream Not Live', 'This stream is not currently live. Please wait for the broadcaster to start streaming.');
    }
  };

  const handleCreateStream = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to create a stream');
      return;
    }
    setShowCreateModal(true);
  };

  const handleStreamCreated = async (stream: Stream) => {
    setShowCreateModal(false);
    setMyStream(stream);
    // Auto-start the stream
    try {
      if (user?.token) {
        const started = await api.post<{ stream: Stream; roomId: string }>(
          `/streams/${stream._id}/start`,
          {},
          user.token
        );
        setMyStream(started.stream);
        setIsBroadcasting(true);
        setRefreshKey((prev) => prev + 1); // Refresh stream list
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start stream');
      // Even if start fails, refresh the list to show the new stream
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handleStopBroadcast = async () => {
    if (!myStream || !user?.token) return;

    try {
      await api.post(`/streams/${myStream._id}/stop`, {}, user.token);
      setIsBroadcasting(false);
      setMyStream(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to stop stream');
    }
  };

  const handleCloseViewer = () => {
    setSelectedStream(null);
  };

  // Show broadcaster if user is streaming
  if (isBroadcasting && myStream) {
    return (
      <LiveStreamBroadcaster
        stream={myStream}
        onStop={handleStopBroadcast}
      />
    );
  }

  // Show viewer if stream is selected
  if (selectedStream) {
    return (
      <LiveStreamViewer
        stream={selectedStream}
        onClose={handleCloseViewer}
      />
    );
  }

  // Show stream list
  return (
    <ThemedView style={styles.container}>
      <Header
        showSearch
        rightAction={{
          label: 'Go Live',
          icon: 'videocam',
          onPress: handleCreateStream,
        }}
      />
      <StreamList
        key={refreshKey}
        onSelectStream={handleSelectStream}
        onCreateStream={handleCreateStream}
      />
      <CreateStreamModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onStreamCreated={handleStreamCreated}
      />
    </ThemedView>
  );
}
