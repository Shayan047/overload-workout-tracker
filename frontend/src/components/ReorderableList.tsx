import { type ReactNode, useMemo, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, PanResponder, View } from 'react-native';

import { colors } from '@/theme';

import { DragHandleIcon } from './icons';

type Props<T> = {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** Renders a row. Put `handle` where the drag handle goes. */
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
  /** Drawn above every row but the first (rows' separators move with them). */
  separator?: ReactNode;
  onReorder: (from: number, to: number) => void;
  /** For screen readers, e.g. "Reorder Chest & Back". */
  handleLabel: (item: T) => string;
};

/**
 * "Drag to reorder" (04, 05), built on React Native's own touch handling. Press and drag a
 * row's handle; the row follows the finger and the others move aside. Screen readers get
 * "move up" and "move down" actions on the handle instead.
 */
export function ReorderableList<T>({ items, keyOf, renderItem, separator, onReorder, handleLabel }: Props<T>) {
  const layouts = useRef<{ y: number; height: number }[]>([]);
  const dy = useRef(new Animated.Value(0)).current;
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;

  const targetFor = (from: number, offset: number) => {
    const rows = layouts.current;
    const center = rows[from].y + rows[from].height / 2 + offset;
    const index = rows.findIndex((row) => center < row.y + row.height);
    return index === -1 ? rows.length - 1 : index;
  };

  const responders = useMemo(
    () =>
      items.map((_, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponderCapture: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            dy.setValue(0);
            setDrag({ from: index, to: index });
          },
          onPanResponderMove: (_, gesture) => {
            dy.setValue(gesture.dy);
            const to = targetFor(index, gesture.dy);
            if (dragRef.current && dragRef.current.to !== to) setDrag({ from: index, to });
          },
          onPanResponderRelease: () => finish(),
          onPanResponderTerminate: () => finish(),
        }),
      ),
    // A new set of responders whenever rows are added or removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length],
  );

  function finish() {
    const current = dragRef.current;
    setDrag(null);
    dy.setValue(0);
    if (current && current.from !== current.to) reorderRef.current(current.from, current.to);
  }

  const shiftFor = (index: number): number => {
    if (!drag || index === drag.from) return 0;
    const height = layouts.current[drag.from]?.height ?? 0;
    if (index > drag.from && index <= drag.to) return -height;
    if (index < drag.from && index >= drag.to) return height;
    return 0;
  };

  return (
    <View>
      {items.map((item, index) => {
        const dragging = drag?.from === index;
        const handle = (
          <View
            {...responders[index]?.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={handleLabel(item)}
            accessibilityActions={[
              { name: 'decrement', label: 'Move up' },
              { name: 'increment', label: 'Move down' },
            ]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === 'decrement' && index > 0) onReorder(index, index - 1);
              if (nativeEvent.actionName === 'increment' && index < items.length - 1) onReorder(index, index + 1);
            }}
            hitSlop={8}
          >
            <DragHandleIcon color={colors.textFaint} />
          </View>
        );
        return (
          <Animated.View
            key={keyOf(item)}
            onLayout={(event: LayoutChangeEvent) => {
              const { y, height } = event.nativeEvent.layout;
              layouts.current[index] = { y, height };
            }}
            style={[
              dragging
                ? { transform: [{ translateY: dy }], zIndex: 1, backgroundColor: colors.surfaceRaised }
                : { transform: [{ translateY: shiftFor(index) }] },
            ]}
          >
            {index > 0 ? separator : null}
            {renderItem(item, index, handle)}
          </Animated.View>
        );
      })}
    </View>
  );
}
