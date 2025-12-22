import { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Image, ActivityIndicator, TextInput, Alert } from 'react-native';
import { ThemedText } from './themed-text';
import { GIPHY_API_KEY } from '@/constants/config';

const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs';

interface GifPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
}

export function GifPicker({ visible, onClose, onSelect }: GifPickerProps) {
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      loadTrendingGifs();
    }
  }, [visible]);

  const loadTrendingGifs = async () => {
    if (!GIPHY_API_KEY || GIPHY_API_KEY === '') {
      setGifs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${GIPHY_API_URL}/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`);
      if (response.ok) {
        const data = await response.json();
        setGifs(data.data || []);
      } else {
        const error = await response.json().catch(() => ({}));
        console.error('Giphy API error:', error);
        setGifs([]);
      }
    } catch (err) {
      console.error('Failed to load GIFs:', err);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!GIPHY_API_KEY || GIPHY_API_KEY === '') {
      return;
    }

    if (!query.trim()) {
      loadTrendingGifs();
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${GIPHY_API_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`);
      if (response.ok) {
        const data = await response.json();
        setGifs(data.data || []);
      } else {
        const error = await response.json().catch(() => ({}));
        console.error('Giphy search error:', error);
      }
    } catch (err) {
      console.error('Failed to search GIFs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.headerText}>GIF</ThemedText>
        <Pressable onPress={onClose}>
          <ThemedText style={styles.closeButton}>✕</ThemedText>
        </Pressable>
      </View>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search GIFs..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            searchGifs(text);
          }}
        />
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#666" />
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          <View style={styles.gifGrid}>
            {!GIPHY_API_KEY || GIPHY_API_KEY === '' ? (
              <View style={styles.empty}>
                <ThemedText style={styles.emptyText}>
                  GIF feature requires a Giphy API key{'\n\n'}
                  Steps:{'\n'}
                  1. Sign up at developers.giphy.com{'\n'}
                  2. Create an app and get API key{'\n'}
                  3. Add to .env as EXPO_PUBLIC_GIPHY_API_KEY{'\n\n'}
                  See WHATSAPP_FEATURES_EXPLANATION.md for details
                </ThemedText>
              </View>
            ) : gifs.length === 0 ? (
              <View style={styles.empty}>
                <ThemedText style={styles.emptyText}>
                  {searchQuery ? 'No GIFs found' : 'Loading GIFs...'}
                </ThemedText>
              </View>
            ) : (
              gifs.map((gif) => (
                <Pressable
                  key={gif.id}
                  style={styles.gifItem}
                  onPress={() => {
                    const gifUrl = gif.images?.fixed_height?.url || gif.images?.original?.url;
                    if (gifUrl) {
                      onSelect(gifUrl);
                    }
                  }}
                >
                  <Image
                    source={{ uri: gif.images?.fixed_height_small?.url || gif.images?.preview?.url }}
                    style={styles.gifImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 400,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -5 },
    elevation: 10,
    zIndex: 1001,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
    fontWeight: '600',
  },
  searchContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  gifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  gifItem: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 4,
  },
  gifImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});

