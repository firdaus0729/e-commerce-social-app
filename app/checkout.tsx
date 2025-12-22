import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { Cart, CartItem } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { brandYellow } from '@/constants/theme';

export default function CheckoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProvider] = useState<'paypal'>('paypal');
  const [processing, setProcessing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    loadCart();
  }, [user?.token]);

  const loadCart = async () => {
    if (!user?.token) return;
    try {
      const data = await api.get<Cart>('/cart', user.token);
      setCart(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load cart');
    }
  };

  const subtotal = cart?.items?.reduce(
    (sum, item: CartItem) => sum + (item.product?.price ?? 0) * item.quantity,
    0
  ) ?? 0;
  const platformFee = Math.round((subtotal * 0.05) * 100) / 100; // 5% platform fee
  const total = subtotal+platformFee;

  const handleCheckout = async () => {
    if (!user?.token) {
      return Alert.alert('Login Required', 'Please log in to checkout');
    }

    setProcessing(true);
    try {
      const response = await api.post<{
        orderId: string;
        paypalOrderId?: string;
        approvalUrl?: string;
        amount: number;
        currency: string;
      }>('/payments/checkout/create-intent', {}, user.token);

      setOrderId(response.orderId);

      // In a real app, open PayPal approval URL in WebView
      Alert.alert(
        'PayPal Payment',
        'PayPal order created. In production, open PayPal approval URL in WebView.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Simulate Success',
            onPress: () => confirmPayment(response.orderId, response.paypalOrderId || ''),
          },
        ]
      );
    } catch (err: any) {
      const errorCode = err.response?.data?.code;
      const errorMessage = err.response?.data?.message || err.message;

      switch (errorCode) {
        case 'SELLER_PAYPAL_NOT_CONFIGURED':
          Alert.alert(
            'Payment Unavailable',
            'This seller has not set up PayPal payments. Please contact them directly or try another seller.',
            [{ text: 'OK' }]
          );
          break;
        
        case 'BUYER_PAYPAL_NOT_LINKED':
          Alert.alert(
            'PayPal Account Required',
            'Please link your PayPal account in profile settings to checkout.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Link PayPal', 
                onPress: () => router.push('/(tabs)/profile')
              }
            ]
          );
          break;
        
        case 'INVALID_EMAIL':
        case 'INVALID_FORMAT':
          Alert.alert(
            'Invalid Email',
            'Please enter a valid PayPal email address in your profile settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Go to Profile', 
                onPress: () => router.push('/(tabs)/profile')
              }
            ]
          );
          break;
        
        default:
          Alert.alert(
            'Payment Error',
            errorMessage || 'Failed to process payment. Please try again later.'
          );
      }
    } finally {
      setProcessing(false);
    }
  };

  const confirmPayment = async (orderId: string, paymentIntentId: string) => {
    if (!user?.token) return;
    setProcessing(true);
    try {
      const response = await api.post<{ success: boolean; order: any; payment: any }>(
        '/payments/checkout/confirm',
        { orderId, paymentIntentId },
        user.token
      );

      if (response.success) {
        Alert.alert('Success', 'Payment successful! Your order has been placed.', [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/(tabs)/cart');
            },
          },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'Failed to confirm payment');
    } finally {
      setProcessing(false);
    }
  };

  if (!cart || cart.items.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header showSearch />
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>Your cart is empty</ThemedText>
          <Pressable style={styles.shopButton} onPress={() => router.back()}>
            <ThemedText style={styles.shopButtonText}>Continue Shopping</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header showSearch />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Checkout</ThemedText>

        {/* Order Summary */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Order Summary</ThemedText>
          {cart.items.map((item: CartItem) => (
            <View key={item.product._id} style={styles.orderItem}>
              {item.product.images && item.product.images[0] ? (
                <Image source={{ uri: item.product.images[0] }} style={styles.productImage} />
              ) : (
                <View style={[styles.productImage, styles.productImagePlaceholder]}>
                  <MaterialIcons name="image" size={24} color="#ccc" />
                </View>
              )}
              <View style={styles.orderItemInfo}>
                <ThemedText style={styles.productName}>{item.product.title}</ThemedText>
                <ThemedText style={styles.productPrice}>
                  ${item.product.price.toFixed(2)} × {item.quantity}
                </ThemedText>
              </View>
              <ThemedText style={styles.itemTotal}>
                ${(item.product.price * item.quantity).toFixed(2)}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Payment Breakdown */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Payment Breakdown</ThemedText>
          <View style={styles.breakdownRow}>
            <ThemedText style={styles.breakdownLabel}>Subtotal</ThemedText>
            <ThemedText style={styles.breakdownValue}>${subtotal.toFixed(2)}</ThemedText>
          </View>
          <View style={styles.breakdownRow}>
            <ThemedText style={styles.breakdownLabel}>Platform Fee (5%)</ThemedText>
            <ThemedText style={styles.breakdownValue}>${platformFee.toFixed(2)}</ThemedText>
          </View>
          <View style={[styles.breakdownRow, styles.totalRow]}>
            <ThemedText style={styles.totalLabel}>Total</ThemedText>
            <ThemedText style={styles.totalValue}>${total.toFixed(2)}</ThemedText>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Payment Method</ThemedText>
          <Pressable style={[styles.paymentMethod, styles.paymentMethodSelected]}>
            <MaterialIcons name="radio-button-checked" size={24} color={brandYellow} />
            <View style={styles.paymentMethodInfo}>
              <ThemedText style={styles.paymentMethodName}>PayPal</ThemedText>
              <ThemedText style={styles.paymentMethodDesc}>Pay with your PayPal account</ThemedText>
            </View>
            <MaterialIcons name="lock" size={20} color="#666" />
          </Pressable>
        </View>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <MaterialIcons name="security" size={16} color="#666" />
          <ThemedText style={styles.securityText}>
            Your payment is secure. Platform fee (5%) is deducted, remainder goes to seller's wallet.
          </ThemedText>
        </View>

        {/* Checkout Button */}
        <Pressable
          style={[styles.checkoutButton, processing && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#1A1A1A" />
          ) : (
            <ThemedText style={styles.checkoutButtonText}>
              Pay ${total.toFixed(2)}
            </ThemedText>
          )}
        </Pressable>
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
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  shopButton: {
    backgroundColor: brandYellow,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 24,
  },
  section: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  productImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderItemInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 12,
    color: '#666',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    gap: 12,
  },
  paymentMethodSelected: {
    borderColor: brandYellow,
    backgroundColor: '#FFF9E6',
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  paymentMethodDesc: {
    fontSize: 12,
    color: '#666',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  checkoutButton: {
    backgroundColor: brandYellow,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  checkoutButtonDisabled: {
    opacity: 0.6,
  },
  checkoutButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});

