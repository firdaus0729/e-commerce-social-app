import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { Store } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { brandYellow } from '@/constants/theme';
import { API_URL } from '@/constants/config';

export default function CreateStoreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickImage = async (type: 'logo' | 'banner') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const mediaType =
      (ImagePicker as any).MediaType?.Images ??
      (ImagePicker as any).MediaTypeOptions?.Images;

    const result = await ImagePicker.launchImageLibraryAsync({
      /**
       * Pass a single enum value (not an array) to satisfy both old (MediaTypeOptions)
       * and new (MediaType) APIs and avoid Android cast errors.
       */
      mediaTypes: mediaType,
      allowsEditing: true,
      aspect: type === 'logo' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (type === 'logo') {
        setLogoUri(result.assets[0].uri);
      } else {
        setBannerUri(result.assets[0].uri);
      }
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
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
        Authorization: `Bearer ${user?.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Upload failed');
    }

    const data = await response.json();
    return data.url;
  };

  const handleCreate = async () => {
    if (!user?.token) {
      return Alert.alert('Login required', 'Please log in to create a store.');
    }
    if (!name.trim()) {
      return Alert.alert('Store name', 'Please enter a store name.');
    }

    try {
      setLoading(true);
      setUploading(true);

      let logoUrl = '';
      let bannerUrl = '';

      if (logoUri) {
        logoUrl = await uploadImage(logoUri);
      }
      if (bannerUri) {
        bannerUrl = await uploadImage(bannerUri);
      }

      setUploading(false);

      const store = await api.post<Store>(
        '/stores',
        {
          name: name.trim(),
          description: description.trim(),
          logo: logoUrl || undefined,
          banner: bannerUrl || undefined,
        },
        user.token
      );

      Alert.alert('Success', 'Store created!', [
        {
          text: 'OK',
          onPress: () =>
            router.push({
              pathname: '/store/[storeId]',
              params: { storeId: store._id, slug: store.slug },
            }),
        },
      ]);
    } catch (err: any) {
      setUploading(false);
      Alert.alert('Error', err.message || 'Failed to create store');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Header showSearch />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Create Your Store
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Set up your store to start selling products and going live.
          </ThemedText>

          <View style={styles.imageSection}>
            <ThemedText style={styles.sectionLabel}>Store Banner</ThemedText>
            <Pressable style={styles.imagePicker} onPress={() => pickImage('banner')}>
              {bannerUri ? (
                <Image source={{ uri: bannerUri }} style={styles.bannerImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <IconSymbol name="photo" size={40} color="#ccc" />
                  <ThemedText style={styles.placeholderText}>Tap to add banner</ThemedText>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.imageSection}>
            <ThemedText style={styles.sectionLabel}>Store Logo</ThemedText>
            <Pressable style={styles.logoPicker} onPress={() => pickImage('logo')}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <IconSymbol name="photo" size={30} color="#ccc" />
                </View>
              )}
            </Pressable>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Store name *"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <Pressable
            style={[styles.createButton, (loading || uploading) && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading || uploading}
          >
            <ThemedText style={styles.createButtonText}>
              {uploading ? 'Uploading images…' : loading ? 'Creating…' : '+ Create Store'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    marginBottom: 24,
  },
  imageSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  imagePicker: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  logoPicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    borderWidth: 3,
    borderColor: brandYellow,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderText: {
    marginTop: 8,
    color: '#999',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: brandYellow,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  createButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
