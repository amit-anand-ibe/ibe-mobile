import React from "react";
import { StyleSheet, View, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";

import CustomBackButton from "../components/CustomBackButton";
import ScreenHeader from "../components/ScreenHeader";

/**
 * Help screen component that displays user documentation using a WebView.
 * The screen title is dynamically set using translation based on the current language.
 *
 * @component
 * @param {Object} navigation - The navigation prop for navigating between screens.
 * @returns {JSX.Element} JSX element representing the Help screen.
 */
const Help = ({ navigation }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader
        left={
          <View style={styles.headerLeftContainer}>
            <CustomBackButton navigation={navigation} t={t} />
            <Text
              style={styles.headerTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {t("help")}
            </Text>
          </View>
        }
      />
      <WebView
        style={styles.webview}
        source={{ uri: "https://www.ibe.net/docs/" }} // URL for the help documentation
        startInLoadingState={true} // Show loading indicator while the content is loading
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1, // Ensures the container takes up the full screen
  },
  webview: {
    flex: 1, // Ensures the WebView takes up the full screen
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject, // Ensures the container fills the parent View
    justifyContent: "center", // Center vertically
    alignItems: "center", // Center horizontally
  },
  headerLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default Help;
