import { useEffect } from "react";
import { RootSiblingParent } from "react-native-root-siblings";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

import i18n from "./src/i18n";
import MainNavigator from "./src/navigation/MainNavigator";

import { ApprovalUserInfoProvider } from "./context/ApprovalUserInfoContext";
import { ClientPathsProvider } from "./context/ClientPathsContext";
import { ConnectivityProvider } from "./context/ConnectivityContext";
import { LoggedInUserInfoProvider } from "./context/LoggedInUserInfoContext";
import {
  AbsenceForceRefreshProvider,
  ExpenseForceRefreshProvider,
  TimesheetForceRefreshProvider,
} from "./context/ForceRefreshContext";
import { RequestQueueProvider } from "./context/RequestQueueContext";
import {
  AbsenceSaveProvider,
  ExpenseSaveProvider,
  TimesheetSaveProvider,
} from "./context/SaveContext";
import { ThemeProvider } from "./src/theme/ThemeContext";

import OfflineView from "./src/components/offline/OfflineView";

/**
 * Function to get the initial language of the device/platform.
 * Works for both Expo SDK 52 and 53.
 * @returns {Promise<string>} The initial language
 */
const getInitialLanguage = async () => {
  try {
    // Check AsyncStorage for preferred language
    const preferredLanguage = await AsyncStorage.getItem("preferredLanguage");

    if (preferredLanguage) {
      console.log(`Preferred language from AsyncStorage: ${preferredLanguage}`);
      return preferredLanguage;
    }

    // Expo 53+ uses getLocales()
    let locale;
    if (typeof Localization.getLocales === "function") {
      const locales = Localization.getLocales();
      locale = locales && locales.length > 0 ? locales[0].languageCode : "en";
    } else {
      // Fallback for Expo 52 (Localization.locale exists here)
      locale = Localization.locale ? Localization.locale.split("-")[0] : "en";
    }

    console.log(`Device locale: ${locale}`);
    return locale && i18n.options.resources[locale] ? locale : "en";
  } catch (error) {
    console.error("Error fetching preferred language:", error);
    return "en";
  }
};

/**
 * Main App Component
 * This component initializes the app, sets up localization, and renders the main navigation component.
 */
const App = () => {
  useEffect(() => {
    /**
     * Function to initialize the app by setting up the initial language.
     */
    const initializeApp = async () => {
      try {
        // Get the initial language for the app
        const initialLanguage = await getInitialLanguage();
        console.log(`Setting initial language: ${initialLanguage}`);

        // Set the initial language for the i18n localization library
        await i18n.changeLanguage(initialLanguage);
      } catch (error) {
        console.error("Error initializing app:", error.message);
      }
    };

    // Call the initializeApp function when the component mounts
    initializeApp();
  }, []);

  return (
    <RootSiblingParent>
      {/* RootSiblingParent is used for displaying modals and other components outside of the regular component hierarchy */}
      <SafeAreaProvider>
        {/* SafeAreaProvider ensures that content doesn't overlap system insets (e.g., status bar, notch) */}
        <Providers>
          {/* Providers component wraps the app with various context providers */}
          <MainNavigator />
          {/* MainNavigator is the main navigation component */}
          <OfflineView />
          {/* OfflineView is a component to handle offline state */}
        </Providers>
      </SafeAreaProvider>
    </RootSiblingParent>
  );
};

/**
 * Providers Component
 * Wraps the application with various context providers.
 * @param {Object} props - The props to pass down to children.
 * @param {React.ReactNode} props.children - The child components to render within the providers.
 */
const Providers = ({ children }) => (
  <LoggedInUserInfoProvider>
    {/* Provides logged-in user information context */}
    <ApprovalUserInfoProvider>
      {/* Provides approval-related user information context.*/}
      <ConnectivityProvider>
        {/* Provides connectivity status context */}
        <RequestQueueProvider>
          {/* Manages request queue context */}
          <TimesheetSaveProvider>
            {/* Manages the save state related to the Timesheet module */}
            <ExpenseSaveProvider>
              {/* Manages the save state related to the Expense module */}
              <AbsenceSaveProvider>
                {/* Manages the save state related to the Absence module */}
                <TimesheetForceRefreshProvider>
                  {/* Provides force refresh context for Timesheet */}
                  <ExpenseForceRefreshProvider>
                    {/* Provides force refresh context for Expense */}
                    <AbsenceForceRefreshProvider>
                      {/* Provides force refresh context for Absence */}
                      <ClientPathsProvider>
                        {/* Provides context for managing client paths */}
                        <ThemeProvider>
                          {/* Provides theme context */}
                          {children}
                          {/* Render child components within the context providers */}
                        </ThemeProvider>
                      </ClientPathsProvider>
                    </AbsenceForceRefreshProvider>
                  </ExpenseForceRefreshProvider>
                </TimesheetForceRefreshProvider>
              </AbsenceSaveProvider>
            </ExpenseSaveProvider>
          </TimesheetSaveProvider>
        </RequestQueueProvider>
      </ConnectivityProvider>
    </ApprovalUserInfoProvider>
  </LoggedInUserInfoProvider>
);

export default App;
