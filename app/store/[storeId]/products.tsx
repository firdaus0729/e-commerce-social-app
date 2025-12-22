import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { Product, Store, Cart } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { brandYellow } from '@/constants/theme';

export default function StoreProductsScreen() {
  const router = useRouter();
  const { storeId, slug } = useLocalSearchParams<{ storeId: string; slug?: string }>();
  const { user } = useAuth();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [qtyValue, setQtyValue] = useState('1');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const s = await api.get<Store>(`/stores/id/${storeId}`);
      setStore(s);
      if (user?.id) {
        setIsOwner(s.owner?.toString() === user.id);
      } else {
        setIsOwner(false);
      }
      const p = await api.get<Product[]>(`/products?store=${storeId}`);
      setProducts(p);
    } catch (err: any) {
      Alert.alert('Store', err.message ?? 'Failed to load store');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, [storeId, user?.id]);

  const renderStars = (avg: number) => {
    const rounded = Math.round(avg);
    return (
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <MaterialIcons key={i} name={i <= rounded ? 'star' : 'star-border'} size={16} color={i <= rounded ? brandYellow : '#ccc'} />
        ))}
      </View>
    );
  };

  const addToCart = async (productId: string, quantity: number) => {
    if (!user?.token) {
      return Alert.alert('Login required', 'Please log in to add items to cart.');
    }
    try {
      await api.post<Cart>('/cart/items', { productId, quantity }, user.token);
      Alert.alert('Cart', 'Added to cart');
    } catch (err: any) {
      Alert.alert('Cart', err.message || 'Failed to add to cart');
    }
  };

  const openQtyModal = (product: Product) => {
    setSelectedProduct(product);
    setQtyValue('1');
    setQtyModalVisible(true);
  };

  const confirmQty = () => {
    if (!selectedProduct) return;
    const qty = Number(qtyValue);
    if (Number.isNaN(qty) || qty <= 0) {
      return Alert.alert('Quantity', 'Enter a valid quantity (1 or more).');
    }
    addToCart(selectedProduct._id, qty);
    setQtyModalVisible(false);
  };

  const headerTitle = useMemo(() => {
    if (store) return `${store.name} - All Products`;
    return 'All Products';
  }, [store]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header
        showSearch
      />
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>{headerTitle}</ThemedText>
        <ThemedText style={styles.pageSubtitle}>Browse and purchase products from this store</ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ThemedText style={styles.loadingText}>Loading…</ThemedText>
        ) : products.length === 0 ? (
          <ThemedText style={styles.emptyText}>No products yet</ThemedText>
        ) : (
          products.map((item) => {
            const avg = item.averageRating ?? 0;
            return (
              <View key={item._id} style={styles.productCard}>
                {item.images && item.images[0] ? (
                  <Image source={{ uri: item.images[0] }} style={styles.productImage} />
                ) : (
                  <View style={[styles.productImage, styles.productImagePlaceholder]}>
                    <IconSymbol name="photo" size={32} color="#ccc" />
                  </View>
                )}
                <View style={styles.productInfo}>
                  <ThemedText style={styles.productName} numberOfLines={1}>
                    {item.title}
                  </ThemedText>
                  <ThemedText style={styles.productPrice}>${item.price.toFixed(2)}</ThemedText>
                  <ThemedText style={styles.productStock}>{`Stock: ${item.stock ?? 0}`}</ThemedText>
                  <View style={styles.ratingRow}>
                    {renderStars(avg)}
                    <ThemedText style={styles.ratingText}>{`${avg.toFixed(1)} rating`}</ThemedText>
                  </View>
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() =>
                        router.push({
                          pathname: '/product/[productId]',
                          params: { productId: item._id },
                        })
                      }
                    >
                      <ThemedText style={styles.secondaryButtonText}>
                        View
                      </ThemedText>
                    </Pressable>
                    {!isOwner && (
                      <Pressable
                        style={[styles.cartButton, (item.stock ?? 0) <= 0 && { opacity: 0.6 }]}
                        onPress={() => openQtyModal(item)}
                        disabled={(item.stock ?? 0) <= 0}
                      >
                        <ThemedText style={styles.cartButtonText}>Add to cart</ThemedText>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      <Modal visible={qtyModalVisible} transparent animationType="fade" onRequestClose={() => setQtyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Add to cart</ThemedText>
            <ThemedText style={styles.modalSubtitle}>{selectedProduct?.title ?? ''}</ThemedText>
            <TextInput
              style={styles.modalInput}
              value={qtyValue}
              onChangeText={setQtyValue}
              keyboardType="numeric"
              placeholder="Quantity"
            />
            {selectedProduct && (
              <ThemedText style={styles.modalTotal}>
                {`Total: $${(Number(qtyValue || '0') * selectedProduct.price || 0).toFixed(2)}`}
              </ThemedText>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalButton} onPress={() => setQtyModalVisible(false)}>
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={confirmQty}>
                <ThemedText style={styles.modalButtonPrimaryText}>Confirm</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  pageSubtitle: {
    marginTop: 4,
    color: '#666',
  },
  list: {
    paddingHorizontal: 8,
    paddingBottom: 24,
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    width: '48%',
    marginBottom: 8,
    maxHeight: 280,
  },
  productImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  productImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 10,
    gap: 4,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  productStock: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    marginTop: -3
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: -5,
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  ratingText: {
    color: '#666',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 1,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: brandYellow,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#1A1A1A',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 13,
  },
  cartButton: {
    backgroundColor: '#F8E8B0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#555',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  modalTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  modalButtonPrimary: {
    backgroundColor: brandYellow,
  },
  modalButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  modalButtonPrimaryText: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
});

