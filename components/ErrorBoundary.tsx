import React from 'react';
import { View, StyleSheet, Text, Pressable, DevSettings } from 'react-native';

type State = {
  hasError: boolean;
  error?: Error | null;
};

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // You could send this to an external logging service here
    // console.error(error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children as any;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{String(this.state.error ?? 'An unexpected error occurred')}</Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            try {
              if (DevSettings && typeof DevSettings.reload === 'function') {
                DevSettings.reload();
              }
            } catch (e) {
              // noop
            }
          }}
        >
          <Text style={styles.buttonText}>Reload app</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  message: {
    color: '#444',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ErrorBoundary;
