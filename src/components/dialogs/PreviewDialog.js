import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Modal,
  StyleSheet,
  Text,
  ActivityIndicator,
  View,
  TouchableOpacity,
  Platform,
  StatusBar,
} from "react-native";
import { useTranslation } from "react-i18next";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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

import { VideoView, useVideoPlayer } from "expo-video";
import Constants from "expo-constants";

import { screenDimension } from "../../utils/ScreenUtils";

// Check if running in Expo Go
const isRunningInExpoGo = Constants.appOwnership === "expo";

// Conditionally import react-native-pdf if not in Expo Go
let Pdf;
if (!isRunningInExpoGo) {
  // The react-native-pdf package is a native module, which means it requires native code to work.
  // Expo Go does not support installing native modules yet. This is why the react-native-pdf package won’t work in the Expo Go app.
  // We will conditionally run in development build method. If not in Expo Go, conditionally import react-native-pdf.
  //Pdf = require("react-native-pdf").default; // TODO: Find an alternative package or solution.
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
  fileName,
  fileMimeType,
  onClose,
}) => {
  // Initialize useTranslation hook
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topInsetFallback =
    Platform.OS === "ios" ? 44 : StatusBar.currentHeight || 24;
  const bottomInsetFallback = Platform.OS === "ios" ? 24 : 12;

  // State to manage loading state
  const [isLoading, setIsLoading] = useState(true);
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

  const getFileExtensionFromMimeType = (mimeType) => {
    const normalized = String(mimeType || "").toLowerCase();
    if (normalized.includes("pdf")) return "pdf";
    if (normalized.includes("msword") || normalized.includes("word"))
      return "doc";
    if (normalized.includes("officedocument.wordprocessingml")) return "docx";
    if (normalized.includes("excel")) return "xlsx";
    if (normalized.includes("powerpoint")) return "pptx";
    if (normalized.includes("image/jpeg")) return "jpg";
    if (normalized.includes("image/png")) return "png";
    if (normalized.includes("image/gif")) return "gif";
    if (normalized.includes("text/plain")) return "txt";
    if (normalized.includes("zip")) return "zip";
    return "";
  };

  const ensureFileNameHasExtension = (name, mimeType) => {
    const fallbackName = String(name || "document").trim();
    const sanitized = fallbackName.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (sanitized.includes(".")) {
      return sanitized;
    }

    const extension = getFileExtensionFromMimeType(mimeType);
    return extension ? `${sanitized}.${extension}` : sanitized;
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

  const handleDownloadPress = async () => {
    if (!fileUri) {
      return;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(t("download_file"), t("preview_download_unavailable"));
        return;
      }

      const requestedFileName = ensureFileNameHasExtension(
        fileName || fileTitle || "document",
        fileMimeType
      );

      const destinationUri = `${FileSystem.cacheDirectory}${requestedFileName}`;

      const destinationInfo = await FileSystem.getInfoAsync(destinationUri);
      if (destinationInfo.exists) {
        await FileSystem.deleteAsync(destinationUri, { idempotent: true });
      }

      await FileSystem.copyAsync({ from: fileUri, to: destinationUri });

      await Sharing.shareAsync(destinationUri, {
        dialogTitle: t("download_file"),
        mimeType: fileMimeType || undefined,
      });
    } catch (error) {
      console.error("Error sharing file: ", error);
      Alert.alert(t("sharing_failed"), error?.message || t("sharing_failed"));
    }
  };

  // Render content based on file type
  let content;
  let contentStyle = {
    width: screenDimension.width - 40,
    height: screenDimension.height * 0.68,
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
  } else if (Pdf && fileType === "pdf" && !isRunningInExpoGo) {
    content = (
      <Pdf
        source={{ uri: fileUri }}
        style={contentStyle}
        onLoadComplete={(numberOfPages) => {
          console.log(`Number of pages: ${numberOfPages}`);
        }}
        onPageChanged={(page) => {
          console.log(`Current page: ${page}`);
        }}
        onError={(error) => {
          console.log(error);
        }}
      />
    );
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
      <View style={styles.unsupportedContainer}>
        <Text style={styles.errorText}>{t("unsupported_file_type")}</Text>
        <Text style={styles.helpText}>{t("unsupported_file_type_help")}</Text>
        {fileUri ? (
          <View style={styles.downloadActionRow}>
            <Button
              title={t("download_file")}
              onPress={handleDownloadPress}
              color="#2563eb"
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.overlay,
          {
            paddingTop:
              Math.max(insets.top, topInsetFallback) + 12,
            paddingBottom:
              Math.max(insets.bottom, bottomInsetFallback) + 12,
          },
        ]}
        edges={["top", "right", "bottom", "left"]}
      >
        <View style={styles.container}>
          <View style={styles.previewHeader}>
            <Text style={styles.headerTitle} numberOfLines={2} ellipsizeMode="tail">
              {fileTitle}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.previewContent}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <GestureHandlerRootView style={styles.previewContentInner}>
                {content}
              </GestureHandlerRootView>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  errorText: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "bold",
    textAlign: "center",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.88)",
    padding: 10,
    paddingTop: 16,
  },
  container: {
    width: "100%",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.15)",
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    flex: 1,
    marginRight: 12,
  },
  previewContent: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  previewContentInner: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  unsupportedContainer: {
    width: screenDimension.width - 60,
    backgroundColor: "#1f2937",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
  },
  helpText: {
    marginTop: 12,
    color: "#cbd5e1",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  downloadActionRow: {
    marginTop: 24,
    width: "100%",
    alignItems: "center",
  },
  actionButton: {
    width: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
});

export default PreviewDialog;
