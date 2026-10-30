import { LayoutAnimation } from 'react-native';

/** The next layout change (a section opening, a review revealed) eases into place instead of jumping. */
export function easeNextLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

