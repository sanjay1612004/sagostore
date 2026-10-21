import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import { useIsFocused } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import type { SceneStyleInterpolators } from "expo-router/js-tabs";

export const navigationDuration = 240;
export const navigationEasing = Easing.out(Easing.cubic);

export function useNavigationReducedMotion() {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let subscribed = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        changed = true;
        setReduced(enabled);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (subscribed && !changed) setReduced(enabled);
      })
      .catch(() => {});
    return () => {
      subscribed = false;
      subscription?.remove();
    };
  }, []);
  return reduced;
}

export const tabSceneTransition: typeof SceneStyleInterpolators.forFade = ({
  current,
}) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 1, 0],
      extrapolate: "clamp",
    }),
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-12, 0, 12],
          extrapolate: "clamp",
        }),
      },
    ],
  },
});

// Native stack transitions are handled by the OS. This supplies the equivalent
// entrance on web without remounting the route or losing its form/scroll state.
export function WebStackTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const focused = useIsFocused();
  const reduced = useNavigationReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  useLayoutEffect(() => {
    progress.stopAnimation();
    if (!focused || reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: navigationDuration,
      easing: navigationEasing,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [focused, reduced, progress]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
