import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Absence from "../screens/Absence";
import Expense from "../screens/Expense";
import Home from "../screens/Home";
import Login from "../screens/Login";
import Timesheet from "../screens/Timesheet";
import AbsenceDetail from "../screens/AbsenceDetail";
import TimesheetDetail from "../screens/TimesheetDetail";
import ExpenseDetail from "../screens/ExpenseDetail";
import FieldEngineer from "../screens/FieldEngineer";
import FieldEngineerChecklistTemplateEdit from "../screens/FieldEngineerChecklistTemplateEdit";
import FieldEngineerChecklistTemplateList from "../screens/FieldEngineerChecklistTemplateList";
import FieldEngineerConfiguration from "../screens/FieldEngineerConfiguration";
import FieldEngineerDashboard from "../screens/FieldEngineerDashboard";
import FieldEngineerPolicyEdit from "../screens/FieldEngineerPolicyEdit";
import FieldEngineerPolicyList from "../screens/FieldEngineerPolicyList";
import FieldEngineerReviewTemplateEdit from "../screens/FieldEngineerReviewTemplateEdit";
import FieldEngineerReviewTemplateList from "../screens/FieldEngineerReviewTemplateList";
import FieldEngineerTaskDetail from "../screens/FieldEngineerTaskDetail";
import User from "../screens/User";
import Approval from "../screens/Approval";
import Help from "../screens/Help";

import CustomImagePicker from "../components/CustomImagePicker";
import Filters from "../components/filters/Filters";

import { useThemeStyles } from "../theme/useThemeStyles";

const Stack = createNativeStackNavigator();

/**
 * Main Navigator Component
 * This component is responsible for setting up the stack-based navigation for the app using React Navigation.
 * It defines all the routes (screens) in the app and how they can be navigated.
 */
const MainNavigator = () => {
  const styles = useThemeStyles();

  // useEffect hook to log when the MainNavigator component is mounted and unmounted.
  useEffect(() => {
    console.log("MainNavigator mounted");

    return () => {
      console.log("MainNavigator unmounted");
    };
  }, []);

  /**
   * Error handler for catching navigation-related errors.
   * This function will be invoked if any error occurs within the navigation context.
   * @param {Error} error - The error object caught by the navigation system.
   */
  const handleError = (error) => {
    console.error("Navigation error:", error); // Logging the error for debugging purposes.
  };

  return (
    // NavigationContainer: Provides the navigation context for the entire app,
    // enabling the app to manage navigation state and handle navigation actions.
    // The onError prop is used to catch and handle any navigation-related errors.
    // The accessibilityRole and accessibilityLabel props are used to improve accessibility
    // and facilitate testing by providing a role and label that can be queried in tests.
    <NavigationContainer
      onError={handleError}
      accessibilityRole="container"
      accessibilityLabel="navigation-container"
    >
      {/* Stack.Navigator: This is the component that defines the stack navigation for the app.
          initialRouteName defines the first screen to be shown when the app starts (in this case, the Login screen).
          screenOptions sets default options (like header style) for all screens. */}
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ ...styles.common.header, gestureEnabled: false }} // Applying the common header style to all screens
      >
        {/* Stack.Screen: Defines each screen in the stack.
            name is the unique name for the route.
            component is the React component that will be rendered for that screen. */}

        {/* Login screen configuration:
            - The Login screen will be shown first when the app loads (due to initialRouteName).
            - headerShown: false will hide the header for the Login screen. */}
        <Stack.Screen
          name="Login"
          component={Login}
          options={{ headerShown: false }}
        />

        {/* Other screens in the app: Home, Timesheet, TimesheetDetail, Expense, Absence, User, Approval */}
        <Stack.Screen
          name="Home"
          component={Home}
          options={{ headerLeft: null }}
        />
        <Stack.Screen name="Timesheet" component={Timesheet} />
        <Stack.Screen name="TimesheetDetail" component={TimesheetDetail} />
        <Stack.Screen name="Expense" component={Expense} />
        <Stack.Screen name="ExpenseDetail" component={ExpenseDetail} />
        <Stack.Screen name="Absence" component={Absence} />
        <Stack.Screen name="AbsenceDetail" component={AbsenceDetail} />
        <Stack.Screen name="User" component={User} />
        <Stack.Screen name="Approval" component={Approval} />
        <Stack.Screen name="FieldEngineer" component={FieldEngineerDashboard} />
        <Stack.Screen
          name="FieldEngineerConfiguration"
          component={FieldEngineerConfiguration}
        />
        <Stack.Screen
          name="FieldEngineerPolicies"
          component={FieldEngineerPolicyList}
        />
        <Stack.Screen
          name="FieldEngineerPolicyEdit"
          component={FieldEngineerPolicyEdit}
        />
        <Stack.Screen
          name="FieldEngineerChecklistTemplates"
          component={FieldEngineerChecklistTemplateList}
        />
        <Stack.Screen
          name="FieldEngineerChecklistTemplateEdit"
          component={FieldEngineerChecklistTemplateEdit}
        />
        <Stack.Screen
          name="FieldEngineerReviewTemplates"
          component={FieldEngineerReviewTemplateList}
        />
        <Stack.Screen
          name="FieldEngineerReviewTemplateEdit"
          component={FieldEngineerReviewTemplateEdit}
        />
        <Stack.Screen
          name="FieldEngineerAssignments"
          component={FieldEngineer}
        />
        <Stack.Screen
          name="FieldEngineerTaskDetail"
          component={FieldEngineerTaskDetail}
        />

        {/* CustomImagePicker screen with custom header options */}
        <Stack.Screen
          name="CustomImagePicker"
          component={CustomImagePicker}
          options={{ headerTitle: "" }} // The header will have no title for this screen
        />

        {/* Filters screen */}
        <Stack.Screen name="Filters" component={Filters} />

        <Stack.Screen name="Help" component={Help} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default MainNavigator;
