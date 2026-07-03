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

import Constants from "expo-constants";
import * as Sharing from "expo-sharing";
import { VideoView, useVideoPlayer } from "expo-video";

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
  const [resolvedFileUri, setResolvedFileUri] = useState(fileUri);
  const [previewError, setPreviewError] = useState("");
  const videoPlayer = useVideoPlayer(fileUri ? { uri: fileUri } : null, (player) => {
    player.loop = true;
  });

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
    let isMounted = true;

    const resolvePreviewUri = () => {
      setPreviewError("");
      setResolvedFileUri(fileUri);
      if (isMounted) setIsLoading(false);
    };

    resolvePreviewUri();

    // Cleanup function
    return () => {
      isMounted = false;
      resetSharedValues();
    };
  }, [fileUri]);

  const openOrShareFile = async () => {
    if (!resolvedFileUri) {
      setPreviewError(t("preview_error"));
      return;
    }

    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();

      if (!isSharingAvailable) {
        setPreviewError(t("preview_error"));
        return;
      }

      await Sharing.shareAsync(resolvedFileUri, {
        dialogTitle: fileTitle || t("choose_destination"),
        mimeType: fileType === "pdf" ? "application/pdf" : undefined,
        UTI: fileType === "pdf" ? "com.adobe.pdf" : undefined,
      });
    } catch (error) {
      console.warn("Unable to open or share file:", error);
      setPreviewError(t("sharing_failed"));
    }
  };

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
            source={{ uri: resolvedFileUri }}
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
          source={{ uri: resolvedFileUri }}
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
        <View style={styles.documentFallback}>
          <Text style={styles.documentFallbackTitle}>
            {t("pdf_preview_unavailable")}
          </Text>
          {!!previewError && (
            <Text style={styles.documentFallbackError}>{previewError}</Text>
          )}
          <Button title={t("open_or_share_file")} onPress={openOrShareFile} />
        </View>
      );
    }
  } else if (fileType === "video") {
    // Video preview component
    content = (
      <VideoView
        player={videoPlayer}
        style={contentStyle}
        contentFit="contain"
        nativeControls
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
  documentFallback: {
    width: screenDimension.width - 40,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 14,
    padding: 18,
  },
  documentFallbackTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  documentFallbackError: {
    color: "#fca5a5",
    fontSize: 13,
    textAlign: "center",
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
