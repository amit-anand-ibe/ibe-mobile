import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import CustomButton from "../components/CustomButton";
import CustomBackButton from "../components/CustomBackButton";
import CustomPicker from "../components/CustomPicker";
import ScreenHeader from "../components/ScreenHeader";

import { fetchData } from "../utils/APIUtils";
import { convertToDateFNSFormat } from "../utils/FormatUtils";
import { showToast } from "../utils/MessageUtils";
import { parseUserComms } from "../utils/UserUtils";

import { API_ENDPOINTS, APP } from "../constants";
import { LoggedInUserInfoContext } from "../../context/LoggedInUserInfoContext";
import { useRequestQueueContext } from "../../context/RequestQueueContext";
import { ThemeContext } from "../theme/ThemeContext";
import { useThemeStyles } from "../theme/useThemeStyles";

/**
 * Component to display and manage user preferences (e.g., language, request queue settings).
 * @param {Object} props - Props passed to the component.
 * @param {Object} props.route - The route object containing parameters.
 * @param {Object} props.navigation - The navigation object to handle navigation actions.
 * @returns {JSX.Element} User preferences screen.
 */

const User = ({ route, navigation }) => {
  const user = route?.params?.user;
  const { userEmail, userPhone } = parseUserComms(user);

  const { t, i18n } = useTranslation();

  const styles = useThemeStyles().user;

  const { loggedInUserInfo } = useContext(LoggedInUserInfoContext);
  const { themeName, updateTheme } = useContext(ThemeContext);

  const [initialSelectedLanguage, setInitialSelectedLanguage] = useState(null);
  const [initialIsRequestQueueEnabled, setInitialIsRequestQueueEnabled] =
    useState(false);
  const [initialSelectedTheme, setInitialSelectedTheme] =
    useState("Blue-White");

  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(themeName);

  // Use the custom hook to access the request queue context
  const { isRequestQueueEnabled, setIsRequestQueueEnabled } =
    useRequestQueueContext(); // Provides access to request queue context for managing request queue feature.

  const [changes, setChanges] = useState([]); // Track changes made to user preferences.

  // Language options for language selection dropdown.
  const languages = [
    { label: "English", value: "en" },
    { label: "Spanish", value: "es" },
    { label: "Hindi", value: "hi" },
  ];

  // Language options for language selection dropdown.
  const themes = [
    { label: "Blue-White", value: "Blue-White" },
    { label: "Yellow-Black", value: "Yellow-Black" },
  ];

  // Check if any preferences have been changed.
  const saveDisabled = useMemo(() => {
    console.log("Current state of changes array:", changes);
    return !changes.some((change) => change.changed);
  }, [changes]);

  /**
   * Updates the change tracking state for a specific preference field.
   * @param {string} field - The field name (e.g., "language" or "requestQueue").
   * @param {any} newValue - The new value of the field.
   * @param {any} initialValue - The initial value of the field to check for changes.
   */
  const updateChangeTracking = (field, newValue, initialValue) => {
    const fieldIndex = changes.findIndex((change) => change.field === field);

    const isChanged = newValue !== initialValue;

    if (fieldIndex !== -1) {
      const updatedChanges = [...changes];
      updatedChanges[fieldIndex] = { field, changed: isChanged };
      setChanges(updatedChanges);
    } else {
      setChanges([...changes, { field, changed: isChanged }]);
    }
  };

  /**
   * Handle language selection changes and track if there are any modifications.
   * @param {string} language - The selected language.
   */
  const handleLanguageChange = (language) => {
    console.log("Language changed to:", language);
    setSelectedLanguage(language);

    updateChangeTracking("language", language, initialSelectedLanguage);
  };

  /**
   * Handle theme selection changes and track if there are any modifications.
   * @param {string} theme - The selected theme.
   */
  const handleThemeChange = (theme) => {
    console.log("Theme changed to:", theme);
    setSelectedTheme(theme);

    updateChangeTracking("theme", theme, initialSelectedTheme);
  };

  /**
   * Handle request queue toggle changes and track modifications.
   * @param {boolean} value - The new toggle state.
   */
  const handleToggleChange = (value) => {
    console.log("Request queue toggled. New value:", value);
    setIsRequestQueueEnabled(value);

    updateChangeTracking("requestQueue", value, initialIsRequestQueueEnabled);
  };

  /**
   * Clear all data from AsyncStorage.
   * @async
   */
  const clearAllAsyncStorage = async () => {
    try {
      console.log("Clearing AsyncStorage...");
      await AsyncStorage.clear();
      console.log("AsyncStorage cleared successfully.");
    } catch (error) {
      console.error("Error clearing AsyncStorage:", error);
    }
  };

  /**
   * Clear all data from SecureStore.
   * @async
   */
  const clearAllSecureStore = async () => {
    try {
      console.log("Clearing SecureStore...");
      // List all known keys to clear
      const keys = ["username", "clientId", "password"];
      await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(key)));
      console.log("SecureStore cleared successfully.");
    } catch (error) {
      console.error("Error clearing SecureStore:", error);
    }
  };

  /**
   * Handles the logout process.
   * Shows a confirmation dialog before proceeding with the logout action.
   * Clears AsyncStorage and calls the logout API upon confirmation.
   *
   * @function
   */
  const onPressLogout = () => {
    // Show confirmation dialog
    Alert.alert(
      t("confirm"), // Confirmation dialog title
      t("user_logout_confirmation_message"), // Confirmation message
      [
        {
          text: t("cancel"), // Option to cancel the logout process
          style: "cancel",
        },
        {
          text: t("user_logout"), // Option to confirm logout
          onPress: async () => {
            try {
              console.log("Logging out...");

              // Clear AsyncStorage (non-sensitive data)
              await clearAllAsyncStorage();
              console.log("AsyncStorage cleared.");

              // Clear SecureStore (sensitive data like tokens)
              await clearAllSecureStore();
              console.log("SecureStore cleared.");

              // Call the logout API to log out from the backend
              const logoutSuccess = await callLogoutApi();

              if (logoutSuccess) {
                // On successful logout, navigate to the Login screen
                navigation.replace("Login");
              } else {
                // If the logout API fails, show an alert to the user
                Alert.alert(
                  "Logout failed",
                  "Failed to logout. Please try again."
                );
              }
            } catch (error) {
              // Handle any errors that occur during the logout process
              console.error("Error during logout:", error);
              Alert.alert(
                "Error",
                "An error occurred while logging out. Please try again."
              );
            }
          },
        },
      ],
      { cancelable: false } // Prevent dismissing the dialog by tapping outside
    );
  };

  /**
   * Saves the user preferences (language and request queue settings) to AsyncStorage.
   * This method also changes the app's language and displays a success toast upon saving.
   * If the preferences have not changed, it simply clears the change-tracking state.
   *
   * @async
   * @callback
   * @returns {Promise<void>} Saves user preferences and handles success or failure.
   */
  const onSave = useCallback(async () => {
    try {
      console.log(
        "Saving preferences. Selected language:",
        selectedLanguage,
        "Request queue enabled:",
        isRequestQueueEnabled,
        "Selected theme:",
        selectedTheme
      );

      // Save selected language in AsyncStorage or remove if null.
      if (selectedLanguage === null) {
        // If the language selection is cleared, remove the stored language preference.
        await AsyncStorage.removeItem("preferredLanguage");
      } else {
        // Save the selected language preference in AsyncStorage.
        await AsyncStorage.setItem("preferredLanguage", selectedLanguage);
      }

      // Change the app's language using the i18n module.
      i18n.changeLanguage(selectedLanguage);

      // Save the request queue toggle state in AsyncStorage.
      await AsyncStorage.setItem(
        "isRequestQueueEnabled",
        JSON.stringify(isRequestQueueEnabled)
      );

      // Save selected theme in AsyncStorage.
      await AsyncStorage.setItem("preferredTheme", selectedTheme);

      // Update the initial values after saving.
      setInitialSelectedLanguage(selectedLanguage);
      setInitialIsRequestQueueEnabled(isRequestQueueEnabled);
      setInitialSelectedTheme(selectedTheme);

      updateTheme(selectedTheme);

      // Clear the change tracking state as preferences have been saved.
      setChanges([]);

      // Notify the user with a success message.
      showToast(t("preferences_saved"));
    } catch (error) {
      console.error("Error saving preferences in device:", error);

      // Display an alert to the user indicating that saving failed.
      Alert.alert(t("error"), t("save_preferences_failed"));
    }
  }, [selectedLanguage, isRequestQueueEnabled, selectedTheme, changes]);

  /**
   * Calls the logout API to log the user out from the backend.
   * The API doesn't return any response data, regardless of success or failure.
   *
   * This function sends a GET request to the logout endpoint and returns a boolean
   * indicating whether the API call was successful or not.
   *
   * The function utilizes `fetchData`, which is a helper function to handle API requests.
   *
   * @async
   * @function callLogoutApi
   * @returns {boolean} - Returns `true` if the logout was successful, otherwise `false`.
   */
  const callLogoutApi = async () => {
    try {
      console.log("Calling logout API...");

      // Send a GET request to the logout API endpoint.
      // The API doesn't return any content (success or failure),
      // so we expect an empty response or no meaningful data.
      await fetchData(API_ENDPOINTS.LOGOUT, "GET", {}, {});

      console.log("Logout API call successful.");

      // Return true to indicate that the logout request was successful.
      return true;
    } catch (error) {
      // Catch any errors that occur during the API call and log them.
      console.error("Error calling logout API:", error);

      // Return false to indicate that the logout request failed.
      return false;
    }
  };

  /**
   * Resets the changes made to the user preferences by reverting to the initial values.
   * This function uses `useCallback` to prevent unnecessary re-creation of the function
   * on each render. It only updates when `initialIsRequestQueueEnabled` or `initialSelectedLanguage` changes.
   *
   * @function handleDiscardChanges
   * @callback
   */
  const handleDiscardChanges = useCallback(() => {
    setIsRequestQueueEnabled(initialIsRequestQueueEnabled);
    setSelectedLanguage(initialSelectedLanguage);
    setChanges([]); // Clear any tracked changes after reverting
  }, [initialIsRequestQueueEnabled, initialSelectedLanguage]);

  /**
   * Determines if there are any unsaved changes in user preferences by checking if any field
   * has been modified from its initial state. This function uses `useMemo` to optimize the calculation,
   * preventing recalculations unless `changes` is updated.
   *
   * @function hasUnsavedChanges
   * @returns {boolean} Returns `true` if there are unsaved changes, otherwise `false`.
   */
  const hasUnsavedChanges = useMemo(() => {
    return changes.some((change) => change.changed);
  }, [changes]);

  /**
   * Fetch initial user preferences from AsyncStorage.
   */
  useEffect(() => {
    const fetchDataFromStorage = async () => {
      try {
        const [preferredLanguage, isQueueEnabled, preferredTheme] =
          await Promise.all([
            AsyncStorage.getItem("preferredLanguage"),
            AsyncStorage.getItem("isRequestQueueEnabled"),
            AsyncStorage.getItem("preferredTheme"),
          ]);
        if (preferredLanguage) {
          setSelectedLanguage(preferredLanguage);
          setInitialSelectedLanguage(preferredLanguage);
        }
        if (isQueueEnabled) {
          setIsRequestQueueEnabled(JSON.parse(isQueueEnabled));
          setInitialIsRequestQueueEnabled(JSON.parse(isQueueEnabled));
        }
        if (preferredTheme) {
          setSelectedTheme(preferredTheme);
          setInitialSelectedTheme(preferredTheme);
        }
      } catch (error) {
        console.error("Error fetching data from AsyncStorage:", error);
      }
    };
    fetchDataFromStorage();
  }, []);

  /**
   * Configures the navigation options for the preferences screen.
   *
   * This effect sets up the following navigation options:
   * - Sets the header title to the translated value of "user_preference".
   * - Disables the back swipe gesture for this screen.
   * - Adds a custom back button (`CustomBackButton`) on the left side of the header, which handles unsaved changes.
   * - Dynamically renders a save button on the right side of the header using `CustomButton`:
   *   - The save button is conditionally enabled or disabled based on the `saveDisabled` state.
   *   - When pressed, the save button triggers the `onSave` function to save user preferences.
   *   - The button's label, icon, and accessibility attributes are configured for usability and accessibility.
   *
   * This effect re-runs when any of the following dependencies change:
   * - `saveDisabled`: Indicates if the save button should be enabled or disabled.
   * - `onSave`: The function to call when saving preferences.
   * - `t`: The translation function for localizing strings.
   * - `navigation`: The navigation object used to set options.
   */
  const headerLeft = useCallback(
    () => (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton
          navigation={navigation}
          hasUnsavedChanges={hasUnsavedChanges}
          discardChanges={handleDiscardChanges}
          t={t}
        />
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
          {t("user_preference")}
        </Text>
      </View>
    ),
    [handleDiscardChanges, hasUnsavedChanges, navigation, t]
  );

  const headerRight = useCallback(
    () => (
      <View style={styles.headerRightContainer}>
        <View style={styles.saveButtonContainer}>
          <CustomButton
            onPress={onSave}
            label={t("save")}
            icon={{
              name: "content-save",
              library: "MaterialCommunityIcons",
              size: 24,
              color: "white",
            }}
            disabled={saveDisabled}
            backgroundColor={false}
            style={{ icon: { marginRight: 0 } }}
            labelStyle={styles.buttonLabelWhite}
            accessibilityLabel={t("save_user_info")}
            accessibilityRole="button"
            testID="save-user-info-button"
          />
        </View>
      </View>
    ),
    [onSave, saveDisabled, t]
  );

  return (
    <View style={styles.container}>
      <ScreenHeader left={headerLeft()} right={headerRight()} />
      <ScrollView style={styles.preferenceContainer}>
        {/* Container for content before the toggle switch */}
        <View style={styles.sectionContainer}>
          {userEmail && (
            <View style={styles.userInfoContainer}>
              <Text
                style={styles.userInfoLabel}
                accessibilityLabel="Email label"
                accessibilityRole="text"
              >
                {t("email")}:
              </Text>
              <Text
                style={[styles.userInfo, { flex: 1 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
                accessibilityLabel={`Email: ${userEmail}`}
                accessibilityRole="text"
              >
                {userEmail}
              </Text>
            </View>
          )}
          {userPhone && (
            <View style={styles.userInfoContainer}>
              <Text
                style={styles.userInfoLabel}
                accessibilityLabel="Phone label"
                accessibilityRole="text"
              >
                {t("phone")}:
              </Text>
              <Text
                style={[styles.userInfo, { flex: 1 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
                accessibilityLabel={`Phone: ${userPhone}`}
                accessibilityRole="text"
              >
                {userPhone}
              </Text>
            </View>
          )}
          {loggedInUserInfo.workScheduleName && (
            <View style={styles.userInfoContainer}>
              <Text
                style={styles.userInfoLabel}
                accessibilityLabel="Work schedule label"
                accessibilityRole="text"
              >
                {t("work_schedule")}:
              </Text>
              <Text
                style={[styles.userInfo, { flex: 1 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
                accessibilityLabel={`Work schedule: ${loggedInUserInfo.workScheduleName}`}
                accessibilityRole="text"
              >
                {loggedInUserInfo.workScheduleName}
              </Text>
            </View>
          )}
          {loggedInUserInfo.hireDate && (
            <View style={styles.userInfoContainer}>
              <Text
                style={styles.userInfoLabel}
                accessibilityLabel="Hire date label"
                accessibilityRole="text"
              >
                {t("hire_date")}:
              </Text>
              <Text
                style={[styles.userInfo, { flex: 1 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
                accessibilityLabel={`Hire date: ${format(
                  new Date(loggedInUserInfo.hireDate),
                  convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
                )}`}
                accessibilityRole="text"
              >
                {format(
                  new Date(loggedInUserInfo.hireDate),
                  convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
                )}
              </Text>
            </View>
          )}
        </View>
        {/* Container for the toggle switch */}
        <View style={styles.sectionContainer}>
          <View style={styles.toggleContainer}>
            <Text
              style={styles.toggleLabel}
              accessibilityLabel="Enable request queue label"
              accessibilityRole="text"
            >
              {t("enable_request_queue")}
            </Text>
            <TouchableOpacity
              style={styles.preferenceToggleButton}
              onPress={() => handleToggleChange(!isRequestQueueEnabled)}
              accessibilityLabel="Enable request queue toggle"
              accessibilityRole="switch"
              accessibilityState={{ checked: isRequestQueueEnabled }}
            >
              <Text style={styles.preferenceToggleText}>
                {isRequestQueueEnabled ? "On" : "Off"}
              </Text>
              <View
                style={[
                  styles.preferenceToggleIndicator,
                  isRequestQueueEnabled &&
                    styles.preferenceToggleIndicatorActive,
                ]}
              />
            </TouchableOpacity>
          </View>
          <Text
            style={styles.pickerLabel}
            accessibilityLabel="Select theme"
            accessibilityRole="text"
          >
            {t("user_select_theme")}
          </Text>
          <CustomPicker
            items={themes}
            initialValue={selectedTheme}
            onFilter={handleThemeChange}
            hideSearchInput={true}
            accessibilityLabel="Theme picker"
            accessibilityRole="dropdownlist"
            testID="theme-picker"
          />
          <Text
            style={styles.pickerLabel}
            accessibilityLabel="Select language"
            accessibilityRole="text"
          >
            {t("user_select_language")}
          </Text>
          <CustomPicker
            items={languages}
            initialValue={selectedLanguage}
            onFilter={handleLanguageChange}
            hideSearchInput={true}
            accessibilityLabel="Language picker"
            accessibilityRole="dropdownlist"
            testID="language-picker"
          />
          <Text style={styles.note}>Note: {t("cache_reset_message")}</Text>
        </View>
        {/* Logout button */}
        <CustomButton
          onPress={onPressLogout}
          label={t("user_logout")}
          icon={{
            name: "logout",
            library: "MaterialCommunityIcons",
            size: 24,
            color: "#000",
          }}
          backgroundColor={false}
          style={{ icon: { marginRight: 0 } }}
          labelStyle={styles.logoutButtonText}
          accessibilityLabel={t("user_logout")}
          accessibilityRole="button"
          testID="logout-button"
        />
      </ScrollView>
    </View>
  );
};

export default User;
