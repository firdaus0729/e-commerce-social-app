import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { MaterialIcons } from '@expo/vector-icons';
import { brandYellow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: brandYellow,
        tabBarInactiveTintColor: '#9BA1A6',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#FFFEF9',
          borderTopWidth: 1,
          borderTopColor: 'rgba(0,0,0,0.05)',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons name="home-filled" size={24} color={focused ? '#000000' : '#9BA1A6'} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Store',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons name="storefront" size={24} color={focused ? '#000000' : '#9BA1A6'} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons name="shopping-cart" size={24} color={focused ? '#000000' : '#9BA1A6'} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Live Streaming',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons name="live-tv" size={24} color={focused ? '#000000' : '#9BA1A6'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons name="person" size={24} color={focused ? '#000000' : '#9BA1A6'} />
          ),
        }}
      />
    </Tabs>
  );
}
