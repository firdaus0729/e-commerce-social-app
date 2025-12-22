import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { brandYellow } from '@/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name || !email || !password) {
      return setError('Please fill all fields.');
    }
    if (password !== confirm) {
      return setError('Passwords do not match.');
    }
    const emailValid = /\S+@\S+\.\S+/.test(email);
    if (!emailValid) {
      return setError('Please enter a valid email address.');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const created = await register(name.trim(), email.trim(), password);
      setSuccess('Account created successfully. Welcome!');
      // Route admins to the dedicated admin page, others to the main app
      if (created.role === 'admin') {
        router.replace('/admin' as any);
      } else {
        router.replace('/');
      }
    } catch (err: any) {
      const message =
        err?.message === 'Email already registered'
          ? 'An account with this email already exists.'
          : 'Unable to create your account. Please try again.';
      setError(message);
      // Do not auto-redirect; user can tap "Have an account? Log in"
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Create account', headerShown: false }} />
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>Join Live Shop</ThemedText>
        <ThemedText style={styles.subtitle}>Buy, follow live streams, and open your own store.</ThemedText>
      </View>

      {success && (
        <ThemedView style={styles.successBox}>
          <ThemedText style={styles.successText}>{success}</ThemedText>
        </ThemedView>
      )}

      {error && (
        <ThemedView style={styles.errorBox}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      )}

      <TextInput
        placeholder="Full name"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        placeholder="Email"
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        placeholder="Confirm password"
        style={styles.input}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />

      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={onSubmit} disabled={loading}>
        <ThemedText type="defaultSemiBold" style={styles.buttonText}>
          {loading ? 'Creating…' : 'Create account'}
        </ThemedText>
      </Pressable>

      <Pressable onPress={() => router.push('/auth/login')} style={styles.linkButton}>
        <ThemedText style={styles.linkText}>Have an account? Log in</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
    backgroundColor: '#FFFEF9',
  },
  header: {
    marginTop: 60,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  input: {
    borderWidth: 2,
    borderColor: brandYellow,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 8,
    backgroundColor: brandYellow,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  linkText: {
    color: brandYellow,
    fontSize: 14,
    fontWeight: '600',
  },
  successBox: {
    backgroundColor: '#f6ffed',
    borderColor: '#b7eb8f',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
  },
  successText: { color: '#237804' },
  errorBox: {
    backgroundColor: '#fff1f0',
    borderColor: '#ffccc7',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
  },
  errorText: { color: '#a8071a' },
});

