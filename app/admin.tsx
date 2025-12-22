import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { AdminProductSummary, AdminTransaction } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { brandYellow } from '@/constants/theme';

type AdminTab = 'products' | 'transactions' | 'settings';

export default function AdminScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('products');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<AdminProductSummary[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  
  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    // Non-admins are pushed back to the main app
    if (!authLoading && user && user.role !== 'admin') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  // Handle back button - redirect to login page
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/auth/login');
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [router]);

  useEffect(() => {
    if (!user?.token || user.role !== 'admin') return;
    const load = async () => {
      try {
        setLoading(true);
        const [prod, tx] = await Promise.all([
          api.get<AdminProductSummary[]>('/admin/products', user.token),
          api.get<AdminTransaction[]>('/admin/transactions', user.token),
        ]);
        setProducts(prod);
        setTransactions(tx);
      } catch (err) {
        console.warn('Failed to load admin data', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.token, user?.role]);

  const sortedProducts = useMemo(
    () => products.slice().sort((a, b) => a.title.localeCompare(b.title)),
    [products]
  );

  const renderAvatar = (photo?: string, size: number = 32) => {
    if (photo) {
      return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    }
    return <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]} />;
  };

  const renderProducts = () => (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {sortedProducts.length === 0 && !loading && (
        <ThemedText style={styles.emptyText}>No products found yet.</ThemedText>
      )}
      {sortedProducts.map((p) => (
        <View key={p.id} style={styles.card}>
          <View style={styles.cardHeader}>
            {p.image ? (
              <Image source={{ uri: p.image }} style={styles.productImage} />
            ) : (
              <View style={[styles.productImage, styles.productImagePlaceholder]} />
            )}
            <View style={styles.cardHeaderInfo}>
              <ThemedText style={styles.cardTitle} numberOfLines={1}>
                {p.title}
              </ThemedText>
              <ThemedText style={styles.cardSubtitle}>{`$${p.price.toFixed(2)}`}</ThemedText>
              {p.seller && (
                <View style={styles.row}>
                  {renderAvatar(p.seller.profilePhoto, 24)}
                  <ThemedText style={styles.metaText}>{`Seller: ${p.seller.name}`}</ThemedText>
                </View>
              )}
            </View>
          </View>

          {p.buyers.length > 0 && (
            <View style={styles.buyersSection}>
              <ThemedText style={styles.sectionLabel}>{`Buyers (${p.buyers.length})`}</ThemedText>
              {p.buyers.map((b) => (
                <View key={b.id} style={styles.buyerRow}>
                  {renderAvatar(b.profilePhoto, 24)}
                  <View style={styles.buyerInfo}>
                    <ThemedText style={styles.buyerName}>{b.name}</ThemedText>
                    {b.email && <ThemedText style={styles.buyerEmail}>{b.email}</ThemedText>}
                  </View>
                </View>
              ))}
            </View>
          )}
          {p.buyers.length === 0 && (
            <ThemedText style={styles.metaMuted}>No buyers for this product yet.</ThemedText>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const renderTransactions = () => (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {transactions.length === 0 && !loading && (
        <ThemedText style={styles.emptyText}>No transactions yet.</ThemedText>
      )}
      {transactions.map((t) => {
        const date = new Date(t.createdAt);
        const dateLabel = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const amount = `${t.currency || 'USD'} ${t.total.toFixed(2)}`;
        const paymentLabel = t.paymentProvider ? t.paymentProvider.toUpperCase() : 'Unknown';

        return (
          <View key={t.id} style={styles.card}>
            <View style={styles.transactionRow}>
              <View style={styles.transactionParty}>
                <ThemedText style={styles.sectionLabel}>Seller</ThemedText>
                {t.seller ? (
                  <View style={styles.partyRow}>
                    {renderAvatar(t.seller.profilePhoto)}
                    <ThemedText style={styles.partyName}>{t.seller.name}</ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.metaMuted}>N/A</ThemedText>
                )}
              </View>

              <View style={styles.transactionParty}>
                <ThemedText style={styles.sectionLabel}>Buyer</ThemedText>
                {t.buyer ? (
                  <View style={styles.partyRow}>
                    {renderAvatar(t.buyer.profilePhoto)}
                    <ThemedText style={styles.partyName}>{t.buyer.name}</ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.metaMuted}>Guest</ThemedText>
                )}
              </View>
            </View>

            <View style={styles.transactionMetaRow}>
              <ThemedText style={styles.amountText}>{amount}</ThemedText>
              <ThemedText style={styles.paymentType}>{paymentLabel}</ThemedText>
            </View>
            <ThemedText style={styles.dateText}>{dateLabel}</ThemedText>
          </View>
        );
      })}
    </ScrollView>
  );

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (!user?.token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/auth/change-password', { oldPassword, newPassword }, user.token);
      Alert.alert('Success', 'Password changed successfully', [
        {
          text: 'OK',
          onPress: () => {
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.settingsContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.settingsCard}>
        <ThemedText style={styles.settingsTitle}>Change Password</ThemedText>
        <ThemedText style={styles.settingsSubtitle}>
          Update your admin password to enhance security.
        </ThemedText>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Current Password</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Enter current password"
            placeholderTextColor="#999"
            secureTextEntry
            value={oldPassword}
            onChangeText={setOldPassword}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>New Password</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Enter new password (min. 6 characters)"
            placeholderTextColor="#999"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Confirm New Password</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor="#999"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
        </View>

        <Pressable
          style={[styles.changePasswordButton, changingPassword && styles.buttonDisabled]}
          onPress={handleChangePassword}
          disabled={changingPassword}
        >
          {changingPassword ? (
            <ActivityIndicator size="small" color="#1A1A1A" />
          ) : (
            <ThemedText style={styles.changePasswordButtonText}>Change Password</ThemedText>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );

  if (authLoading) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Admin', headerShown: false }} />
        <ActivityIndicator size="large" color={brandYellow} />
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ title: 'Admin', headerShown: false }} />
        <ThemedText style={styles.emptyText}>Please log in as admin to view this page.</ThemedText>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/auth/login')}>
          <ThemedText style={styles.primaryButtonText}>Go to login</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Admin', headerShown: false }} />
      <Header 
        showBack={true}
        onBackPress={() => router.replace('/auth/login')}
      />

      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>Admin dashboard</ThemedText>
        <ThemedText style={styles.pageSubtitle}>
          Manage products and monitor transaction history.
        </ThemedText>
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabButton, activeTab === 'products' && styles.tabButtonActive]}
          onPress={() => setActiveTab('products')}
        >
          <ThemedText
            style={[styles.tabLabel, activeTab === 'products' && styles.tabLabelActive]}
          >
            Products
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'transactions' && styles.tabButtonActive]}
          onPress={() => setActiveTab('transactions')}
        >
          <ThemedText
            style={[styles.tabLabel, activeTab === 'transactions' && styles.tabLabelActive]}
          >
            Transactions
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'settings' && styles.tabButtonActive]}
          onPress={() => setActiveTab('settings')}
        >
          <ThemedText
            style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}
          >
            Settings
          </ThemedText>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={brandYellow} />
        </View>
      )}

      {activeTab === 'products' && renderProducts()}
      {activeTab === 'transactions' && renderTransactions()}
      {activeTab === 'settings' && renderSettings()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFEF9',
    padding: 24,
    gap: 16,
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  pageSubtitle: {
    marginTop: 4,
    color: '#666',
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: brandYellow,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  tabLabelActive: {
    color: '#1A1A1A',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 10,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  productImagePlaceholder: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardHeaderInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#555',
  },
  metaMuted: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
  },
  buyersSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 8,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  buyerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  buyerInfo: {
    flex: 1,
  },
  buyerName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  buyerEmail: {
    fontSize: 11,
    color: '#777',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  transactionParty: {
    flex: 1,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  partyName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  transactionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  paymentType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
  },
  dateText: {
    marginTop: 4,
    fontSize: 12,
    color: '#777',
  },
  avatarFallback: {
    backgroundColor: '#E0E0E0',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  loadingOverlay: {
    paddingVertical: 6,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: brandYellow,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  settingsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  settingsSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#1A1A1A',
  },
  changePasswordButton: {
    backgroundColor: brandYellow,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  changePasswordButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

