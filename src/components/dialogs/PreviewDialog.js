import React, { useEffect, useState } from "react";
import {
  Button,
  Modal,
  View,
  ScrollView,
  StyleSheet,
  Text,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { Video, ResizeMode } from "expo-av";
import Constants from "expo-constants";
import { WebView } from "react-native-webview";

import { screenDimension } from "../../utils/ScreenUtils";

// Check if running in Expo Go
const isRunningInExpoGo = Constants.appOwnership === "expo";

// Conditionally import react-native-pdf if not in Expo Go
let Pdf;
if (!isRunningInExpoGo) {
  try {
    Pdf = require("react-native-pdf").default;
  } catch (error) {
    console.warn("react-native-pdf not available:", error);
    Pdf = null;
  }
}

/**
 * A modal component for previewing images, PDF files, or videos.
 * @param {Object} props - Component props.
 * @param {boolean} props.isVisible - Flag indicating whether the modal is visible.
 * @param {string} props.fileUri - The URI of the file to preview.
 * @param {string} props.fileType - The type of the file ("image","pdf", "video" etc.).
 * @param {string} props.fileTitle - Title to display at the top of the modal.
 * @param {Function} props.onClose - Callback function to close the modal.
 * @returns {JSX.Element} - The preview dialog component.
 */
const PreviewDialog = ({
  isVisible,
  fileUri,
  fileType,
  fileTitle,
  onClose,
}) => {
  // Initialize useTranslation hook
  const { t } = useTranslation();

  // State to manage loading state
  const [isLoading, setIsLoading] = useState(true);

  // Shared values for animated transformations
  const offset = useSharedValue({ x: 0, y: 0 });
  const start = useSharedValue({ x: 0, y: 0 });
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const savedRotation = useSharedValue(0);

  // Animated styles based on shared values
  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: offset.value.x },
        { translateY: offset.value.y },
        { scale: scale.value },
        { rotateZ: `${rotation.value}rad` },
      ],
    };
  });

  // Function to reset shared values
  const resetSharedValues = () => {
    // Reset all shared values
    offset.value = { x: 0, y: 0 };
    start.value = { x: 0, y: 0 };
    scale.value = 1;
    savedScale.value = 1;
    rotation.value = 0;
    savedRotation.value = 0;
  };

  // Gesture handlers for drag, zoom, and rotate
  const dragGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      offset.value = {
        x: e.translationX + start.value.x,
        y: e.translationY + start.value.y,
      };
    })
    .onEnd(() => {
      start.value = {
        x: offset.value.x,
        y: offset.value.y,
      };
    });

  const zoomGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value = withSpring(1);
      }
    });

  const rotateGesture = Gesture.Rotation()
    .onUpdate((event) => {
      rotation.value = savedRotation.value + event.rotation;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
    });

  // Compose gestures for simultaneous handling
  const composed = Gesture.Simultaneous(
    dragGesture,
    Gesture.Simultaneous(zoomGesture, rotateGesture)
  );

  useEffect(() => {
    // If fileUri exists, set loading to false (resource is loaded)
    if (fileUri) {
      setIsLoading(false);
    }

    // Cleanup function
    return () => {
      resetSharedValues();
    };
  }, [fileUri]);

  // Render content based on file type
  let content;
  let contentStyle = {
    width: screenDimension.width - 20,
    height: "100%",
  };

  if (fileType === "image") {
    content = (
      <View>
        <GestureDetector gesture={composed}>
          <Animated.Image
            source={{ uri: fileUri }}
            style={[contentStyle, animatedStyles]}
            resizeMode="contain"
          />
        </GestureDetector>
      </View>
    );
  } else if (fileType === "pdf") {
    if (Pdf && !isRunningInExpoGo) {
      content = (
        <Pdf
          source={{ uri: fileUri }}
          style={contentStyle}
          onLoadComplete={(numberOfPages, filePath) => {
            console.log(`Number of pages: ${numberOfPages}`);
          }}
          onPageChanged={(page, numberOfPages) => {
            console.log(`Current page: ${page}`);
          }}
          onError={(error) => {
            console.log(error);
          }}
        />
      );
    } else {
      content = (
        <View style={{ width: contentStyle.width, height: contentStyle.height }}>
          <WebView
            originWhitelist={["*"]}
            source={{ uri: fileUri }}
            style={{ flex: 1 }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn("WebView PDF load error", nativeEvent);
            }}
            startInLoadingState
            renderLoading={() => (
              <ActivityIndicator size="large" color="#fff" style={{ flex: 1 }} />
            )}
          />
        </View>
      );
    }
  } else if (fileType === "video") {
    // Video preview component
    content = (
      <Video
        source={{ uri: fileUri }}
        style={contentStyle}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls
        isLooping
      />
    );
  } else {
    content = (
      <Text style={styles.errorText}>{t("unsupported_file_type")}</Text>
    );
  }

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.previewDialogContainer}>
        <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {fileTitle}
        </Text>
        <ScrollView contentContainerStyle={styles.scrollView} centerContent>
          {isLoading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <GestureHandlerRootView>{content}</GestureHandlerRootView>
          )}
        </ScrollView>
        <Button title={t("close")} onPress={onClose} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  errorText: {
    color: "red",
    fontSize: 18,
    fontWeight: "bold",
  },
  previewDialogContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    padding: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  scrollView: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
});

export default PreviewDialog;
