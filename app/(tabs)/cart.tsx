import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { Cart, CartItem } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { brandYellow } from '@/constants/theme';

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!user?.token) return;
    setRefreshing(true);
    try {
      const data = await api.get<Cart>('/cart', user.token);
      setCart(data);
    } catch (err: any) {
      Alert.alert('Cart', err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const checkout = async () => {
    if (!user?.token) return Alert.alert('Login required');
    try {
      await api.post('/orders', {}, user.token);
      Alert.alert('Success', 'Order placed (payment stub).');
      load();
    } catch (err: any) {
      Alert.alert('Checkout', err.message);
    }
  };

  useEffect(() => {
    load();
  }, [user?.token]);

  const total = cart?.items?.reduce(
    (sum, item: CartItem) => sum + (item.product?.price ?? 0) * item.quantity,
    0
  );

  return (
    <ThemedView style={styles.container}>
      <Header showSearch />
      <FlatList
        data={cart?.items ?? []}
        keyExtractor={(item) => item.product._id}
        ListHeaderComponent={
          <ThemedView style={styles.header}>
            <ThemedText type="title">Your cart</ThemedText>
            <ThemedText>Authenticated carts only. Add items from feed.</ThemedText>
          </ThemedView>
        }
      renderItem={({ item }) => (
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">{item.product.title}</ThemedText>
          <ThemedText>
            {`${item.quantity} × $${item.product.price.toFixed(2)} = $${(item.quantity * item.product.price).toFixed(2)}`}
          </ThemedText>
          <Pressable
            onPress={async () => {
              if (!user?.token) return;
              try {
                await api.delete(`/cart/items/${item.product._id}`, user.token);
                load();
              } catch (err: any) {
                Alert.alert('Error', err.message);
              }
            }}
          >
            <ThemedText type="link" style={{ color: '#a8071a', marginTop: 8 }}>
              Remove
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}
        ListFooterComponent={
          <ThemedView style={{ marginTop: 16, gap: 6 }}>
            <ThemedText type="subtitle">{`Total: $${total?.toFixed(2) ?? '0.00'}`}</ThemedText>
            {cart && cart.items.length > 0 && (
              <Pressable
                style={styles.checkoutButton}
                onPress={() => router.push('/checkout')}
              >
                <ThemedText style={styles.checkoutButtonText}>
                  Proceed to Checkout
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.list}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  list: { padding: 16, gap: 12 },
  header: { marginBottom: 12, gap: 6 },
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 8,
    gap: 4,
  },
  checkoutButton: {
    backgroundColor: brandYellow,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  checkoutButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 16,
  },
});

