import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { Product, Store } from '@/types';
import { brandYellow } from '@/constants/theme';

type Mode = 'products' | 'stores';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [allProducts, allStores] = await Promise.all([
          api.get<Product[]>('/products'),
          api.get<Store[]>('/stores'),
        ]);
        setProducts(allProducts);
        setStores(allStores);
      } catch (err) {
        console.log(err);
      }
    };
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
    );
  }, [products, query]);

  const filteredStores = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
    );
  }, [stores, query]);

  return (
    <ThemedView style={styles.container}>
      <Header showSearch={false} />
      <View style={styles.searchBar}>
        <TextInput
          placeholder="Search products or stores"
          style={styles.input}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.modeTabs}>
        <Pressable
          style={[styles.modeTab, mode === 'products' && styles.modeTabActive]}
          onPress={() => setMode('products')}
        >
          <ThemedText style={[styles.modeText, mode === 'products' && styles.modeTextActive]}>
            Products
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.modeTab, mode === 'stores' && styles.modeTabActive]}
          onPress={() => setMode('stores')}
        >
          <ThemedText style={[styles.modeText, mode === 'stores' && styles.modeTextActive]}>
            Stores
          </ThemedText>
        </Pressable>
      </View>

      {mode === 'products' ? (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.resultRow}
              onPress={() =>
                router.push({ pathname: '/product/[productId]', params: { productId: item._id } })
              }
            >
              <ThemedText style={styles.resultTitle}>{item.title}</ThemedText>
              <ThemedText style={styles.resultSubtitle}>
                {`$${item.price.toFixed(2)}`}
              </ThemedText>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={filteredStores}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.resultRow}
              onPress={() =>
                router.push({
                  pathname: '/store/[storeId]/products',
                  params: { storeId: item._id, slug: item.slug },
                })
              }
            >
              <ThemedText style={styles.resultTitle}>{item.name}</ThemedText>
              <ThemedText style={styles.resultSubtitle}>
                {item.description || 'Store'}
              </ThemedText>
            </Pressable>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  modeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  modeTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  modeTabActive: {
    backgroundColor: brandYellow,
  },
  modeText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  modeTextActive: {
    color: '#111827',
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  resultRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  resultSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
  },
});


