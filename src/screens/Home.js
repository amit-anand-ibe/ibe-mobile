/* global require */

import React, { useCallback, useEffect, useMemo, useState } from "react"; // React and hooks
import {
  Pressable,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { Image } from "expo-image";
import {
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";

import { useTranslation } from "react-i18next";

import { fetchAndCacheResource } from "../utils/APIUtils";
import {
  fetchFieldEngineerTasks,
  hasFieldEngineerRole,
} from "../utils/FieldEngineerUtils";
import { screenDimension } from "../utils/ScreenUtils";

import { useClientPaths } from "../../context/ClientPathsContext";
import { useThemeStyles } from "../theme/useThemeStyles";

const Home = ({ route, navigation }) => {
  const { t } = useTranslation();

  const styles = useThemeStyles().home;
  const [fieldEngineerTaskCount, setFieldEngineerTaskCount] = useState(null);

  const logoDimension = useMemo(() => screenDimension.width / 2, []);

  /**
   * Retrieves the client image paths from the ClientPaths context.
   * This includes the paths for the client logo, user photo, and user thumbnail.
   * The paths are used to display images in the UI, allowing for dynamic updates
   * based on the fetched values from the server.
   */
  const { clientPaths, setClientPaths } = useClientPaths();

  const authenticationResult = route?.params?.authenticationResult ?? {};
  const canAccessFieldEngineer = useMemo(
    () => hasFieldEngineerRole(authenticationResult),
    [authenticationResult]
  );

  const userName =
    authenticationResult?.User?.[0]?.["Resource-core-name-knownAs"] ??
    t("home_hello_user");

  /**
   * Navigates to the CustomImagePicker screen, passing the user's photo path and client paths.
   * The `linkBackToBusObjcat` is a parameter expected by the target screen.
   */
  const navigateToUploadPhoto = useCallback(() => {
    console.log("Navigating to CustomImagePicker with paths:", clientPaths);
    navigation.navigate("CustomImagePicker", {
      linkBackToBusObjcat: "Resource",
    });
  }, [clientPaths, navigation]);

  /**
   * Navigates to the User screen, passing the user data from the authentication result.
   * The user data is used to display detailed user information on the target screen.
   */
  const navigateToUserScreen = useCallback(() => {
    console.log(
      "Navigating to User screen with authentication result:",
      JSON.stringify(authenticationResult, null, 2)
    );
    navigation.navigate("User", {
      user: authenticationResult?.User?.[0] ?? {},
    });
  }, [authenticationResult, navigation]);

  /**
   * Fetches client logo, user photo, and user thumbnail concurrently.
   * Uses `Promise.all` to run the fetch operations in parallel, improving performance.
   * Updates the state with the image paths when fetched successfully.
   */
  const fetchClientDataConcurrently = useCallback(async (authResult) => {
    if (Object.entries(authResult).length === 0) {
      console.log(
        "No authentication result provided, unable to fetch user data."
      );
      return;
    }

    const clientLogoId = authResult?.User?.[0]?.["Client-clientLogo"] ?? "";
    const userPhotoId = authResult?.User?.[0]?.["Person-photoID"] ?? "";
    const userThumbnailId = authResult?.User?.[0]?.["Person-thumbnailID"] ?? "";

    try {
      const [clientLogoPath, userPhotoPath, userThumbnailPath] =
        await Promise.all([
          fetchAndCacheResource(clientLogoId),
          fetchAndCacheResource(userPhotoId),
          fetchAndCacheResource(userThumbnailId),
        ]);

      setClientPaths({
        clientLogoPath,
        userPhotoPath,
        userThumbnailPath,
      });
    } catch (error) {
      console.error("Error fetching and caching images: ", error);
    }
  }, []);

  /**
   * Fetches client logo, user photo, and user thumbnail when the authentication result changes.
   * The fetch process is initiated once the authentication data is available.
   */
  useEffect(() => {
    fetchClientDataConcurrently(authenticationResult);
  }, [authenticationResult, fetchClientDataConcurrently]);

  useEffect(() => {
    const loadFieldEngineerCount = async () => {
      if (!canAccessFieldEngineer) {
        setFieldEngineerTaskCount(null);
        return;
      }

      try {
        setFieldEngineerTaskCount(null);
        const response = await fetchFieldEngineerTasks({
          limit: 1000,
          fieldSet: "dashboard",
        });
        setFieldEngineerTaskCount(response.data.length || 0);
      } catch (error) {
        console.error("Error loading field engineer task count:", error);
        setFieldEngineerTaskCount(null);
      }
    };

    loadFieldEngineerCount();
  }, [canAccessFieldEngineer]);

  /**
   * Gets the source object for the user image.
   * This function checks the `clientPaths` state for the available user images.
   * It prioritizes the user thumbnail path over the user photo path.
   * If neither image path is available, it returns a default placeholder image.
   *
   * @function getUserImageSource
   * @returns {object} An object representing the image source.
   *                   - If a user thumbnail or photo path is available, it returns an object with the `uri` property set to the image path.
   *                   - If neither path is available, it returns a default placeholder image as a local require.
   *
   * @example
   * const userImageSource = getUserImageSource();
   * // userImageSource will either be { uri: "path/to/image" } or the default placeholder.
   */
  const getUserImageSource = useMemo(() => {
    return clientPaths.userThumbnailPath || clientPaths.userPhotoPath
      ? { uri: clientPaths.userThumbnailPath || clientPaths.userPhotoPath }
      : require("../assets/images/blank-picture_640.png"); // Placeholder if no image is available
  }, [clientPaths]);

  /**
   * Gets the source object for the client logo image.
   * If a client logo path is available, returns an object with the `uri` property set to the image path.
   * Otherwise, returns a default placeholder logo image.
   *
   * @returns {object} The source for the client logo, with the image URI or a local placeholder.
   */
  const getClientLogoSource = useMemo(() => {
    return clientPaths.clientLogoPath
      ? { uri: clientPaths.clientLogoPath }
      : require("../assets/images/client-logo-placeholder_500.png"); // Placeholder if no logo is available
  }, [clientPaths.clientLogoPath]);

  /**
   * Sets custom header options for the screen, including a user photo, username, and help icon.
   * The header includes navigation links to the photo upload screen and user profile screen.
   */
  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft: () => (
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={navigateToUploadPhoto}
            accessibilityLabel={t("navigate_to_photo_upload")}
          >
            <Image
              style={styles.userPhoto}
              source={getUserImageSource}
              onError={(error) =>
                console.error("Error loading user photo:", error)
              }
              contentFit="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={navigateToUserScreen}
            accessibilityLabel={t("navigate_to_user_screen")}
          >
            <Text
              style={styles.userName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {userName}
            </Text>
          </TouchableOpacity>
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Help")}
            accessibilityLabel={t("navigate_to_help")}
          >
            <Ionicons name="help-circle-outline" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [getUserImageSource, navigateToUploadPhoto, navigateToUserScreen]);

  const onPressTimesheets = () => navigation.navigate("Timesheet");
  const onPressExpenses = () => navigation.navigate("Expense");
  const onPressAbsences = () => navigation.navigate("Absence");
  const onPressApprovals = () => navigation.navigate("Approval");
  const onPressFieldEngineer = () => navigation.navigate("FieldEngineer");

  const renderHomeCard = ({
    title,
    subtitle,
    onPress,
    accessibilityLabel,
    icon,
    showNewBadge = false,
    count,
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={styles.cardTouchable}
    >
      {({ pressed }) => (
        <View style={[styles.card, pressed && styles.pressedCard]}>
          <View
            style={[
              styles.cardIconContainer,
              pressed && styles.pressedCardIconContainer,
            ]}
          >
            {icon(pressed)}
          </View>
          <View style={styles.cardContent}>
            <Text
              style={[styles.cardText, pressed && styles.pressedCardText]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            <Text
              style={styles.cardDescription}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          </View>
          {showNewBadge && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{t("new")}</Text>
            </View>
          )}
          {count !== undefined && count !== null && (
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeText}>{count}</Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={18}
            color={pressed ? "#1d5cff" : "#a8b0bd"}
          />
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      {/**
      * Renders the client logo or a placeholder if the logo path is unavailable. 
      * `clientPaths.clientLogoPath` is fetched dynamically, while the local placeholder 
      * is used as a fallback in case the logo is not
      available. 
      */}
      <View style={styles.logoContainer}>
        <Image
          style={{
            width: logoDimension,
            height: logoDimension,
            maxHeight: screenDimension.width / 3,
            maxWidth: screenDimension.width / 3,
            borderWidth: 1,
            borderRadius: 8,
            borderColor: "#fff",
          }}
          source={getClientLogoSource}
          onError={(error) => console.error("Error loading logo image:", error)}
          onLoad={() =>
            console.log("Logo image loaded:", clientPaths.clientLogoPath)
          }
          contentFit="contain"
        />
      </View>
      <ScrollView
        style={styles.main}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        {renderHomeCard({
          title: t("home_timesheets_title"),
          subtitle: t("home_timesheets_description"),
          onPress: onPressTimesheets,
          accessibilityLabel: t("navigate_to_timesheets"),
          icon: (pressed) => (
            <Ionicons
              name="document-text-outline"
              size={24}
              color={pressed ? "#1d5cff" : "#858f9f"}
            />
          ),
        })}
        {renderHomeCard({
          title: t("home_expenses_title"),
          subtitle: t("home_expenses_description"),
          onPress: onPressExpenses,
          accessibilityLabel: t("navigate_to_expenses"),
          icon: (pressed) => (
            <FontAwesome
              name="dollar"
              size={24}
              color={pressed ? "#1d5cff" : "#858f9f"}
            />
          ),
        })}
        {renderHomeCard({
          title: t("home_absences_title"),
          subtitle: t("home_absences_description"),
          onPress: onPressAbsences,
          accessibilityLabel: t("navigate_to_absences"),
          icon: (pressed) => (
            <MaterialCommunityIcons
              name="calendar-blank-outline"
              size={24}
              color={pressed ? "#1d5cff" : "#858f9f"}
            />
          ),
        })}
        {renderHomeCard({
          title: t("home_approvals_title"),
          subtitle: t("home_approvals_description"),
          onPress: onPressApprovals,
          accessibilityLabel: t("navigate_to_approvals"),
          icon: (pressed) => (
            <MaterialIcons
              name="check-box"
              size={24}
              color={pressed ? "#1d5cff" : "#858f9f"}
            />
          ),
        })}
        {canAccessFieldEngineer &&
          renderHomeCard({
            title: t("field_engineer"),
            subtitle: t("field_engineer_card_description"),
            onPress: onPressFieldEngineer,
            accessibilityLabel: t("navigate_to_field_engineer"),
            icon: (pressed) => (
              <MaterialCommunityIcons
                name="wrench-outline"
                size={24}
                color={pressed ? "#1d5cff" : "#858f9f"}
              />
            ),
            count: fieldEngineerTaskCount,
          })}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Home;
