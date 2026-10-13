import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

import { HistoryIcon, ProgressIcon, SplitsIcon, TodayIcon } from './icons';
import { Text } from './Text';

const ICONS: Record<string, ComponentType<{ color: string }>> = {
  index: TodayIcon,
  splits: SplitsIcon,
  progress: ProgressIcon,
  history: HistoryIcon,
};

const BAR_HEIGHT = 84; // including the top border and the 28 px bottom padding
const BOTTOM_PADDING = 28;

/** The design's bottom bar (07): 84 px with a 28 px bottom inset, icons over labels. On
 * phones with a larger home-indicator inset, the bar grows by the difference. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(BOTTOM_PADDING, insets.bottom);
  return (
    <View
      style={[styles.bar, { height: BAR_HEIGHT - BOTTOM_PADDING + bottom, paddingBottom: bottom }]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = descriptors[route.key].options.title ?? route.name;
        const Icon = ICONS[route.name];
        const color = focused ? colors.text : colors.textFaint;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            aria-selected={focused}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={styles.tab}
          >
            {Icon ? <Icon color={color} /> : null}
            <Text variant="tabLabel" style={{ color }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.barBorder,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
});
