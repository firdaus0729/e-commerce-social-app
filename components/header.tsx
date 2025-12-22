import { Pressable, StyleSheet, View } from 'react-native';
import { IconSymbol } from './ui/icon-symbol';
import { DemisandLogo } from './logo';
import { brandYellow } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { useRouter } from 'expo-router';

interface HeaderProps {
  showSearch?: boolean;
  showBack?: boolean;
  showNotifications?: boolean;
  showMessages?: boolean;
  showMenu?: boolean;
  onBackPress?: () => void;
  rightAction?: {
    label?: string;
    onPress: () => void;
    icon?: string;
    circular?: boolean;
  };
  onMenuPress?: () => void;
}

export function Header({
  showSearch = true,
  showBack = true,
  showNotifications = false,
  showMessages = false,
  showMenu = false,
  onBackPress,
  rightAction,
  onMenuPress,
}: HeaderProps) {
  const router = useRouter();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showBack && (
          <Pressable style={styles.backButton} onPress={handleBackPress}>
            <IconSymbol name="chevron.left" size={20} color="#1A1A1A" />
          </Pressable>
        )}
        <DemisandLogo size={20} />
      </View>
      <View style={styles.right}>
        {showSearch && (
          <Pressable
            style={styles.iconButton}
            onPress={() =>
              router.push({
                pathname: '/search',
              })
            }
          >
            <IconSymbol name="magnifyingglass" size={22} color="#1A1A1A" />
          </Pressable>
        )}
        {showNotifications && (
          <Pressable style={styles.iconButton}>
            <IconSymbol name="bell" size={22} color="#1A1A1A" />
            <View style={styles.badge} />
          </Pressable>
        )}
        {showMessages && (
          <Pressable style={[styles.iconButton, styles.messagesButton]}>
            <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
          </Pressable>
        )}
        {rightAction && (
          <Pressable
            style={[
              rightAction.circular ? styles.circularButton : styles.actionButton,
              rightAction.circular && !rightAction.label && styles.iconButton,
            ]}
            onPress={rightAction.onPress}
          >
            {rightAction.icon && (
              <IconSymbol
                name={rightAction.icon}
                size={rightAction.circular ? 20 : 16}
                color="#1A1A1A"
              />
            )}
            {rightAction.label && (
              <ThemedText style={styles.actionText}>{rightAction.label}</ThemedText>
            )}
          </Pressable>
        )}
        {showMenu && (
          <Pressable style={styles.iconButton} onPress={onMenuPress}>
            <IconSymbol name="ellipsis" size={22} color="#1A1A1A" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFEF9',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  messagesButton: {
    backgroundColor: '#6366F1',
    width: 32,
    height: 32,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: brandYellow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  circularButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  actionText: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 14,
  },
});

