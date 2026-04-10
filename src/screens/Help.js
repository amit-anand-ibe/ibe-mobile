import React, { useEffect } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";

import CustomBackButton from "../components/CustomBackButton";

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

  useEffect(() => {
    navigation.setOptions({
      headerTitle: t("help"),
      headerLeft: () => <CustomBackButton navigation={navigation} t={t} />,
    });
  }, [navigation, t]);

  return (
    <View style={styles.container}>
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
});

export default Help;
