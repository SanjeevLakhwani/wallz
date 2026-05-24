import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  decoded: boolean;
  code: string | null;
}

export function AROverlay({ visible, decoded, code }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      <Animated.View style={[styles.rings, { transform: [{ scale: pulse }] }]}>
        <View style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringMid]} />
        <View style={[styles.ring, styles.ringInner]} />
        <Text style={styles.label}>{decoded ? 'READING' : 'RING TAG'}</Text>
      </Animated.View>
      {decoded && code && <Text style={styles.code}>{code}</Text>}
    </Animated.View>
  );
}

const PURPLE = '#7c3aed';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rings: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  ringOuter: { width: 120, height: 120, borderColor: `${PURPLE}44` },
  ringMid: { width: 84, height: 84, borderColor: `${PURPLE}88` },
  ringInner: { width: 52, height: 52, borderColor: `${PURPLE}cc` },
  label: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  code: {
    color: PURPLE,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 10,
  },
});
