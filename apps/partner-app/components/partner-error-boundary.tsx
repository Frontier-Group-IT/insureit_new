import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PartnerButton } from '@/components/ui/partner-button';
import { partnerTheme } from '@/lib/theme';

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
    if (__DEV__) {
      console.error('Partner app render error', error, info.componentStack);
    }
  }

  private recover = () => {
    this.setState({ hasError: false });
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
          <PartnerButton label="Try again" onPress={this.recover} />
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
});
