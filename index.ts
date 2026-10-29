// The app's entry: Expo Router, plus the home-screen widget's handler, which Android can call with the
// app closed (so it has to be registered here, not inside a screen).
import 'expo-router/entry';

import { registerWidgets } from '@/widget/widgets';

registerWidgets();
