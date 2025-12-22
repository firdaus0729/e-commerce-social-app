/* eslint-disable */
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { Product, Store } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { brandYellow } from '@/constants/theme';
import { API_URL } from '@/constants/config';

export default function StoreDetailScreen() {
  const router = useRouter();
  const { storeId, slug } = useLocalSearchParams<{ storeId: string; slug: string }>();
  const { user } = useAuth();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ productsSold: number; walletBalance: number } | null>(null);

  const [editingStoreName, setEditingStoreName] = useState('');
  const [editingStoreDesc, setEditingStoreDesc] = useState('');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productImage, setProductImage] = useState('');
  const [productImageUri, setProductImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [qtyValue, setQtyValue] = useState('1');
  const [selectedProductForCart, setSelectedProductForCart] = useState<Product | null>(null);

  const isOwner = !!user?.token && store?.owner?.toString() === user.id;

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      // Try to get by ID first, fallback to slug if provided
      let s: Store;
      try {
        s = await api.get<Store>(`/stores/id/${storeId}`);
      } catch {
        if (slug) {
          s = await api.get<Store>(`/stores/${slug}`);
        } else {
          throw new Error('Store not found');
        }
      }
      const p = await api.get<Product[]>(`/products?store=${storeId}`);
      setStore(s);
      setProducts(p);
      setEditingStoreName(s.name);
      setEditingStoreDesc(s.description ?? '');
      
      // Load stats if owner
      if (user?.token && s.owner?.toString() === user.id) {
        try {
          const storeStats = await api.get<{ productsSold: number; walletBalance: number; totalRevenue: number }>(
            `/stores/${storeId}/stats`,
            user.token
          );
          setStats(storeStats);
        } catch (err) {
          console.log('Stats not available');
        }
      }
    } catch (err: any) {
      Alert.alert('Store', err.message ?? 'Failed to load store');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId]);

  const saveStore = async () => {
    if (!user?.token || !storeId) return Alert.alert('Login required');
    try {
      const updated = await api.patch<Store>(
        `/stores/${storeId}`,
        { name: editingStoreName, description: editingStoreDesc },
        user.token
      );
      setStore(updated);
      Alert.alert('Success', 'Store updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const deleteStore = async () => {
    if (!user?.token || !storeId) return Alert.alert('Login required');
    Alert.alert('Delete store', 'Delete this store and all its products?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/stores/${storeId}`, user.token);
            Alert.alert('Success', 'Store deleted.');
            router.back();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const pickProductImage = async () => {
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
       * Use a single enum value to satisfy both new (MediaType) and legacy
       * (MediaTypeOptions) APIs and avoid cast errors on Android.
       */
      mediaTypes: mediaType,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProductImageUri(result.assets[0].uri);
    }
  };

  const uploadProductImage = async (uri: string): Promise<string> => {
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

  const startCreateProduct = () => {
    setShowProductForm(true);
    setEditingProduct(null);
    setProductTitle('');
    setProductPrice('');
    setProductStock('10');
    setProductDescription('');
    setProductImage('');
    setProductImageUri(null);
  };

  const startEditProduct = (p: Product) => {
    setShowProductForm(true);
    setEditingProduct(p);
    setProductTitle(p.title);
    setProductPrice(String(p.price));
    setProductStock(p.stock !== undefined ? String(p.stock) : '10');
    setProductDescription(p.description ?? '');
    setProductImage(p.images?.[0] ?? '');
    setProductImageUri(null);
  };

  const addToCart = async (productId: string, quantity: number) => {
    if (!user?.token) {
      return Alert.alert('Login required', 'Please log in to add items to cart.');
    }
    try {
      await api.post('/cart/items', { productId, quantity }, user.token);
      Alert.alert('Cart', 'Added to cart');
    } catch (err: any) {
      Alert.alert('Cart', err.message || 'Failed to add to cart');
    }
  };

  const openQtyModal = (product: Product) => {
    setSelectedProductForCart(product);
    setQtyValue('1');
    setQtyModalVisible(true);
  };

  const confirmQtyAdd = () => {
    if (!selectedProductForCart) return;
    const qty = Number(qtyValue);
    if (Number.isNaN(qty) || qty <= 0) {
      return Alert.alert('Quantity', 'Enter a valid quantity (1 or more).');
    }
    addToCart(selectedProductForCart._id, qty);
    setQtyModalVisible(false);
  };

  const saveProduct = async () => {
    if (!user?.token) return Alert.alert('Login required');
    if (!productTitle.trim()) return Alert.alert('Product', 'Title is required');
    const numericPrice = Number(productPrice);
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      return Alert.alert('Product', 'Enter a valid price.');
    }
    const numericStock = Number(productStock);
    if (Number.isNaN(numericStock) || numericStock < 0) {
      return Alert.alert('Product', 'Enter a valid stock (0 or more).');
    }

    try {
      setUploading(true);
      let imageUrl = productImage;
      
      // Upload image if new one selected
      if (productImageUri) {
        imageUrl = await uploadProductImage(productImageUri);
      }

      if (editingProduct) {
        const updated = await api.patch<Product>(
          `/products/${editingProduct._id}`,
          {
            title: productTitle.trim(),
            price: numericPrice,
            stock: numericStock,
            description: productDescription.trim(),
            images: imageUrl ? [imageUrl] : [],
          },
          user.token
        );
        setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      } else {
        const created = await api.post<Product>(
          '/products',
          {
            title: productTitle.trim(),
            price: numericPrice,
            stock: numericStock,
            description: productDescription.trim(),
            images: imageUrl ? [imageUrl] : [],
          },
          user.token
        );
        setProducts((prev) => [created, ...prev]);
      }
      setUploading(false);
      startCreateProduct();
      Alert.alert('Success', editingProduct ? 'Product updated' : 'Product created');
    } catch (err: any) {
      setUploading(false);
      Alert.alert('Error', err.message);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user?.token) return Alert.alert('Login required');
    Alert.alert('Delete product', 'Delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/products/${id}`, user.token);
            setProducts((prev) => prev.filter((p) => p._id !== id));
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header showSearch rightAction={{ label: '+ Create Store', onPress: () => router.push('/store/create') }} />
        <ThemedText style={styles.loadingText}>Loading…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header showSearch rightAction={{ label: '+ Create Store', onPress: () => router.push('/store/create') }} />
      <View style={styles.tabBar}>
        <Pressable style={styles.tab} onPress={() => router.push('/(tabs)/explore')}>
          <ThemedText style={styles.tabText}>All Stores</ThemedText>
        </Pressable>
        <Pressable style={[styles.tab, styles.tabActive]}>
          <ThemedText style={[styles.tabText, styles.tabTextActive]}>My Store</ThemedText>
          <View style={styles.tabUnderline} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {store && (
          <>
            <View style={styles.storeHeader}>
              <View style={styles.storeLogoWrap}>
                {store.logo ? (
                  <Image source={{ uri: store.logo }} style={styles.storeLogoImage} />
                ) : (
                  <IconSymbol name="bolt.fill" size={28} color={brandYellow} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.storeName}>{store.name}</ThemedText>
                {store.description ? (
                  <ThemedText style={styles.storeDescription} numberOfLines={2}>
                    {store.description}
                  </ThemedText>
                ) : null}
              </View>
            </View>


            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>All Products</ThemedText>
                {isOwner && (
                  <View style={styles.sectionActions}>
                    <Pressable style={styles.actionButton} onPress={startCreateProduct}>
                      <ThemedText style={styles.actionButtonText}>Add Products</ThemedText>
                    </Pressable>
                    <Pressable style={styles.actionButton} onPress={() => setShowStoreForm((v) => !v)}>
                      <ThemedText style={styles.actionButtonText}>{showStoreForm ? 'Close Edit' : 'Edit Store'}</ThemedText>
                    </Pressable>
                  </View>
                )}
              </View>

              {isOwner && showStoreForm && (
                <View style={styles.productForm}>
                  <ThemedText style={styles.formTitle}>Edit Store</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={editingStoreName}
                    onChangeText={setEditingStoreName}
                    placeholder="Store name"
                  />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={editingStoreDesc}
                    onChangeText={setEditingStoreDesc}
                    placeholder="Description"
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.formActions}>
                    <Pressable style={[styles.saveButton, { flex: 1 }]} onPress={saveStore}>
                      <ThemedText style={styles.saveButtonText}>Save Store</ThemedText>
                    </Pressable>
                    <Pressable style={styles.cancelButton} onPress={() => setShowStoreForm(false)}>
                      <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                    </Pressable>
                  </View>
                </View>
              )}

              {isOwner && showProductForm && editingProduct === null && (
                <View style={styles.productForm}>
                  <ThemedText style={styles.formTitle}>Add New Product</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={productTitle}
                    onChangeText={setProductTitle}
                    placeholder="Product name *"
                  />
                  <TextInput
                    style={styles.input}
                    value={productPrice}
                    onChangeText={setProductPrice}
                    placeholder="Price *"
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    value={productStock}
                    onChangeText={setProductStock}
                    placeholder="Stock (e.g., 10)"
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={productDescription}
                    onChangeText={setProductDescription}
                    placeholder="Description"
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.imageUploadSection}>
                    <ThemedText style={styles.imageLabel}>Product Image</ThemedText>
                    <Pressable style={styles.imageUploadButton} onPress={pickProductImage}>
                      {productImageUri ? (
                        <Image source={{ uri: productImageUri }} style={styles.uploadedImage} />
                      ) : productImage ? (
                        <Image source={{ uri: productImage }} style={styles.uploadedImage} />
                      ) : (
                        <View style={styles.imageUploadPlaceholder}>
                          <IconSymbol name="photo" size={30} color="#ccc" />
                          <ThemedText style={styles.uploadText}>Tap to upload image</ThemedText>
                        </View>
                      )}
                    </Pressable>
                    {productImage && !productImageUri && (
                      <TextInput
                        style={[styles.input, { marginTop: 8 }]}
                        value={productImage}
                        onChangeText={setProductImage}
                        placeholder="Or enter image URL"
                      />
                    )}
                  </View>
                  <Pressable
                    style={[styles.saveButton, uploading && styles.buttonDisabled]}
                    onPress={saveProduct}
                    disabled={uploading}
                  >
                    <ThemedText style={styles.saveButtonText}>
                      {uploading ? 'Uploading…' : 'Save Product'}
                    </ThemedText>
                  </Pressable>
                </View>
              )}

              {isOwner && showProductForm && editingProduct && (
                <View style={styles.productForm}>
                  <ThemedText style={styles.formTitle}>Edit Product</ThemedText>
                  <TextInput
                    style={styles.input}
                    value={productTitle}
                    onChangeText={setProductTitle}
                    placeholder="Product name *"
                  />
                  <TextInput
                    style={styles.input}
                    value={productPrice}
                    onChangeText={setProductPrice}
                    placeholder="Price *"
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    value={productStock}
                    onChangeText={setProductStock}
                    placeholder="Stock (e.g., 10)"
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={productDescription}
                    onChangeText={setProductDescription}
                    placeholder="Description"
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.imageUploadSection}>
                    <ThemedText style={styles.imageLabel}>Product Image</ThemedText>
                    <Pressable style={styles.imageUploadButton} onPress={pickProductImage}>
                      {productImageUri ? (
                        <Image source={{ uri: productImageUri }} style={styles.uploadedImage} />
                      ) : productImage ? (
                        <Image source={{ uri: productImage }} style={styles.uploadedImage} />
                      ) : (
                        <View style={styles.imageUploadPlaceholder}>
                          <IconSymbol name="photo" size={30} color="#ccc" />
                          <ThemedText style={styles.uploadText}>Tap to upload image</ThemedText>
                        </View>
                      )}
                    </Pressable>
                    {productImage && !productImageUri && (
                      <TextInput
                        style={[styles.input, { marginTop: 8 }]}
                        value={productImage}
                        onChangeText={setProductImage}
                        placeholder="Or enter image URL"
                      />
                    )}
                  </View>
                  <View style={styles.formActions}>
                    <Pressable
                      style={[styles.saveButton, uploading && styles.buttonDisabled]}
                      onPress={saveProduct}
                      disabled={uploading}
                    >
                      <ThemedText style={styles.saveButtonText}>
                        {uploading ? 'Uploading…' : 'Update'}
                      </ThemedText>
                    </Pressable>
                    <Pressable style={styles.cancelButton} onPress={startCreateProduct}>
                      <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                    </Pressable>
                  </View>
                </View>
              )}

              {products.length === 0 ? (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyText}>No products yet</ThemedText>
                </View>
              ) : (
                <View style={styles.productsList}>
                  {products.map((item) => (
                    <View key={item._id} style={styles.productCard}>
                      {item.images && item.images[0] ? (
                        <Image source={{ uri: item.images[0] }} style={styles.productImage} />
                      ) : (
                        <View style={[styles.productImage, styles.productImagePlaceholder]}>
                          <IconSymbol name="photo" size={30} color="#ccc" />
                        </View>
                      )}
                      <View style={styles.productInfo}>
                        <ThemedText style={styles.productName} numberOfLines={1}>{item.title}</ThemedText>
                        <ThemedText style={styles.productPrice}>${item.price.toFixed(2)}</ThemedText>
                        <ThemedText style={styles.productStock}>{`Stock: ${item.stock ?? 0}`}</ThemedText>
                        <View style={styles.productActions}>
                          {isOwner && (
                            <Pressable style={styles.editButton} onPress={() => startEditProduct(item)}>
                              <ThemedText style={styles.editButtonText}>Edit</ThemedText>
                            </Pressable>
                          )}
                          {!isOwner && (
                            <Pressable
                              style={styles.cartButton}
                              onPress={() => openQtyModal(item)}
                              disabled={(item.stock ?? 0) <= 0}
                            >
                              <ThemedText style={styles.cartButtonText}>Add to cart</ThemedText>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={qtyModalVisible} transparent animationType="fade" onRequestClose={() => setQtyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Add to cart</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              {selectedProductForCart?.title ?? ''}
            </ThemedText>
            <TextInput
              style={styles.modalInput}
              value={qtyValue}
              onChangeText={setQtyValue}
              keyboardType="numeric"
              placeholder="Quantity"
            />
            {selectedProductForCart && (
              <ThemedText style={styles.modalTotal}>
                {`Total: $${(Number(qtyValue || '0') * selectedProductForCart.price || 0).toFixed(2)}`}
              </ThemedText>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalButton} onPress={() => setQtyModalVisible(false)}>
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={confirmQtyAdd}>
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
  scrollContent: {
    paddingBottom: 20,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#666',
  },
  summaryBanner: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#E9991A',
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    position: 'relative',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  summarySubLabel: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
  },
  summaryButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCircle: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF4D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  withdrawRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: brandYellow,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  withdrawText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFEF9',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabActive: {
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#777',
  },
  tabTextActive: {
    color: '#1A1A1A',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: 80,
    backgroundColor: brandYellow,
    borderRadius: 2,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  storeLogoWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF4D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLogoImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  storeDescription: {
    marginTop: 2,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: brandYellow,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  productForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1A1A1A',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: brandYellow,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 14,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  productsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 8,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  productStock: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  editButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  cartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8E8B0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cartButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
  },
  imageUploadSection: {
    marginBottom: 12,
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  imageUploadButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  imageUploadPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
