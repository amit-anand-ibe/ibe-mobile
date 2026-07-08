import React, { useContext } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ThemeContext } from "../theme/ThemeContext";

const getRouteLabel = (route, options) => {
  if (typeof options.tabBarLabel === "string") {
    return options.tabBarLabel;
  }

  if (typeof options.title === "string") {
    return options.title;
  }

  return route.name;
};

const ThemedTopTabBar = ({ state, descriptors, navigation }) => {
  const { theme } = useContext(ThemeContext);
  const activeColor = theme.secondary;
  const inactiveColor = "#667085";
  const dividerColor = "#D0D5DD";

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: theme.primary,
          borderBottomColor: dividerColor,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options || {};
          const label = getRouteLabel(route, options);

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[
                styles.tab,
                focused && { borderBottomColor: activeColor },
              ]}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.label,
                  focused
                    ? [styles.activeLabel, { color: activeColor }]
                    : { color: inactiveColor },
                ]}
              >
                {String(label).toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexGrow: 1,
  },
  tab: {
    minWidth: 96,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  activeLabel: {
    fontWeight: "700",
  },
});

export default ThemedTopTabBar;
