/* global require */

import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { FontAwesome } from "@expo/vector-icons";

import {
  APP,
  APP_NAME,
  BUSOBJCAT,
  BUSOBJCATMAP,
  MAX_IMAGE_SIZE,
} from "../constants";
import {
  fetchAndCacheResource,
  isDoNotReplaceAnyList,
  uploadBinaryResource,
} from "../utils/APIUtils";
import { changeDateToAPIFormat } from "../utils/FormatUtils";
import { showToast } from "../utils/MessageUtils";
import updateFields, { handleBackNavigation } from "../utils/UpdateUtils";

import Loader from "./Loader";
import CustomButton from "./CustomButton";
import CustomBackButton from "./CustomBackButton";
import ScreenHeader from "./ScreenHeader";
import { useClientPaths } from "../../context/ClientPathsContext";

/**
 * Button Component
 *
 * Reusable button component for consistent styling and functionality.
 *
 * @param {string} label - The label text displayed on the button.
 * @param {string} icon - The FontAwesome icon name for the button.
 * @param {string} accessibilityLabel - The accessibility label for the button.
 * @param {function} onPress - The function to be executed when the button is pressed.
 *
 * @returns {JSX.Element} JSX Element representing the Button component.
 */
const Button = ({ label, icon, accessibilityLabel, onPress }) => {
  return (
    <View>
      <Pressable style={[styles.button]} onPress={onPress}>
        <FontAwesome
          name={icon}
          size={18}
          color="black"
          style={styles.buttonIcon}
          accessibilityLabel={accessibilityLabel}
        />
        <Text style={styles.buttonLabel}>{label}</Text>
      </Pressable>
    </View>
  );
};

/**
 * CustomImagePicker Component
 *
 * This component provides functionality to pick an image from the gallery
 * or take a photo using the device camera. It allows the user to preview
 * and upload the selected image.
 *
 * @param {object} route - The route object passed by React Navigation.
 * @param {object} navigation - The navigation object passed by React Navigation.
 *
 * @returns {JSX.Element} JSX Element representing the CustomImagePicker component.
 */

const CustomImagePicker = ({ route, navigation }) => {
  // Destructure with fallback values from route parameters
  const { linkBackToBusObjcat = "" } = route.params || {};

  // Initialize useTranslation hook for internationalization
  const { t } = useTranslation();

  // Access client paths from context
  const { clientPaths, setClientPaths } = useClientPaths();

  const existingUserPhoto = clientPaths?.userPhotoPath || null;

  // State variables for selected image, loading state, and change tracking
  const [selectedImage, setSelectedImage] = useState(existingUserPhoto);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanged, setHasChanged] = useState(false); // Track if the selected image has change

  const placeholderImageSource = require("../assets/images/blank-picture_640.png");

  // Determine the image source for rendering
  const imageSource = useMemo(
    () => (selectedImage ? { uri: selectedImage } : placeholderImageSource),
    [selectedImage]
  );

  /**
   * Resets the selected image and change tracking state.
   * This function uses `useCallback` to ensure the reference remains stable
   * across renders, preventing unnecessary re-renders of child components
   * that depend on this function.
   *
   * @function handleDiscardChanges
   * @callback
   */
  const handleDiscardChanges = useCallback(() => {
    // Discard states
    setSelectedImage(null);
    setHasChanged(false);
  }, []);

  const headerLeft = useCallback(
    () => (
      <CustomBackButton
        navigation={navigation}
        hasUnsavedChanges={hasChanged}
        discardChanges={handleDiscardChanges}
        t={t}
      />
    ),
    [handleDiscardChanges, hasChanged, navigation, t]
  );

  const headerRight = useCallback(
    () => (
      <View style={styles.headerRightContainer}>
        <CustomButton
          onPress={onSave}
          label={t("save")}
          icon={{
            name: "content-save",
            library: "MaterialCommunityIcons",
            size: 24,
            color: "white",
          }}
          disabled={!hasChanged || isLoading}
          backgroundColor={false}
          style={{ icon: { marginRight: 0 } }}
          labelStyle={styles.buttonLabelWhite}
          accessibilityLabel={t("save_user_photo")}
          accessibilityRole="button"
          testID="save-user-photo-button"
        />
        <CustomButton
          onPress={onDelete}
          label={t("delete")}
          icon={{
            name: "image-remove",
            library: "MaterialCommunityIcons",
            size: 24,
            color: "white",
          }}
          disabled={!existingUserPhoto || hasChanged || isLoading}
          backgroundColor={false}
          style={{ icon: { marginRight: 0 } }}
          labelStyle={styles.buttonLabelWhite}
          accessibilityLabel={t("delete_user_photo")}
          accessibilityRole="button"
          testID="delete-user-photo-button"
        />
      </View>
    ),
    [existingUserPhoto, hasChanged, isLoading, onDelete, onSave, t]
  );

  /**
   * Compresses the selected image to reduce its file size.
   *
   * @param {string} uri - The URI of the image to be compressed.
   * @returns {Promise<string|null>} The URI of the compressed image or null if failed.
   */
  const compressImage = async (uri) => {
    try {
      console.log(`Compressing image: ${uri}`);
      const originalFileInfo = await FileSystem.getInfoAsync(uri);
      console.log(
        "Original image size:",
        (originalFileInfo.size / (1024 * 1024)).toFixed(2) + " MB"
      );

      // Compressing the image
      const result = await ImageManipulator.manipulateAsync(uri, [], {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG, // Use JPEG for better compression
      });

      // Check compressed image size
      const compressedFileInfo = await FileSystem.getInfoAsync(result.uri);
      console.log(
        "Compressed image size:",
        (compressedFileInfo.size / (1024 * 1024)).toFixed(2) + " MB"
      );

      // Check if the compressed file size exceeds the maximum limit
      if (compressedFileInfo.size > MAX_IMAGE_SIZE) {
        console.log("Image size exceeds the allowed limit after compression.");
        Alert.alert("Error", t("image_size_error"));
        return null; // Indicate that the image is too large
      }

      return result.uri; // Return the URI of the compressed image
    } catch (error) {
      console.error("Error compressing image:", error);
      Alert.alert(t("alert_title"), t("compression_error"));
      return null;
    }
  };

  /**
   * Picks an image from the gallery using ImagePicker.
   */
  const pickImageAsync = async () => {
    try {
      console.log("Opening image picker...");
      let result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 1,
      });

      console.log("Image Picker result:", result);

      if (!result.canceled) {
        // Compress the image after picking
        const compressedUri = await compressImage(result.assets[0].uri);
        setSelectedImage(compressedUri || existingUserPhoto || null);
        setHasChanged(!!compressedUri); // Set hasChanged to true if an image is captured
        console.log(
          "Image selected and possibly compressed, URI:",
          compressedUri
        );
      } else {
        Alert.alert(t("alert_title"), t("no_image_selected"));
        console.log("No image selected");
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  /**
   * Requests camera permissions if not granted.
   * On iOS, permission is mandatory to open the camera.
   * @returns {Promise<boolean>} True if permission granted, otherwise false.
   */
  const getCameraPermissions = async () => {
    console.log("Requesting camera permissions...");
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      console.log("Camera permissions not granted.");
      Alert.alert(
        "Permissions required",
        "Camera access is needed to take photos."
      );
      return false;
    }

    console.log("Camera permissions granted.");
    return true;
  };

  /**
   * Opens the device camera to capture a photo using ImagePicker.
   */
  const openCameraAsync = async () => {
    // Check for camera permissions before opening the camera
    const hasPermission = await getCameraPermissions();
    if (!hasPermission) {
      console.log("No camera permission, exiting camera function.");
      return;
    }

    console.log("Opening camera...");
    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });

    console.log("Camera result:", result);

    if (!result.canceled) {
      // Compress the image after taking a photo
      const compressedUri = await compressImage(result.assets[0].uri);
      setSelectedImage(compressedUri || existingUserPhoto || null);
      setHasChanged(!!compressedUri); // Set hasChanged to true if an image is captured
      console.log("Photo taken and possibly compressed, URI:", compressedUri);
    } else {
      Alert.alert(t("alert_title"), t("no_photo_taken"));
      console.log("No photo taken");
    }
  };

  /**
   * Function to handle save action.
   * It uploads the selected image and updates the bus object category.
   */
  const onSave = async () => {
    console.log("Save action triggered");
    if (selectedImage) {
      try {
        setIsLoading(true);
        console.log("Selected Image before saving:", selectedImage);

        // Upload the selected image and get binary resource
        const binaryResource = await uploadBinaryResource(
          selectedImage,
          true, // Fetch new object IDs
          {
            type: "image/png",
            name: "user-photo.jpg",
            tHeight: 600,
            tWidth: 400,
            convertToPng: true,
          },
          {
            client: APP.LOGIN_USER_CLIENT,
            allClient: false,
          }
        );

        console.log("Binary resource result:", binaryResource);

        // Construct formData object with binary resource data
        const formData = {
          data: {
            [`${linkBackToBusObjcat}-photoID`]: binaryResource.attachmentId,
            [`${linkBackToBusObjcat}-thumbnailID`]: binaryResource.thumbId,
            [`${linkBackToBusObjcat}-type`]: "employee",
            [`${linkBackToBusObjcat}-id`]: APP.LOGIN_USER_EMPLOYEE_ID,
          },
        };

        // Construct query string parameters
        const queryStringParams = {
          userID: APP.LOGIN_USER_ID,
          client: parseInt(APP.LOGIN_USER_CLIENT),
          language: APP.LOGIN_USER_LANGUAGE,
          testMode: APP.TEST_MODE ? APP.TEST_MODE : null,
          changeDate: changeDateToAPIFormat(new Date()),
          component: "platform",
          doNotReplaceAnyList: true,
          appName: APP_NAME.EMPLOYEE,
        };

        // Update the linked bus object category with the binary resource
        const updateResponse = await updateFields(formData, queryStringParams);

        // Check if update was successful
        if (updateResponse.success) {
          const [updatedPhotoUri, updatedThumbnailUri] = await Promise.all([
            fetchAndCacheResource(binaryResource.attachmentId),
            fetchAndCacheResource(binaryResource.thumbId),
          ]);

          setClientPaths((prevPaths) => ({
            ...prevPaths,
            userPhotoPath: updatedPhotoUri || null,
            userThumbnailPath: updatedThumbnailUri || null,
          }));

          setSelectedImage(updatedPhotoUri || null); // Update UI to reflect photo update
          setHasChanged(false);

          showToast(t("photo_updated_success"));
          console.log(
            "Image successfully uploaded and business object category updated."
          );
        } else {
          showToast(t("failed_upload_photo"), "error");
          console.error(
            "Failed to update business object category with new image."
          );
        }

        if (updateResponse.message) {
          showToast(updateResponse.message);
        }
      } catch (error) {
        if (error.status === 413) {
          console.error("Payload too large. Please upload a smaller file.");
          showToast(t("upload_error_413"), "error");
        } else {
          console.error("Error in onSave method of CustomImagePicker:", error);
          showToast(t("failed_upload_photo"), "error");
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      Alert.alert(`${t("alert_title")}!`, t("no_image_selected"));
      console.log("No image selected for saving");
    }
  };

  /**
   * Function to handle delete action.
   * It deletes the current user photo and thumbnail if available.
   */
  const onDelete = () => {
    console.log("Delete action triggered");
    Alert.alert(
      t("confirm_delete_title"),
      t("confirm_delete_message"),
      [
        {
          text: t("cancel"),
          style: "cancel",
        },
        {
          text: t("confirm"),
          onPress: async () => {
            console.log("Delete action confirmed");

            try {
              setIsLoading(true);

              const formData = {
                data: {
                  [`${BUSOBJCATMAP[BUSOBJCAT.EMPLOYEE]}-id`]:
                    APP.LOGIN_USER_EMPLOYEE_ID,
                  [`${BUSOBJCATMAP[BUSOBJCAT.EMPLOYEE]}-photoID`]: "",
                  [`${BUSOBJCATMAP[BUSOBJCAT.EMPLOYEE]}-thumbnailID`]: "",
                  [`${BUSOBJCATMAP[BUSOBJCAT.EMPLOYEE]}-type`]: "employee",
                },
              };

              const queryStringParams = {
                changeDate: changeDateToAPIFormat(new Date()),
                userID: APP.LOGIN_USER_ID,
                client: Number(APP.LOGIN_USER_CLIENT),
                language: APP.LOGIN_USER_LANGUAGE,
                testMode: APP.TEST_MODE || null,
                component: "platform",
                doNotReplaceAnyList: isDoNotReplaceAnyList(BUSOBJCAT.EMPLOYEE),
                appName: APP_NAME.EMPLOYEE,
              };

              const deleteResponse = await updateFields(
                formData,
                queryStringParams
              );

              if (
                deleteResponse?.success &&
                deleteResponse?.response?.details?.[0]?.success
              ) {
                const detail = deleteResponse.response.details[0];

                if (detail?.data?.ids?.length > 0) {
                  // Get info for the selected image and thumbnail
                  const [photoInfo, thumbnailInfo] = await Promise.all([
                    FileSystem.getInfoAsync(selectedImage),
                    FileSystem.getInfoAsync(clientPaths?.userThumbnailPath),
                  ]);

                  // Helper function to delete file if it exists
                  const deleteFileIfExists = async (fileInfo, filePath) => {
                    if (fileInfo.exists) {
                      await FileSystem.deleteAsync(filePath);
                      console.log(`Cache for file ${filePath} deleted.`);
                    } else {
                      console.log(
                        `No cached file found for deletion: ${filePath}.`
                      );
                    }
                  };

                  // Perform deletion for both image and thumbnail
                  await Promise.all([
                    deleteFileIfExists(photoInfo, selectedImage),
                    deleteFileIfExists(
                      thumbnailInfo,
                      clientPaths?.userThumbnailPath
                    ),
                  ]);

                  // Update state and UI after deletion
                  setClientPaths((prevPaths) => ({
                    ...prevPaths,
                    userPhotoPath: null,
                    userThumbnailPath: null,
                  }));
                  setSelectedImage(null); // Clear selected image in UI
                  setHasChanged(false);

                  showToast(t("photo_deleted_success"));
                  console.log("Image successfully deleted.");
                } else {
                  handleDeleteError();
                }
              } else {
                handleDeleteError();
              }
            } catch (error) {
              console.error(
                "Error in onDelete method of CustomImagePicker:",
                error
              );
              handleDeleteError();
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteError = () => {
    showToast(t("failed_delete_photo"), "error");
    console.error("Failed to delete image.");
  };

  /**
   * Function to handle undo action.
   * If an image is selected, it resets the selected image.
   * If no image is selected, it shows an alert informing the user.
   */
  const onReset = () => {
    console.log("Reset action triggered");
    if (selectedImage) {
      setSelectedImage(existingUserPhoto || null);
      setHasChanged(false);
      console.log("Selected image reset to existing user photo (if any).");
    } else {
      Alert.alert(`${t("alert_title")}!`, t("no_image_to_reset"));
      console.log("No image to reset");
    }
  };

  // Render JSX
  return (
    <View style={styles.container}>
      <ScreenHeader left={headerLeft()} right={headerRight()} />
      <SafeAreaView style={styles.container} edges={["right", "bottom", "left"]}>
        <View style={styles.imageContainer}>
        <Image source={imageSource} style={styles.image} contentFit="contain" />
        {hasChanged && (
          <CustomButton
            onPress={onReset}
            label={""}
            icon={{
              name: "undo",
              library: "FontAwesome",
              size: 24,
              color: "#000",
            }}
            disabled={!hasChanged}
            backgroundColor={false}
            accessibilityLabel={t("delete_user_photo")}
            accessibilityRole="button"
            testID="delete-user-photo-button"
          />
        )}
        </View>
        <View style={styles.buttonContainer}>
        <Button
          label={t("pick_image")}
          icon="picture-o"
          accessibilityLabel={t("pick_photo_gallery")}
          onPress={pickImageAsync}
        />
        <Button
          label={t("open_camera")}
          icon="camera"
          accessibilityLabel={t("open_camera_photo")}
          onPress={openCameraAsync}
        />
        </View>
        {isLoading && <Loader />}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    columnGap: 16,
  },
  imageContainer: {
    flex: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    borderRadius: 12,
    borderColor: "#ffd33d",
    width: "50%",
    height: "80%",
  },
  buttonContainer: {
    flex: 1,
    justifyContent: "center",
    padding: "5%",
    rowGap: 16,
  },
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: "6%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#005eb8",
    backgroundColor: "white",
    elevation: 5,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  buttonIcon: {
    paddingRight: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  buttonLabelWhite: {
    color: "white",
  },
});

export default CustomImagePicker;
