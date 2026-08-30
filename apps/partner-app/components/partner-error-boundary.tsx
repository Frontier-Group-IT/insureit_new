import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { PartnerButton } from '@/components/ui/partner-button';
import { partnerTheme } from '@/lib/theme';
import { reportPartnerError } from '@/lib/partner-observability';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class PartnerErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportPartnerError(error, {
      area: 'app-shell',
      operation: 'render',
      recoverable: true,
      metadata: {
        componentStack: info.componentStack || '',
      },
    });
  }

  private recover = () => {
    this.setState({ hasError: false });
  };

  private returnHome = () => {
    this.setState({ hasError: false }, () => {
      router.replace('/');
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View
        accessibilityLiveRegion="assertive"
        accessibilityRole="alert"
        style={styles.screen}
      >
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            We could not open this screen
          </Text>
          <Text style={styles.message}>
            Your session is still safe. Try reopening the screen. If the problem continues, close and reopen INSUREIT Partner.
          </Text>
          <View style={styles.actions}>
            <View style={styles.action}>
              <PartnerButton label="Try again" onPress={this.recover} />
            </View>
            <View style={styles.action}>
              <PartnerButton label="Return to Home" variant="secondary" onPress={this.returnHome} />
            </View>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: partnerTheme.spacing.xl,
    backgroundColor: partnerTheme.colors.canvas,
  },
  card: {
    borderRadius: partnerTheme.radius.xl,
    padding: partnerTheme.spacing.xl,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  title: {
    color: partnerTheme.colors.ink,
    ...partnerTheme.typography.sectionTitle,
  },
  message: {
    marginTop: partnerTheme.spacing.sm,
    marginBottom: partnerTheme.spacing.lg,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.body,
  },
  actions: {
    gap: partnerTheme.spacing.sm,
  },
  action: {
    minHeight: partnerTheme.control.minTouchTarget,
  },
});
