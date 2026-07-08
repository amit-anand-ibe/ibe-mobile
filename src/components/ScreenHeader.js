import React, { useContext } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemeContext } from "../theme/ThemeContext";

const ScreenHeader = ({ left, right }) => {
  const { theme } = useContext(ThemeContext);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.secondary }]}
    >
      <View style={styles.container}>
        <View style={styles.left}>{left}</View>
        <View style={styles.right}>{right}</View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    width: "100%",
  },
  container: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  left: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },
  right: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
});

export default ScreenHeader;
