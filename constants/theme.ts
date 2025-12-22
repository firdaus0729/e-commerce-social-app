/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Demisand brand colors
export const brandYellow = '#FFD700';
export const brandYellowLight = '#FFF9E6';
export const brandDark = '#1A1A1A';

const tintColorLight = brandYellow;
const tintColorDark = brandYellow;

export const Colors = {
  light: {
    text: '#1A1A1A',
    background: '#FFFEF9', // Slight yellow tint
    tint: brandYellow,
    icon: '#687076',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: brandYellow,
    cardBackground: '#FFFFFF',
    border: 'rgba(0,0,0,0.08)',
    secondaryText: '#666666',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: brandYellow,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: brandYellow,
    cardBackground: '#1F1F1F',
    border: 'rgba(255,255,255,0.1)',
    secondaryText: '#9BA1A6',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
