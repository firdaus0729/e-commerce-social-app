import { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { Stream } from '@/types';
import { brandYellow } from '@/constants/theme';

interface CreateStreamModalProps {
  visible: boolean;
  onClose: () => void;
  onStreamCreated: (stream: Stream) => void;
}

export function CreateStreamModal({ visible, onClose, onStreamCreated }: CreateStreamModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a stream title');
      return;
    }

    if (!user?.token) {
      Alert.alert('Error', 'Please login to create a stream');
      return;
    }

    setLoading(true);
    try {
      const stream = await api.post<Stream>(
        '/streams',
        { title: title.trim() },
        user.token
      );
      setTitle('');
      onStreamCreated(stream);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create stream');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ThemedView style={styles.modal}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Create Live Stream</ThemedText>
            <Pressable onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#1A1A1A" />
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Stream Title</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter stream title..."
                placeholderTextColor="#999"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                editable={!loading}
              />
            </View>

            <ThemedText style={styles.hint}>
              After creating, you'll be able to start streaming immediately.
            </ThemedText>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.button, styles.createButton, loading && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={loading || !title.trim()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <ThemedText style={styles.createButtonText}>Create Stream</ThemedText>
              )}
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#1A1A1A',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  createButton: {
    backgroundColor: brandYellow,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  createButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 16,
  },
});

