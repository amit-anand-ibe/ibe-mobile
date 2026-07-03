import React, { createContext, useState } from "react";

// Creating the context to provide logged-in user information throughout the app
export const LoggedInUserInfoContext = createContext();

/**
 * LoggedInUserInfoProvider component wraps the children components to provide
 * the logged-in user's information context.
 *
 * @param {Object} props - React props
 * @param {React.ReactNode} props.children - Child components that will have access to the context
 *
 * @returns {JSX.Element} The provider component with children wrapped in context
 */
export const LoggedInUserInfoProvider = ({ children }) => {
  // State to hold logged-in user information
  const [loggedInUserInfo, setLoggedInUserInfo] = useState({
    userType: null,
    accessRoles: [],
    timeConfirmationType: "",
    hireDate: null,
    gender: null,
    termDate: null,
    confirmationDate: null,
    noticePeriod: null,
    personId: null,
    companyId: null,
    workScheduleExtId: null,
    workScheduleName: null,
    calendarExtId: null,
    nonWorkingDates: null,
    nonWorkingDays: null,
    startOfWeek: null,
    dailyStdHours: null,
    stdWorkHours: null,
    minWorkHours: null,
    maxWorkHours: null,
    workHoursInterval: null,
    patterns: null,
  });

  return (
    <LoggedInUserInfoContext.Provider
      value={{ loggedInUserInfo, setLoggedInUserInfo }}
    >
      {children}
    </LoggedInUserInfoContext.Provider>
  );
};
