import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from './themed-text';
import { MaterialIcons } from '@expo/vector-icons';
import { brandYellow } from '@/constants/theme';

interface ChatMenuProps {
  visible: boolean;
  onClose: () => void;
  onPickImage: () => void;
  onPickVideo: () => void;
  onPickFile: () => void;
  onShowGifs: () => void;
}

export function ChatMenu({
  visible,
  onClose,
  onPickImage,
  onPickVideo,
  onPickFile,
  onShowGifs,
}: ChatMenuProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.menu}>
        <Pressable style={styles.menuItem} onPress={onPickImage}>
          <View style={[styles.menuIcon, { backgroundColor: '#E3F2FD' }]}>
            <MaterialIcons name="image" size={24} color="#2196F3" />
          </View>
          <ThemedText style={styles.menuText}>Photo</ThemedText>
        </Pressable>
        <Pressable style={styles.menuItem} onPress={onPickVideo}>
          <View style={[styles.menuIcon, { backgroundColor: '#FCE4EC' }]}>
            <MaterialIcons name="videocam" size={24} color="#E91E63" />
          </View>
          <ThemedText style={styles.menuText}>Video</ThemedText>
        </Pressable>
        <Pressable style={styles.menuItem} onPress={onPickFile}>
          <View style={[styles.menuIcon, { backgroundColor: '#FFF3E0' }]}>
            <MaterialIcons name="attach-file" size={24} color="#FF9800" />
          </View>
          <ThemedText style={styles.menuText}>File</ThemedText>
        </Pressable>
        <Pressable style={styles.menuItem} onPress={onShowGifs}>
          <View style={[styles.menuIcon, { backgroundColor: '#F3E5F5' }]}>
            <MaterialIcons name="gif" size={24} color="#9C27B0" />
          </View>
          <ThemedText style={styles.menuText}>GIF</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menu: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -5 },
    elevation: 10,
  },
  menuItem: {
    alignItems: 'center',
    width: '25%',
    marginBottom: 20,
  },
  menuIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  menuText: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '500',
  },
});

