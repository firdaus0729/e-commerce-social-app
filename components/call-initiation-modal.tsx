import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { ThemedText } from './themed-text';
import { Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { brandYellow } from '@/constants/theme';

interface CallInitiationModalProps {
  visible: boolean;
  onClose: () => void;
  onStartVideo: () => void;
  onStartAudio: () => void;
  userName: string;
  userAvatar?: string;
}

export function CallInitiationModal({
  visible,
  onClose,
  onStartVideo,
  onStartAudio,
  userName,
  userAvatar,
}: CallInitiationModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Profile Picture */}
          <View style={styles.profileContainer}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <MaterialIcons name="person" size={64} color="#999" />
              </View>
            )}
          </View>

          {/* Name */}
          <ThemedText style={styles.userName}>{userName}</ThemedText>

          {/* Action Buttons */}
          <View style={styles.buttonsContainer}>
            {/* Audio Button */}
            <Pressable style={styles.button} onPress={onStartAudio}>
              <View style={[styles.buttonCircle, styles.audioButton]}>
                <MaterialIcons name="phone" size={28} color="#fff" />
              </View>
              <ThemedText style={styles.buttonLabel}>Audio</ThemedText>
            </Pressable>

            {/* Cancel Button */}
            <Pressable style={styles.button} onPress={onClose}>
              <View style={[styles.buttonCircle, styles.cancelButton]}>
                <MaterialIcons name="close" size={28} color="#1A1A1A" />
              </View>
              <ThemedText style={styles.buttonLabel}>Cancel</ThemedText>
            </Pressable>

            {/* Video Call Button */}
            <Pressable style={styles.button} onPress={onStartVideo}>
              <View style={[styles.buttonCircle, styles.videoButton]}>
                <MaterialIcons name="videocam" size={28} color="#fff" />
              </View>
              <ThemedText style={styles.buttonLabel}>Video Call</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#2C2C2C',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
  },
  profileContainer: {
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 32,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 16,
  },
  button: {
    alignItems: 'center',
    flex: 1,
  },
  buttonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  audioButton: {
    backgroundColor: '#4FC3F7',
  },
  cancelButton: {
    backgroundColor: '#fff',
  },
  videoButton: {
    backgroundColor: '#4FC3F7',
  },
  buttonLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
});

