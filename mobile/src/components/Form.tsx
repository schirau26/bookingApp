import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

export function Field({
  label,
  error,
  ...input
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        placeholderTextColor="#8a8175"
        style={styles.input}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled ? styles.buttonDisabled : null]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondary}>
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function ScrollScreen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} />
        ) : undefined
      }
      style={styles.scroll}
    >
      {children}
    </ScrollView>
  );
}

export function ListCard({
  title,
  lines,
  onPress,
}: {
  title: string;
  lines: string[];
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`} style={styles.cardLine}>
          {line}
        </Text>
      ))}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f4ef',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#3f3832',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e4ddd2',
    borderRadius: 12,
    borderWidth: 1,
    color: '#1c1915',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  error: {
    color: '#7f1d1d',
    marginTop: 8,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#1c1915',
    borderRadius: 12,
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondary: {
    alignItems: 'center',
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: '#1c1915',
    fontSize: 16,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f6f4ef',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e4ddd2',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  cardTitle: {
    color: '#1c1915',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardLine: {
    color: '#3f3832',
    fontSize: 15,
    lineHeight: 22,
  },
});
