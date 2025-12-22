import { Image, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';

export function DemisandLogo({ size = 28 }: { size?: number }) {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/logo.jpg')}
        style={[styles.logoImage, { width: size * 6.6, height: size * 2.6 }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    borderRadius: 4,
  },
});

