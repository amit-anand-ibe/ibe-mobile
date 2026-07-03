import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import Checkbox from "expo-checkbox";
import Ionicons from "@expo/vector-icons/Ionicons";

import Loader from "../components/Loader";
import { API_ENDPOINTS, APP, LOGIN_INPUTS_MAXLENGTH } from "../constants";
import { fetchData } from "../utils/APIUtils";
import { showToast } from "../utils/MessageUtils";
import {
  isMediumDevice,
  isSmallDevice,
  screenDimension,
} from "../utils/ScreenUtils";
import { useCommonStyles } from "../styles/common";
import { LoggedInUserInfoContext } from "../../context/LoggedInUserInfoContext";
import ibeLogo from "../assets/images/ibe-logo.jpg";

/**
 * Login component for user authentication.
 * @component
 * @param {Object} navigation - Navigation prop for navigation between screens.
 * @returns {JSX.Element} JSX element representing the Login component.
 */
const Login = ({ navigation }) => {
  const { t } = useTranslation();

  const common = useCommonStyles();

  const { loggedInUserInfo = {}, setLoggedInUserInfo } = useContext(
    LoggedInUserInfoContext
  );

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    clientId: "",
    showPassword: false,
    rememberMe: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const { username, password, clientId, showPassword, rememberMe } = formData;
  const logoWidth = screenDimension.width / 2;

  const version =
    Constants.expoConfig?.version || // Use this for local development and standalone builds
    Constants.manifest2?.extra?.expoClient?.version || // Use this for EAS builds
    "";

  /**
   * Updates the formData state with the given name and value.
   * @param {string} name - The name of the field to update.
   * @param {string} value - The new value for the field.
   */
  const handleInputChange = useCallback((name, value) => {
    setFormData((prevState) => ({ ...prevState, [name]: value }));
  }, []);

  const onUsernameChange = useCallback(
    (text) => handleInputChange("username", text),
    [handleInputChange]
  );

  const onPasswordChange = useCallback(
    (text) => handleInputChange("password", text),
    [handleInputChange]
  );

  const onClientIdChange = useCallback(
    (text) => handleInputChange("clientId", text),
    [handleInputChange]
  );

  const togglePasswordVisibility = () => {
    handleInputChange("showPassword", !showPassword);
  };

  /**
   * Asynchronously retrieves stored user credentials from SecureStore
   * and attempts to log in automatically if all credentials are available.
   * This function is memoized using useCallback to prevent unnecessary re-renders
   * and to maintain its reference across component re-renders.
   */
  const retrieveStoredCredentials = useCallback(async () => {
    try {
      // Retrieve stored username from SecureStore
      const storedUsername = await SecureStore.getItemAsync("username");
      // Retrieve stored client ID from SecureStore
      const storedClientId = await SecureStore.getItemAsync("clientId");
      // Retrieve stored password from SecureStore
      const storedPassword = await SecureStore.getItemAsync("password");

      // If a stored username exists, update the username input field
      if (storedUsername) {
        handleInputChange("username", storedUsername);
      }
      // If a stored client ID exists, update the client ID input field
      if (storedClientId) {
        handleInputChange("clientId", storedClientId);
      }
      // If a stored password exists, update the password input field
      if (storedPassword) {
        handleInputChange("password", storedPassword);
      }

      // If all stored credentials are available, attempt automatic login
      if (storedUsername && storedClientId && storedPassword) {
        await onPressLogin(storedUsername, storedPassword, storedClientId);
      }
    } catch (error) {
      // Log any error encountered during the retrieval process
      console.error("Error retrieving stored credentials:", error);
    }
  }, []);

  /**
   * useEffect hook that runs once when the component mounts.
   * It triggers the retrieval of stored credentials and attempts
   * automatic login if valid credentials are found.
   */
  useEffect(() => {
    retrieveStoredCredentials();

    // Register event listener for when the keyboard is shown
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        // Set the state to indicate that the keyboard is visible
        setIsKeyboardVisible(true);
      }
    );

    // Register event listener for when the keyboard is hidden
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        // Set the state to indicate that the keyboard is not visible
        setIsKeyboardVisible(false);
      }
    );

    // Cleanup function to remove the event listeners when the component unmounts
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [retrieveStoredCredentials]);

  /**
   * Validates the input fields for username, password, and client ID.
   * Displays appropriate error messages using a toast notification
   * if any of the fields are empty or invalid.
   *
   * @param {string} username - The entered username.
   * @param {string} password - The entered password.
   * @param {string} clientId - The entered client ID.
   * @returns {boolean} - Returns true if all inputs are valid, otherwise false.
   */
  const validateInputs = (username, password, clientId) => {
    // Check if the username is provided
    if (!username) {
      showToast(t("login_username_required"), "error");
      return false;
    }

    // Check if the username is alphanumeric
    if (!/^[a-zA-Z0-9]*$/.test(username)) {
      showToast(t("login_username_alphanumeric_required"), "error");
      return false;
    }

    // Check if the password is provided
    if (!password) {
      showToast(t("login_password_required"), "error");
      return false;
    }

    // Check if the client ID is provided
    if (!clientId) {
      showToast(t("login_clientId_required"), "error");
      return false;
    }

    // All inputs are valid
    return true;
  };

  /**
   * Updates global app user data after a successful login.
   * This function processes the response data from the authentication API
   * and updates the global `APP` settings and the `loggedInUserInfo` context.
   * It also logs detailed information about the logged-in user for debugging purposes.
   *
   * @function
   * @name updateAppUserData
   * @param {Object} data - The response data received from the authentication API.
   * @param {Object} data.User - The user object containing user details.
   * @param {Object} data.empWorkSchedue - The employee work schedule object.
   * @param {Object} data.empWorkCalendar - The employee work calendar object.
   * @param {string} data.clientid - The client ID for the login session.
   * @returns {void}
   */
  const updateAppUserData = (data) => {
    const {
      User: [user = {}] = [],
      empWorkSchedue = {},
      empWorkCalendar = {},
    } = data || {};

    APP.LOGIN_USER_CLIENT = data?.clientid || "m/d/y";
    APP.LOGIN_USER_DATE_FORMAT = user?.UserDateFormat || "m/d/y";
    APP.LOGIN_USER_EMPLOYEE_ID = user["Resource-id"] || "";
    APP.LOGIN_USER_PERSON_ID = user["Person-id"] || "";
    APP.LOGIN_USER_ID = user["User-id"] || "";
    APP.LOGIN_USER_LANGUAGE = user?.["User-preferences"]?.language || "en";

    // Create a new object for user info
    const newUserInfo = {
      personId: user["Person-id"] || "",
      knownAs: user["Resource-core-name-knownAs"] || "",
      name:
        user["Resource-core-name-fullName"] ||
        user["Person-name-knownAs"] ||
        user["Resource-core-name-knownAs"] ||
        "",
      userType: user["User-type"] || "",
      accessRoles: user["User-accessRoles"] || user.accessRoles || [],
      gender: user["Resource-core-gender"] || null,
      hireDate: user["Resource-core-hireDate"] || null,
      termDate: user["Resource-core-termDate"] || null,
      confirmationDate: user["Resource-core-confirmationDate"] || null,
      noticePeriod: user["Resource-core-noticePeriod"] || null,
      companyId: user["Resource-companyID"] || "",
      workScheduleExtId: empWorkSchedue.extID || "",
      workScheduleName: empWorkSchedue.name || "",
      timeConfirmationType: empWorkSchedue.timeConfirmationType || "",
      dailyStdHours: empWorkSchedue.dailyStdHours || 28800000,
      stdWorkHours: empWorkSchedue.stdWorkHours || 28800000,
      minWorkHours: empWorkSchedue.minWorkHours || 28800000,
      maxWorkHours: empWorkSchedue.maxWorkHours || 28800000,
      workHoursInterval: empWorkSchedue.workHoursInterval || "week",
      patterns: empWorkSchedue.patterns || [],
      calendarExtId: empWorkCalendar.extID || "",
      nonWorkingDates: empWorkCalendar.nonWorkingDates || [],
      nonWorkingDays: empWorkCalendar.nonWorkingDays || [],
      startOfWeek:
        empWorkCalendar.startOfWeek !== undefined
          ? empWorkCalendar.startOfWeek
          : 1,
    };

    // Update context or state with user information
    setLoggedInUserInfo(newUserInfo);

    // Create a new object without nonWorkingDates
    const { nonWorkingDates, ...userInfoWithoutNonWorkingDates } = newUserInfo;

    // Log the details of the user information without nonWorkingDates
    console.log(
      "Logged in details without nonWorkingDates:",
      userInfoWithoutNonWorkingDates
    );
  };

  /**
   * Handles the press event when the user clicks the login button.
   * Initiates the login process by calling the authentication API.
   *
   * This function performs input validation, handles API communication,
   * manages loading state, and processes authentication results. It also
   * stores credentials if the "Remember Me" option is enabled and navigates
   * to the Home screen upon successful login.
   *
   * @async
   * @function
   * @name onPressLogin
   * @param {string} username - The entered username.
   * @param {string} password - The entered password.
   * @param {string} clientId - The entered client ID.
   * @returns {void}
   */
  const onPressLogin = async (username, password, clientId) => {
    // Validate input fields
    if (!validateInputs(username, password, clientId)) {
      return;
    }

    // Dismiss the keyboard to improve user experience
    Keyboard.dismiss();

    setIsLoading(true);

    // Convert password to an array of ASCII values as required by the API
    const passwordInASCII = Array.from(password, (char) => char.charCodeAt(0));

    // Prepare authentication request data
    const authenticateData = {
      user: username,
      password: `[${passwordInASCII}]`, // API expects password as an array of ASCII values
      enterpriseID: parseInt(clientId, 10),
      remember: true,
      validateOnly: false,
      isPortal: "false",
    };

    const formData = new URLSearchParams(authenticateData);

    try {
      const authenticationResult = await fetchData(
        API_ENDPOINTS.AUTHENTICATE,
        "POST",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        formData.toString()
      );

      // Handle unsuccessful authentication
      if (!authenticationResult?.success) {
        showToast(
          authenticationResult?.param_msgText || t("login_error_message"),
          "error"
        );
        return;
      }

      if (rememberMe) {
        try {
          await SecureStore.setItemAsync("username", username);
          await SecureStore.setItemAsync("clientId", clientId);
          await SecureStore.setItemAsync("password", password);
        } catch (error) {
          console.error("Error storing credentials:", error);
        }
      }

      updateAppUserData(authenticationResult);

      // Navigate to the Home screen after successful login
      navigation.replace("Home", { authenticationResult });
    } catch (error) {
      showToast(t("login_exception_message"), "error");
      console.error("Error during authentication:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Login component rendering
  return (
    <KeyboardAvoidingView
      style={common.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      testID="login-screen"
    >
      {!isKeyboardVisible && (
        <View style={styles.header}>
          <Image
            style={{ width: logoWidth }}
            source={ibeLogo}
            resizeMode="contain"
            accessibilityLabel="ibe logo"
            testID="ibe-logo"
          />
        </View>
      )}
      <View style={styles.main}>
        <TextInput
          style={styles.input}
          placeholder={t("login_username_placeholder")}
          placeholderTextColor="#6b7280"
          maxLength={LOGIN_INPUTS_MAXLENGTH.USERNAME}
          value={username}
          onChangeText={onUsernameChange}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t("login_username_placeholder")}
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.password}
            placeholder={t("login_password_placeholder")}
            placeholderTextColor="#6b7280"
            secureTextEntry={!showPassword}
            maxLength={LOGIN_INPUTS_MAXLENGTH.PASSWORD}
            value={password}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onPasswordChange}
            accessibilityLabel={t("login_password_placeholder")}
          />
          <TouchableOpacity
            style={styles.iconButton}
            onPress={togglePasswordVisibility}
            accessibilityLabel={
              showPassword ? t("hide_password") : t("show_password")
            }
          >
            <Ionicons
              name={showPassword ? "eye-off" : "eye"}
              size={24}
              color="#374151"
            />
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          placeholder={t("login_clientId_placeholder")}
          placeholderTextColor="#6b7280"
          keyboardType="numeric"
          maxLength={LOGIN_INPUTS_MAXLENGTH.CLIENTID}
          value={clientId}
          onChangeText={onClientIdChange}
          accessibilityLabel={t("login_clientId_placeholder")}
        />
        <View style={styles.checkboxContainer}>
          <Checkbox
            style={styles.checkbox}
            value={rememberMe}
            color={rememberMe ? "#005eb8" : undefined}
            onValueChange={() => handleInputChange("rememberMe", !rememberMe)}
            accessibilityRole="checkbox"
            accessibilityLabel={t("login_rememberMe_text")}
          />
          <Text style={styles.checkboxText}>{t("login_rememberMe_text")}</Text>
        </View>
        <Pressable
          style={styles.loginButton}
          onPress={() => onPressLogin(username, password, clientId)}
          accessibilityRole="button"
          accessibilityLabel={t("login_button_text")}
        >
          <Text style={styles.loginButtonText}>{t("login_button_text")}</Text>
        </Pressable>
        {isLoading && <Loader />}
      </View>

      {/* Conditional Footer Rendering */}
      {!isKeyboardVisible && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t("login_version_text")} {version}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: {
    flex: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  main: {
    flex: 3,
    width: "100%",
    justifyContent: "center",
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c5cfdd",
    paddingVertical: "4%",
    paddingHorizontal: "5%",
    marginBottom: "4%",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    backgroundColor: "#fff",
    color: "#111827",
    fontSize: isSmallDevice ? 13 : isMediumDevice ? 16 : 18,
    fontWeight: "600",
  },
  passwordContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#c5cfdd",
    borderRadius: 10,
    marginBottom: "4%",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    backgroundColor: "#fff",
  },
  password: {
    flex: 1,
    paddingVertical: "4%",
    paddingHorizontal: "5%",
    color: "#111827",
    fontSize: isSmallDevice ? 13 : isMediumDevice ? 16 : 18,
    fontWeight: "600",
  },
  iconButton: {
    minWidth: 46,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: "4%",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderColor: "#374151",
    borderWidth: 1.5,
    marginRight: 8,
  },
  checkboxText: {
    color: "#111827",
    fontSize: isSmallDevice ? 13 : isMediumDevice ? 16 : 18,
    fontWeight: "600",
  },
  loginButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: "5%",
    borderRadius: 10,
    backgroundColor: "#005eb8",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  loginButtonText: {
    fontSize: isSmallDevice ? 14 : isMediumDevice ? 17 : 20,
    fontWeight: "bold",
    letterSpacing: 0,
    color: "white",
  },
  footer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: "#4b5563",
    fontSize: isSmallDevice ? 12 : isMediumDevice ? 14 : 16,
    fontWeight: "600",
  },
});

export default Login;
