import type { ComponentProps, ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
import { colors } from '../theme/colors';
import { FadeIn, PressableScale } from './motion';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Field({
  label,
  error,
  icon,
  style,
  ...input
}: TextInputProps & { label: string; error?: string; icon?: IconName }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          placeholderTextColor={colors.muted}
          style={[styles.input, icon ? styles.inputIconPad : null, style]}
          {...input}
        />
        {icon ? <Ionicons color={colors.muted} name={icon} size={18} style={styles.fieldIcon} /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = 'lime',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'lime' | 'blue';
}) {
  const blue = tone === 'blue';
  return (
    <PressableScale
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, blue ? styles.buttonBlue : null, disabled ? styles.buttonDisabled : null]}
    >
      <Text style={[styles.buttonLabel, blue ? styles.buttonLabelBlue : null]}>{label}</Text>
    </PressableScale>
  );
}

export function SecondaryButton({
  label,
  onPress,
  tone = 'ink',
  outline = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'ink' | 'light';
  outline?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.secondary, outline ? styles.secondaryOutline : null]}
    >
      <Text style={[styles.secondaryLabel, tone === 'light' ? styles.secondaryLight : null]}>{label}</Text>
    </Pressable>
  );
}

export function Screen({ children, tone = 'canvas' }: { children: ReactNode; tone?: 'canvas' | 'ink' }) {
  return (
    <View style={[styles.screen, tone === 'ink' ? styles.screenInk : null]}>
      <FadeIn>{children}</FadeIn>
    </View>
  );
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
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} tintColor={colors.ink} />
        ) : undefined
      }
      style={styles.scroll}
    >
      <FadeIn>{children}</FadeIn>
    </ScrollView>
  );
}

export function ListCard({
  title,
  lines,
  onPress,
  unread,
  icon = 'storefront-outline',
}: {
  title: string;
  lines: string[];
  onPress?: () => void;
  unread?: boolean;
  icon?: IconName;
}) {
  const content = (
    <View style={[styles.card, unread ? styles.cardUnread : null]}>
      <View>
        <View style={styles.cardIcon}>
          <Ionicons color={colors.ink} name={icon} size={20} />
        </View>
        {unread ? <View style={styles.unreadDot} /> : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{title}</Text>
        {lines.map((line, index) => (
          <Text key={`${index}-${line}`} style={styles.cardLine}>
            {line}
          </Text>
        ))}
      </View>
      {onPress ? <Ionicons color={colors.muted} name="chevron-forward" size={18} /> : null}
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
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  screenInk: {
    backgroundColor: colors.ink,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputShell: {
    position: 'relative',
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  inputIconPad: {
    paddingRight: 44,
  },
  fieldIcon: {
    position: 'absolute',
    right: 16,
    top: 17,
  },
  error: {
    color: colors.danger,
    marginTop: 8,
  },
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.lime,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 56,
    paddingHorizontal: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonBlue: {
    backgroundColor: colors.blue,
  },
  buttonLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonLabelBlue: {
    color: colors.white,
    textAlign: 'center',
  },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 44,
  },
  secondaryOutline: {
    alignSelf: 'stretch',
    borderColor: colors.white,
    borderRadius: 999,
    borderWidth: 1.5,
    minHeight: 56,
  },
  secondaryLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryLight: {
    color: colors.white,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
  cardUnread: {
    borderColor: colors.line,
    borderWidth: 1,
  },
  unreadDot: {
    backgroundColor: colors.ink,
    borderColor: colors.card,
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: -2,
    top: -2,
    width: 12,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: colors.lime,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardLine: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
});
