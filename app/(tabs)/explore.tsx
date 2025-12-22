import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { Product, Store } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { brandYellow } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

type TabType = 'all' | 'my';

export default function StoresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [myStores, setMyStores] = useState<Store[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const all = await api.get<Store[]>('/stores');
      setStores(all);

      const products = await api.get<Product[]>('/products');
      setAllProducts(products);
      
      if (user?.token && user.id) {
        const my = all.filter((s) => s.owner?.toString() === user.id);
        setMyStores(my);
      } else {
        setMyStores([]);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [user, activeTab]);

  const handleCreateStore = () => {
    console.log(!user?.token);
    if (!user?.token) {
      // Show a clear message, then send the user to the login screen
      Alert.alert(
        'Login required',
        'Please log in to create a store.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Login',
            onPress: () => router.push('/auth/login'),
          },
        ],
        { cancelable: true }
      );
      return;
    }
    router.push('/store/create');
  };

  const getStoreStats = (storeId: string) => {
    const products = allProducts.filter((p) => p.store === storeId);
    const count = products.length;
    const avg =
      count === 0
        ? 0
        : products.reduce((sum, p) => sum + (p.averageRating ?? 0), 0) / count;
    return { count, avg: Number(avg.toFixed(1)) };
  };

  const renderStoreCard = (item: Store, mode: TabType) => {
    const stats = getStoreStats(item._id);
    return (
      <Pressable
        onPress={() => {
          if (mode === 'all') {
            // User view: browse & buy products
          router.push({
              pathname: '/store/[storeId]/products',
              params: { storeId: item._id, slug: item.slug },
            });
          } else {
            // Owner view: manage store & products
        router.push({
          pathname: '/store/[storeId]',
          params: { storeId: item._id, slug: item.slug },
            });
      }
        }}
    >
      <View style={styles.storeCard}>
        {item.banner ? (
          <Image source={{ uri: item.banner }} style={styles.storeImage} />
        ) : (
          <View style={[styles.storeImage, styles.storeImagePlaceholder]}>
            <IconSymbol name="photo" size={40} color="#ccc" />
          </View>
        )}
        <View style={styles.storeContent}>
          <View style={styles.storeHeader}>
              {item.logo ? (
              <Image source={{ uri: item.logo }} style={styles.storeLogo} />
              ) : (
                <View style={styles.storeLogoPlaceholder}>
                  <IconSymbol name="bolt.fill" size={16} color={brandYellow} />
                </View>
            )}
            <ThemedText style={styles.storeName}>{item.name}</ThemedText>
          </View>
          <ThemedText style={styles.storeDescription} numberOfLines={2}>
            {item.description || 'No description'}
          </ThemedText>
            <View style={styles.storeMetaRow}>
              <View style={styles.metaItem}>
                <MaterialIcons name="storefront" size={16} color="#555" />
                <ThemedText style={styles.metaText}>{`${stats.count} Products`}</ThemedText>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons name="star" size={16} color={brandYellow} />
                <ThemedText style={styles.metaText}>{`${stats.avg || 0} rating`}</ThemedText>
              </View>
            </View>
        </View>
      </View>
    </Pressable>
  );
  };

  return (
    <ThemedView style={styles.container}>
      <Header
        showSearch
        rightAction={{
          label: '+ Create Store',
          onPress: handleCreateStore,
        }}
      />
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All Stores
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
            My Store
          </ThemedText>
        </Pressable>
      </View>

      {activeTab === 'all' ? (
        <FlatList
          data={stores}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => renderStoreCard(item, 'all')}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <>
          {myStores.length === 0 && user?.token ? (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyText}>You don't have a store yet.</ThemedText>
              <Pressable style={styles.emptyButton} onPress={handleCreateStore}>
                <ThemedText style={styles.emptyButtonText}>Create Your First Store</ThemedText>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={myStores}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => renderStoreCard(item, 'my')}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: brandYellow,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 20,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  storeImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#f0f0f0',
  },
  storeImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeContent: {
    padding: 16,
    gap: 6,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  storeLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: brandYellow,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  storeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  storeMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#555',
    fontSize: 13,
    fontWeight: '600',
  },
  storeLogoPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF4D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: brandYellow,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
});
