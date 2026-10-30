import { useEffect, useState } from 'react';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';

/** The next layout change (a section opening, a review revealed) eases into place instead of jumping. */
export function easeNextLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

/** True when the phone asks for less motion (Remove animations); decorative movement then stays still. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => live && setReduced(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
