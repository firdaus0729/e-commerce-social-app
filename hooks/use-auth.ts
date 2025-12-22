import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/lib/api';
import { User } from '@/types';

const TOKEN_KEY = 'auth_token';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (Platform.OS === 'web') {
          setLoading(false);
          return;
        }
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!token) {
          setLoading(false);
          return;
        }
        const me = await api.get<User>('/auth/me', token);
        setUser({ ...me, token });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setError(null);
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    if (Platform.OS !== 'web') {
      await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    }
    const nextUser: User = { ...res.user, token: res.token };
    setUser(nextUser);
    return nextUser;
  };

  const register = async (name: string, email: string, password: string): Promise<User> => {
    setError(null);
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/register', {
        name,
        email,
        password,
      });
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(TOKEN_KEY, res.token);
      }
      const nextUser: User = { ...res.user, token: res.token };
      setUser(nextUser);
      return nextUser;
    } catch (err: any) {
      setError(err.message);
      Alert.alert('Register failed', err.message ?? 'Request failed');
      throw err;
    }
  };

  const logout = async () => {
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    setUser(null);
  };

  const updateUser = async (token: string) => {
    try {
      const me = await api.get<User>('/auth/me', token);
      setUser({ ...me, token });
    } catch (err: any) {
      console.error('Failed to update user:', err);
    }
  };

  return { user, loading, error, login, register, logout, updateUser };
};

