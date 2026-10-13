import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export function FadeIn({ children }: { children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(12));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

/** A short rise used when a list of cards should appear one after another. */
export function RiseIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(16));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        speed: 12,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

/** A small scale-in for a logo or hero mark. */
export function PopIn({ children }: { children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.86));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 12, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  return <Animated.View style={{ opacity, transform: [{ scale }] }}>{children}</Animated.View>;
}

export function PressableScale({
  children,
  style,
  disabled,
  ...pressable
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [scale] = useState(() => new Animated.Value(1));

  function pressIn() {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }

  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  }

  return (
    <Pressable
      {...pressable}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={{ alignSelf: 'stretch' }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled ? { opacity: 0.6 } : null]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
