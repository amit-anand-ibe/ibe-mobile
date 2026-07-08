import React, { useCallback, useEffect, useState, useRef } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

import {
  API_ENDPOINTS,
  APP,
  APP_ACTIVITY_ID,
  APP_NAME,
  BUSOBJCAT,
  BUSOBJCATMAP,
  INTSTATUS,
  PREFERRED_LANGUAGES,
  TEST_MODE,
} from "../constants";

import CustomButton from "../components/CustomButton";

import TimesheetDetailGeneral from "./TimesheetDetailGeneral";
import File from "./File";
import Comment from "./Comment";
import History from "./History";

import {
  fetchBusObjCatData,
  fetchData,
  getAppNameByCategory,
  isDoNotReplaceAnyList,
} from "../utils/APIUtils";
import {
  changeDateToAPIFormat,
  convertToDateFNSFormat,
  getRemarkText,
  isEqual,
  normalizeDateToUTC,
  setRemarkText,
} from "../utils/FormatUtils";
import { setOrClearLock } from "../utils/LockUtils";
import { showToast } from "../utils/MessageUtils";
import { screenDimension } from "../utils/ScreenUtils";
import updateFields from "../utils/UpdateUtils";
import { documentStatusCheck } from "../utils/WorkflowUtils";

import CustomBackButton from "../components/CustomBackButton";
import Loader from "../components/Loader";
import ScreenHeader from "../components/ScreenHeader";
import ThemedTopTabBar from "../components/ThemedTopTabBar";

import { useTimesheetForceRefresh } from "../../context/ForceRefreshContext";
import { useTimesheetSave } from "../../context/SaveContext";
import useEmployeeInfo from "../hooks/useEmployeeInfo";

import { format } from "date-fns";

const Tab = createMaterialTopTabNavigator();

const TimesheetDetail = ({ route, navigation }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { updateForceRefresh } = useTimesheetForceRefresh();

  const { notifySave } = useTimesheetSave();

  const updatedValuesRef = useRef({});

  const statusTemplateExtId = route?.params?.statusTemplateExtId;
  const selectedDate = route?.params?.selectedDate;
  const openedFromApproval = route?.params?.openedFromApproval;

  const [timesheetId, setTimesheetId] = useState(route?.params?.timesheetId);
  // Determine if the component is in edit mode (if a timesheet ID is provided)
  // True if editing an existing timesheet, false if creating a new one
  const [isEditMode, setIsEditMode] = useState(!!timesheetId);
  const [itemStatusIDMap, setItemStatusIDMap] = useState(null);
  const [currentStatus, setCurrentStatus] = useState({});
  const [listOfNextStatus, setListOfNextStatus] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updatedValues, setUpdatedValues] = useState({});

  const [timesheetFiles, setTimesheetFiles] = useState([]);
  const [timesheetComments, setTimesheetComments] = useState([]);
  const [timesheetType, setTimesheetType] = useState("");
  const [timesheetExtStatus, setTimesheetExtStatus] = useState({});
  const [timesheetStart, setTimesheetStart] = useState(null);
  const [timesheetEnd, setTimesheetEnd] = useState(null);
  const [timesheetRemark, setTimesheetRemark] = useState("");
  const [timesheetTotalTime, setTimesheetTotalTime] = useState(0);
  const [timesheetBillableTime, setTimesheetBillableTime] = useState(0);
  const [timesheetOverTime, setTimesheetOverTime] = useState(0);
  const [timesheetTasks, setTimesheetTasks] = useState([]);
  const [timesheetAbsences, setTimesheetAbsences] = useState(null);
  const [timesheetCompanyId, setTimesheetCompanyId] = useState("");
  const [timesheetEmployeeId, setTimesheetEmployeeId] = useState("");
  const [leaveDates, setLeaveDates] = useState([]);
  const [absenceDateHoursMap, setAbsenceDateHoursMap] = useState({});
  const [timesheetTypeDetails, setTimesheetTypeDetails] = useState({
    defaultAsHomeDefault: "",
    defaultInputDays: "",
    headerCommentRequired: "",
    itemCommentRequired: "",
    nonBillableComments: false,
    overtimeAllowed: false,
    validateWorkSchedule: "",
    validateIncrement: "",
    minTimeIncrement: "",
  });

  // Use custom hook to get the employeeInfo based on openedFromApproval flag
  const employeeInfo = useEmployeeInfo(openedFromApproval);

  // Destructuring necessary properties from employeeInfo
  const {
    timeConfirmationType,
    startOfWeek,
    workScheduleExtId,
    companyId,
    personId,
    patterns,
    minWorkHours,
    maxWorkHours,
    workHoursInterval,
    dailyStdHours,
    nonWorkingDates,
  } = employeeInfo;

  console.log(
    `Employee Info Loaded in Timesheet Detail: ${
      openedFromApproval ? "Approval User Info" : "Logged In User Info"
    }`,
    JSON.stringify({
      ...employeeInfo,
      nonWorkingDates: `Array of length ${nonWorkingDates.length}`,
    })
  );

  // Callback function to handle data from child component (timesheet general)
  const handleFindingLeaveDates = (leaveDates, absenceDateHoursMap) => {
    setLeaveDates(leaveDates);
    setAbsenceDateHoursMap(absenceDateHoursMap);
  };

  /**
   * Validates the total actual hours worked on each day against the standard work hours defined in the patterns.
   * This function accumulates the total actual hours for each day from the timesheet tasks and compares them
   * with the corresponding standard work hours from the patterns. It returns `true` if the actual hours are
   * greater than or equal to the standard work hours, or if validation is configured to suppress warnings/errors.
   * Otherwise, it returns `false` and shows an error or warning based on the configuration.
   *
   * @param {string} validateWorkSchedule - Configuration for validation behavior:
   *   - `"E"`: Show an error and return `false` if actual hours are less than standard work hours.
   *   - `"W"`: Show a warning if actual hours are less than standard work hours, but return `true`.
   *   - Any other value: No warning or error is shown, and `true` is returned.
   *
   * @returns {boolean} - Returns `true` if validation passes or if configured not to show warnings/errors, otherwise `false`.
   */
  const validateTimesheetHoursWithPatterns = (validateWorkSchedule) => {
    const daySeqMap = new Map();

    // Populate the map with standard work hours from valid pattern details.
    patterns?.forEach((pattern) => {
      if (pattern.intStatus === 3) return; // Skip patterns marked with intStatus 3.

      pattern.details.forEach((detail) => {
        if (detail.intStatus !== 3) {
          daySeqMap.set(detail.daySeq, detail.stdWorkHours);
        }
      });
    });

    const millisecondsToHours = (ms) => ms / 3600000; // Utility function to convert milliseconds to hours.

    // Map to accumulate total actual hours per day and store date for each day.
    const totalHoursPerDay = new Map();

    // Accumulate actual hours for each day by looping through the timesheet tasks.
    timesheetTasks?.forEach((task) => {
      task.items.forEach((item) => {
        const actualDate = new Date(item.start);
        const daySeq = actualDate.getUTCDay(); // Get day sequence as a number (0 = Sunday, 1 = Monday, etc.).
        const formattedDate = actualDate.toDateString();

        let actualHours = millisecondsToHours(item.actualTime);

        // Check if the date is a leave date
        if (leaveDates.includes(formattedDate)) {
          const absenceHours = absenceDateHoursMap[formattedDate];

          if (absenceHours) {
            // If absence hours exist, convert them to hours and add to the actual hours.
            actualHours += millisecondsToHours(absenceHours);
          } else {
            // If it's a holiday, use the daily standard hours.
            actualHours += millisecondsToHours(dailyStdHours);
          }
        }

        // Accumulate hours and store the date.
        if (!totalHoursPerDay.has(daySeq)) {
          totalHoursPerDay.set(daySeq, { hours: 0, date: actualDate });
        }
        totalHoursPerDay.get(daySeq).hours += actualHours;
      });
    });

    // Compare the total actual hours with standard work hours for each day.
    for (const [
      daySeq,
      { hours: totalActualHours, date },
    ] of totalHoursPerDay.entries()) {
      const stdWorkHours = daySeqMap.get(daySeq); // Get the standard work hours for the day.

      // Proceed with validation only if standard work hours are defined for that day.
      if (stdWorkHours !== undefined) {
        const stdHours = millisecondsToHours(stdWorkHours);

        // If actual hours are less than the standard work hours, handle based on the configuration.
        if (totalActualHours < stdHours) {
          const formattedDate = date.toDateString();

          const message = t("timesheet_patterns_validation_message", {
            actual: totalActualHours,
            standard: stdHours,
            date: formattedDate,
          });

          if (validateWorkSchedule === "E") {
            // If configured to show an error, display it and return false.
            showToast(message, "error");
            return false;
          } else if (validateWorkSchedule === "W") {
            // If configured to show a warning, display it.
            showToast(message, "warning");
          }
        }
      }
    }

    return true; // Return true if validation passes or if configured not to show warnings/errors.
  };

  /**
   * Validates the total actual hours worked on each day against the defined minimum and maximum hours.
   * This function accumulates the total actual hours for each day from the timesheet tasks and compares them
   * with the corresponding minimum and maximum hours. If the actual hours are within the allowed range,
   * or if the validation is configured to suppress warnings/errors, the function returns `true`. Otherwise,
   * it returns `false` and displays an error or warning based on the configuration.
   *
   * @param {string} validateWorkSchedule - Configuration for validation behavior:
   *   - `"E"`: Show an error and return `false` if actual hours are outside the min/max range.
   *   - `"W"`: Show a warning if actual hours are outside the min/max range, but return `true`.
   *   - Any other value: No warning or error is shown, and `true` is returned.
   *
   * @returns {boolean} - Returns `true` if validation passes or if configured not to show warnings/errors, otherwise `false`.
   */
  const validateTimesheetDayHoursWithMinMax = (validateWorkSchedule) => {
    const millisecondsToHours = (ms) => ms / 3600000; // Utility function to convert milliseconds to hours.

    // Map to accumulate total actual hours per day and store date for each day.
    const totalHoursPerDay = new Map();

    // Accumulate actual hours for each day by looping through the timesheet tasks.
    timesheetTasks?.forEach((task) => {
      task.items.forEach((item) => {
        const actualDate = new Date(item.start);
        const daySeq = actualDate.getUTCDay(); // Get day sequence as a number (0 = Sunday, 1 = Monday, etc.).
        const formattedDate = actualDate.toDateString();

        // Initialize actual hours with the item's actual time converted to hours.
        let actualHours = millisecondsToHours(item.actualTime);

        // If the date is a leave date, check if it is in the absence map.
        if (leaveDates.includes(formattedDate)) {
          const absenceHours = absenceDateHoursMap[formattedDate];

          if (absenceHours) {
            // If absence hours exist, convert them to hours and add to the actual hours.
            actualHours += millisecondsToHours(absenceHours);
          } else {
            // If it's a holiday (in leaveDates but not in absenceDateHoursMap), skip further validation for this day.
            return;
          }
        }

        // Accumulate hours and store the date.
        if (!totalHoursPerDay.has(daySeq)) {
          totalHoursPerDay.set(daySeq, { hours: 0, date: actualDate });
        }
        totalHoursPerDay.get(daySeq).hours += actualHours;
      });
    });

    // Compare the total actual hours with the min/max hours for each day.
    for (const [
      daySeq,
      { hours: totalActualHours, date },
    ] of totalHoursPerDay.entries()) {
      const formattedDate = date.toDateString();

      const minHours = millisecondsToHours(minWorkHours);
      const maxHours = millisecondsToHours(maxWorkHours);

      if (totalActualHours < minHours) {
        // If total hours are less than minimum hours, show message
        const message = t("timesheet_min_hours_day_validation_message", {
          actual: totalActualHours,
          min: minHours,
          date: formattedDate,
        });

        if (validateWorkSchedule === "E") {
          showToast(message, "error");
          return false;
        } else if (validateWorkSchedule === "W") {
          showToast(message, "warning");
        }
      }

      if (totalActualHours > maxHours) {
        // If total hours are more than maximum hours, show message
        const message = t("timesheet_max_hours_day_validation_message", {
          actual: totalActualHours,
          max: maxHours,
          date: formattedDate,
        });

        if (validateWorkSchedule === "E") {
          showToast(message, "error");
          return false;
        } else if (validateWorkSchedule === "W") {
          showToast(message, "warning");
        }
      }
    }

    return true; // Return true if validation passes or if configured not to show warnings/errors.
  };

  /**
   * Validates the total actual hours worked in each period (week, bi-week, etc.) against the defined minimum and maximum hours.
   * Accumulates the total actual hours for each period from the timesheet tasks and compares them
   * with the corresponding minimum and maximum hours. Shows an error or warning if the total hours
   * are outside the specified range, based on the configuration.
   *
   * @param {string} validateWorkSchedule - Configuration for validation behavior:
   *   - `"E"`: Show an error and return `false` if actual hours are outside the min/max range.
   *   - `"W"`: Show a warning if actual hours are outside the min/max range, but return `true`.
   *   - Any other value: No warning or error is shown, and `true` is returned.
   * @param {string} period - The period in days to validate (e.g., 7 for weekly, 14 for bi-weekly).
   * @returns {boolean} - Returns `true` if validation passes or if configured not to show warnings/errors, otherwise `false`.
   */
  const validatePeriodTimesheetHours = (validateWorkSchedule, period) => {
    const millisecondsToHours = (ms) => ms / 3600000; // Utility function to convert milliseconds to hours.
    const periodMap = new Map(); // Map to accumulate total actual hours per date

    // Convert timesheet start and end date strings to Date objects
    const start = new Date(timesheetStart);
    const end = new Date(timesheetEnd);

    // Initialize periodMap with all dates between start and end, setting hours to 0 initially
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toDateString();
      periodMap.set(dateKey, 0); // Initialize hours to 0 for each date
    }

    // Update periodMap based on leaveDates
    leaveDates.forEach((leaveDate) => {
      const formattedDate = new Date(leaveDate).toDateString();
      const absenceHours = absenceDateHoursMap[formattedDate];

      if (periodMap.has(formattedDate)) {
        // If it's an absence date, set the corresponding absence hours
        if (absenceHours) {
          periodMap.set(formattedDate, millisecondsToHours(absenceHours));
        } else {
          // If it's a holiday, set the daily standard hours
          periodMap.set(formattedDate, millisecondsToHours(dailyStdHours));
        }
      }
    });

    // Accumulate actual hours for each day by looping through the timesheet tasks
    timesheetTasks?.forEach((task) => {
      task.items.forEach((item) => {
        const actualDate = new Date(item.start);
        const actualHours = millisecondsToHours(item.actualTime);
        const dateKey = actualDate.toDateString();

        // Update periodMap if the date exists in the map
        if (periodMap.has(dateKey)) {
          periodMap.set(dateKey, periodMap.get(dateKey) + actualHours);
        }
      });
    });

    // Convert min and max work hours from milliseconds to hours
    const minHours = millisecondsToHours(minWorkHours);
    const maxHours = millisecondsToHours(maxWorkHours);

    // Validate the accumulated hours for each period
    let periodStart = new Date(start); // Initialize period start date

    while (periodStart <= end) {
      let periodHours = 0; // Initialize period hours to 0

      // Accumulate hours for the current period
      for (let i = 0; i < period; i++) {
        const currentDay = new Date(periodStart);
        currentDay.setDate(periodStart.getDate() + i);
        if (currentDay > end) break;

        const dateKey = currentDay.toDateString();
        periodHours += periodMap.get(dateKey) || 0;
      }

      // Calculate the formatted periodStartDate for the current period
      const periodStartDate = periodStart.toDateString();

      // Check if the period hours are within the min and max range
      if (periodHours < minHours || periodHours > maxHours) {
        let message;
        if (periodHours < minHours) {
          message = t("timesheet_min_hours_period_validation_message", {
            actual: periodHours,
            min: minHours,
            periodName: workHoursInterval,
            periodStartDate,
          });
        } else if (periodHours > maxHours) {
          message = t("timesheet_max_hours_period_validation_message", {
            actual: periodHours,
            max: maxHours,
            periodName: workHoursInterval,
            periodStartDate,
          });
        }

        // Show error or warning based on the validateWorkSchedule configuration
        if (message) {
          if (validateWorkSchedule === "E") {
            showToast(message, "error");
            return false;
          } else if (validateWorkSchedule === "W") {
            showToast(message, "warning");
          }
        }
      }

      // Move to the next period
      periodStart.setDate(periodStart.getDate() + period);
    }

    return true; // Return true if validation passes or if configured not to show warnings/errors
  };

  /**
   * Fetches the selected date period from the timesheet type based on its external ID.
   *
   * This function sends a request to an API endpoint to fetch timesheet type details. It retrieves
   * information such as default settings, comment requirements, and period schedules. It then
   * identifies the most recent valid period and returns its dates. If no valid period is found or
   * if an error occurs, appropriate error messages are shown to the user.
   *
   * @param {string} timesheetTypeExtId - The external ID of the timesheet type to fetch.
   * @returns {Promise<object>} - A promise that resolves to an object containing the valid period dates.
   */
  const fetchSelectedDatePeriodFromTimesheetType = async (
    timesheetTypeExtId
  ) => {
    try {
      // Define the fields and conditions for the query
      const queryFields = {
        fields: [
          "TimeConfType-extID",
          "TimeConfType-defaultAsHomeDefault",
          "TimeConfType-defaultInputDays",
          "TimeConfType-headerCommentRequired",
          "TimeConfType-itemCommentRequired",
          "TimeConfType-maxTasksPreload",
          "TimeConfType-minTimeIncrement",
          "TimeConfType-nonBillableComments",
          "TimeConfType-overtimeAllowed",
          "TimeConfType-validateWorkSchedule",
          "TimeConfType-periodSchedules",
        ],
        where: [
          {
            fieldName: "TimeConfType-busObjCat",
            operator: "=",
            value: "TimeConfirmationType",
          },
        ],
      };

      // Define common query parameters
      const commonQueryParams = {
        testMode: TEST_MODE,
        client: parseInt(APP.LOGIN_USER_CLIENT),
        user: APP.LOGIN_USER_ID,
        userID: APP.LOGIN_USER_ID,
        language: APP.LOGIN_USER_LANGUAGE,
        intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      };

      // Prepare form data for the API request
      const formData = {
        query: JSON.stringify(queryFields),
        ...commonQueryParams,
      };

      // Fetch data from the API
      const response = await fetchData(
        API_ENDPOINTS.QUERY,
        "POST",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        new URLSearchParams(formData).toString()
      );

      // Check if the response is successful and contains valid data
      if (
        response.success === true &&
        Array.isArray(response.data) &&
        response.data.length > 0
      ) {
        // Find the data object with the desired external ID
        const data = response.data.find(
          (item) => item["TimeConfType-extID"] === timesheetTypeExtId
        );

        if (data) {
          // Extract period schedules and set timesheet type details
          const fetchedPeriodSchedules =
            data["TimeConfType-periodSchedules"] || [];
          setTimesheetTypeDetails({
            defaultAsHomeDefault:
              data["TimeConfType-defaultAsHomeDefault"] || "",
            defaultInputDays: data["TimeConfType-defaultInputDays"] || "",
            headerCommentRequired:
              data["TimeConfType-headerCommentRequired"] || "",
            itemCommentRequired: data["TimeConfType-itemCommentRequired"] || "",
            minTimeIncrement: data["TimeConfType-minTimeIncrement"] || "",
            nonBillableComments:
              data["TimeConfType-nonBillableComments"] || false,
            overtimeAllowed: data["TimeConfType-overtimeAllowed"] || false,
            validateWorkSchedule:
              data["TimeConfType-validateWorkSchedule"] || "",
            periodSchedules: fetchedPeriodSchedules,
          });

          if (fetchedPeriodSchedules && fetchedPeriodSchedules.length > 0) {
            // Check if there are any fetched period schedules
            // If there are, proceed to get the most recent valid period from the timesheet type

            const mostRecentPeriod = await getValidPeriodFromTimesheetType(
              fetchedPeriodSchedules
            );

            if (mostRecentPeriod && mostRecentPeriod.periodSchedule) {
              // If a valid period is found and it has a period schedule, log the period schedule ID

              console.log(
                "Most recent valid period id:",
                mostRecentPeriod.periodSchedule
              );

              // Fetch the valid period dates based on the period schedule
              const validPeriodForSelectedDate =
                await getValidPeriodDatesFromPeriodSchedule(
                  mostRecentPeriod.periodSchedule
                );

              // Return the valid period dates for the selected date
              return validPeriodForSelectedDate;
            } else if (mostRecentPeriod && mostRecentPeriod.validFromDate) {
              // If no period schedule but validFromDate exists, calculate a weekly period
              console.log(
                "No period schedule found, falling back to a weekly interval based on validFromDate."
              );

              return normalizePeriodToWeek(
                {
                  from: selectedDate,
                  to: selectedDate,
                },
                startOfWeek
              );
            } else {
              // If the most recent period does not exist or does not refer to a valid period schedule id
              console.log(
                "Valid period not found in the maintained period schedules for the timesheet type."
              );
              showToast(t("no_valid_period_in_timesheet_type"), "error");
              return;
            }
          } else {
            // If no period schedules are found, log a message
            // Default to a weekly interval based on the selected date

            console.log(
              "The timesheet type does not have any period maintained, so it will default to a weekly interval."
            );

            return normalizePeriodToWeek(
              {
                from: selectedDate,
                to: selectedDate,
              },
              startOfWeek
            );
          }
        } else {
          // Handle case where no timesheet type is found with the given external ID
          console.error(
            `No timesheet type found with extID ${timesheetTypeExtId}`
          );
          showToast(t("no_timesheet_type_found"), "error");
        }
      } else {
        // Handle case where the response format is unexpected or the data array is empty
        console.error("Unexpected response format or empty data array.");
        showToast(t("error_fetching_data"), "error");
      }
    } catch (error) {
      // Handle any errors that occur during the fetch operation
      console.error(
        "Error in fetchSelectedDatePeriodFromTimesheetType:",
        error
      );
      showToast(t("error_fetching_data"), "error");
    }
  };

  const getValidPeriodFromTimesheetType = (periodSchedules) => {
    // Convert the selectedDate to a JavaScript Date object if it is not already
    const selectedDateObj = new Date(selectedDate);

    // Filter the period schedules to find the valid ones
    const validPeriods = periodSchedules.filter((record) => {
      const validFromDate = new Date(record.validFromDate);
      return validFromDate.getTime() <= selectedDateObj.getTime();
    });

    // Sort the valid periods by validFromDate in descending order
    validPeriods.sort((a, b) => {
      return (
        new Date(b.validFromDate).getTime() -
        new Date(a.validFromDate).getTime()
      );
    });

    // Return the most recent valid period or null if none are found
    return validPeriods.length > 0 ? validPeriods[0] : null;
  };

  const getValidPeriodDatesFromPeriodSchedule = async (periodScheduleId) => {
    const queryFields = {
      fields: [
        "PeriodSchedule-id",
        "PeriodSchedule-extID",
        "PeriodSchedule-periods",
      ],
      where: [
        {
          fieldName: "PeriodSchedule-extID",
          operator: "=",
          value: periodScheduleId,
        },
      ],
    };

    const commonQueryParams = {
      testMode: TEST_MODE,
      client: parseInt(APP.LOGIN_USER_CLIENT),
      user: APP.LOGIN_USER_ID,
      userID: APP.LOGIN_USER_ID,
      language: APP.LOGIN_USER_LANGUAGE,
      intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
    };

    const formData = {
      query: JSON.stringify(queryFields),
      ...commonQueryParams,
    };

    try {
      const response = await fetchData(
        API_ENDPOINTS.QUERY,
        "POST",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        new URLSearchParams(formData).toString()
      );

      if (
        response.success === true &&
        response.data &&
        response.data instanceof Array &&
        response.data.length > 0
      ) {
        const data = response.data[0];

        const validPeriodDates = getValidPeriodFromPeriodSchedule(
          data["PeriodSchedule-periods"],
          selectedDate
        );

        if (!validPeriodDates) {
          showToast(
            t("period_schedule_missing_valid_date", { periodScheduleId }),
            "error"
          );
          console.error(
            `The period schedule with extID ${periodScheduleId} has an incorrect valid from date setup`
          );

          return;
        }

        return validPeriodDates;
      } else {
        showToast(t("period_schedule_missing", { periodScheduleId }), "error");
        console.error(
          `No period schedule data found with extID ${periodScheduleId}`
        );

        return;
      }
    } catch (error) {
      console.error("Failed to fetch period schedule data:", error);
      return;
    }
  };

  const getValidPeriodFromPeriodSchedule = (periods, selectedDate) => {
    if (periods && periods.length > 0) {
      // Normalize the selectedDate to ignore the time part
      const normalizedSelectedDate = normalizeDateToUTC(new Date(selectedDate));

      // Start searching from the end of the array
      for (let i = periods.length - 1; i >= 0; i--) {
        const periodRec = periods[i];

        if (!periodRec.start || !periodRec.end) {
          continue;
        }

        const startPeriod = normalizeDateToUTC(new Date(periodRec.start));
        const endPeriod = normalizeDateToUTC(new Date(periodRec.end));

        const locPeriod = { from: startPeriod, to: endPeriod };

        if (dateLiesInRange(normalizedSelectedDate, locPeriod)) {
          return {
            start: periodRec.start, // Return original date strings
            end: periodRec.end,
          };
        }
      }
    }
    return null;
  };

  // Function to check if a date lies within a range
  const dateLiesInRange = (date, range) => {
    return date >= range.from && date <= range.to;
  };

  const normalizePeriodToWeek = (period, startOfWeek) => {
    if (period && period.from && period.to) {
      // Clone the 'from' date
      const fromDate = new Date(period.from);

      // Adjust 'fromDate' to the start of the week based on 'startOfWeek'
      fromDate.setDate(
        fromDate.getDate() -
          fromDate.getDay() +
          startOfWeek -
          (startOfWeek > fromDate.getDay() ? 7 : 0)
      );

      // Create a 'toDate' as 6 days after the 'fromDate'
      const toDate = new Date(fromDate);
      toDate.setDate(toDate.getDate() + 6);

      // Return the normalized period
      return {
        start: changeDateToAPIFormat(normalizeDateToUTC(fromDate)),
        end: changeDateToAPIFormat(normalizeDateToUTC(toDate)),
      };
    }
  };

  const handleTimesheetDetailChange = (values) => {
    // Return early if timesheetType is not set to avoid comparing with initial empty value.
    if (!timesheetType) {
      return;
    }

    console.log(
      `Updated values in Timesheet Detail: ${JSON.stringify(values)}`
    );

    const updatedChanges = { ...updatedValues };

    if (
      values.timesheetRemark !== undefined &&
      !isEqual(values.timesheetRemark, timesheetRemark)
    ) {
      setTimesheetRemark(values.timesheetRemark);
      updatedChanges["remark:text"] = getRemarkText(
        values.timesheetRemark,
        lang,
        PREFERRED_LANGUAGES
      );
    }
    if (
      values.timesheetTasks !== undefined &&
      !isEqual(values.timesheetTasks, timesheetTasks)
    ) {
      setTimesheetTasks(values.timesheetTasks);
      updatedChanges["tasks"] = values.timesheetTasks;
      if (
        values.timesheetTotalTime !== undefined &&
        values.timesheetTotalTime !== timesheetTotalTime
      ) {
        setTimesheetTotalTime(values.timesheetTotalTime);
        updatedChanges["totalTime"] = values.timesheetTotalTime;
      }
      if (
        values.timesheetBillableTime !== undefined &&
        values.timesheetBillableTime !== timesheetBillableTime
      ) {
        setTimesheetBillableTime(values.timesheetBillableTime);
        updatedChanges["billableTime"] = values.timesheetBillableTime;
      }
      if (
        values.timesheetOverTime !== undefined &&
        values.timesheetOverTime !== timesheetOverTime
      ) {
        setTimesheetOverTime(values.timesheetOverTime);
        updatedChanges["totalOvertime"] = values.timesheetOverTime;
      }
    }
    if (
      values.timesheetFiles !== undefined &&
      !isEqual(values.timesheetFiles, timesheetFiles)
    ) {
      setTimesheetFiles(values.timesheetFiles);
      updatedChanges["files"] = values.timesheetFiles;
    }
    if (
      values.timesheetComments !== undefined &&
      !isEqual(values.timesheetComments, timesheetComments)
    ) {
      setTimesheetComments(values.timesheetComments);
      updatedChanges["comments"] = values.timesheetComments;
    }

    console.log(
      `Updated changes in Timesheet Detail: ${JSON.stringify(updatedChanges)}`
    );

    // Update the ref
    updatedValuesRef.current = updatedChanges;
    // Update the changes state
    setUpdatedValues(updatedChanges);
  };

  const validateTimesheetOnSave = () => {
    // Destructure the headerCommentRequired property from the timesheetTypeDetails object
    const { headerCommentRequired, validateWorkSchedule } =
      timesheetTypeDetails;

    // Check if the timesheet start date is provided
    if (!timesheetStart) {
      // Show an alert indicating that the start date is required
      Alert.alert(
        t("validation_error"), // Title of the alert
        t("start_required_message"), // Message of the alert
        [{ text: t("ok"), style: "cancel" }], // Button configuration
        { cancelable: false } // Prevents closing the alert by tapping outside
      );
      return false; // Return false to prevent saving
    }

    // Check if the timesheet end date is provided
    if (!timesheetEnd) {
      // Show an alert indicating that the end date is required
      Alert.alert(
        t("validation_error"),
        t("end_required_message"),
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false; // Return false to prevent saving
    }

    // Check if the company ID is provided
    if (!timesheetCompanyId) {
      // Show an alert indicating that the company ID is required
      Alert.alert(
        t("validation_error"),
        t("company_required_message"),
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false; // Return false to prevent saving
    }

    // Check if the employee ID is provided
    if (!timesheetEmployeeId) {
      // Show an alert indicating that the employee ID is required
      Alert.alert(
        t("validation_error"),
        t("employee_required_message"),
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false; // Return false to prevent saving
    }

    // Get the header remark text based on the provided timesheet remark and language settings
    const headerRemarkText = getRemarkText(
      timesheetRemark,
      lang,
      PREFERRED_LANGUAGES
    );

    // Check if the header remark is required but missing
    if (!headerRemarkText) {
      if (headerCommentRequired === "E") {
        // "E" stands for "Error"
        // Show an alert indicating that the header remark is required
        Alert.alert(
          t("validation_error"),
          t("timesheet_header_remark_required_message"),
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false; // Return false to prevent saving
      }
      if (headerCommentRequired === "W") {
        // "W" stands for "Warning"
        // Show a warning toast indicating that the header remark is recommended
        showToast(t("timesheet_header_remark_recommended_message"), "warning");
      }
    }

    if (validateWorkSchedule) {
      console.log("Validation work schedule is enabled:", validateWorkSchedule);

      // Validate timesheet hours with patterns if patterns exist
      if (patterns?.length > 0) {
        console.log(
          "Patterns exist. Validating timesheet hours with patterns..."
        );
        const isValid =
          validateTimesheetHoursWithPatterns(validateWorkSchedule);

        if (!isValid) {
          console.log("Timesheet hours validation with patterns failed.");
          return false; // Return false if validation fails
        } else {
          console.log("Timesheet hours validation with patterns passed.");
        }
      } else {
        console.log(
          "No patterns found. Proceeding to validate with min/max hours..."
        );

        if (workHoursInterval === "day") {
          console.log(
            "Work hours interval is set to 'day'. Validating day hours with min/max..."
          );
          const isValid =
            validateTimesheetDayHoursWithMinMax(validateWorkSchedule);

          if (!isValid) {
            console.log("Day hours validation with min/max failed.");
            return false; // Return false if validation fails
          } else {
            console.log("Day hours validation with min/max passed.");
          }
        } else if (workHoursInterval === "week") {
          console.log(
            "Work hours interval is set to 'week'. Validating week hours with min/max..."
          );
          // Validate the timesheet hours for a weekly period (7 days)
          const isValid = validatePeriodTimesheetHours(validateWorkSchedule, 7);

          if (!isValid) {
            console.log("Week hours validation with min/max failed.");
            return false; // Return false if validation fails
          } else {
            console.log("Week hours validation with min/max passed.");
          }
        }
      }
    }

    // If all validations pass, return true to proceed with saving
    return true;
  };

  /**
   * This function checks if there are unsaved changes by verifying if the `updatedValuesRef` object has any keys.
   * It uses the `useCallback` hook to ensure the function is only recreated when necessary, optimizing performance.
   *
   * @param {Object} updatedValuesRef - A reference object containing updated values. If it has any keys, it indicates unsaved changes.
   *
   * @returns {boolean} - Returns `true` if there are unsaved changes, otherwise `false`.
   */
  const hasUnsavedChanges = useCallback(() => {
    console.log(
      "Updated values reference (if any) in hasUnsavedChanges: ",
      JSON.stringify(updatedValuesRef)
    );

    return Object.keys(updatedValuesRef.current).length > 0;
  }, [updatedValuesRef]);

  const showUnsavedChangesAlert = (onDiscard) => {
    Alert.alert(
      t("unsaved_changes_title"),
      t("unsaved_changes_message"),
      [
        {
          text: t("cancel"),
          style: "cancel",
        },
        {
          text: t("discard"),
          style: "destructive",
          onPress: () => {
            // Reset updatedValuesRef.current and call onDiscard
            updatedValuesRef.current = {};
            setUpdatedValues({});
            onDiscard();
          },
        },
      ],
      { cancelable: false }
    );
  };

  const handleSave = async () => {
    try {
      if (timesheetTasks.length === 0) {
        showToast(t("timesheet_cannot_be_saved_without_items"), "error");
        return;
      }

      const isValidTimesheet = validateTimesheetOnSave();

      if (isValidTimesheet) {
        await updateTimesheet(updatedValues);
      }
    } catch (error) {
      console.error("Error in saving timesheet", error);
    }
  };

  /**
   * Updates the timesheet with the provided updated values.
   * This function sends a request to update the timesheet fields with the new values.
   * It handles the response, updates the state, and shows appropriate messages based on the result.
   *
   * @param {Object} updatedValues - The updated values for the timesheet fields.
   */
  const updateTimesheet = async (updatedValues = {}) => {
    try {
      // Prefix the updated values with the timesheet category prefix
      const prefixedUpdatedValues = {};
      for (const key in updatedValues) {
        prefixedUpdatedValues[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-${key}`] =
          updatedValues[key];
      }

      // Prepare the form data with the prefixed updated values
      const formData = {
        data: {
          [`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-id`]: timesheetId,
          ...prefixedUpdatedValues,
        },
      };

      // Define query string parameters for the update request
      const queryStringParams = {
        userID: APP.LOGIN_USER_ID,
        client: APP.LOGIN_USER_CLIENT,
        language: APP.LOGIN_USER_LANGUAGE,
        testMode: TEST_MODE,
        component: "platform",
        doNotReplaceAnyList: isDoNotReplaceAnyList(BUSOBJCAT.TIMESHEET),
        appName: JSON.stringify(getAppNameByCategory(BUSOBJCAT.TIMESHEET)),
      };

      // Send the update request and handle the response
      const updateResponse = await updateFields(formData, queryStringParams);

      // If the update response indicates failure, show an error message and exit
      if (!updateResponse.success) {
        showToast(t("update_failure"), "error");
        return;
      }

      // Check if any detail object in the response has success: false
      const details = updateResponse?.response?.details || [];
      const hasFailure = details.some((detail) => detail.success === false);

      if (hasFailure) {
        // Extract and show the first error message from the response
        const errorMessages = details.flatMap(
          (detail) =>
            detail.messages?.filter((msg) => msg.message_type === "error") || []
        );

        if (errorMessages.length > 0) {
          // Not showing toast message here as it has been done centrally in fetchData
          return;
        }
      }

      // Extract the new ID from the response and update the timesheetId state
      const newId = updateResponse.response?.details[0]?.data?.ids?.[0];
      if (newId) {
        setTimesheetId(newId);
        setIsEditMode(true);
      }

      // Clear the updated values reference and state
      updatedValuesRef.current = {};
      setUpdatedValues({});

      // Reload the timesheet data after saving
      handleReload();

      // Force refresh the timesheet data on the list screen
      updateForceRefresh(true);

      // Notify that the save action was clicked
      notifySave();

      // Show a success message if the language is not English
      if (lang !== "en") {
        showToast(t("update_success"));
      }

      // Show the header response message if available
      if (updateResponse.message) {
        showToast(updateResponse.message);
      }
    } catch (error) {
      // Handle any errors that occur during the update process
      console.error("Error in updateTimesheet of TimesheetDetail", error);
      showToast(t("unexpected_error"), "error");
    }
  };

  const handleLock = async () => {
    if (isEditMode) {
      const { changeAllowed } = await documentStatusCheck(
        t,
        APP_ACTIVITY_ID.TIMESHEET,
        BUSOBJCATMAP[BUSOBJCAT.TIMESHEET],
        timesheetId,
        timesheetType,
        timesheetExtStatus,
        setCurrentStatus,
        setListOfNextStatus
      );

      if (!changeAllowed) {
        return;
      }

      const action = isLocked ? "set" : "clear";
      setOrClearLock(
        action,
        BUSOBJCATMAP[BUSOBJCAT.TIMESHEET],
        timesheetId,
        setIsLocked,
        setLoading
      );
    }
  };

  /**
   * Handles reloading the timesheet data.
   * - Fetches the latest timesheet and absence data if there are no unsaved changes.
   * - Shows an alert to confirm discarding unsaved changes before fetching data.
   */
  const handleReload = () => {
    const reloadData = () => {
      fetchTimeAndAbsence(); // Fetch the latest timesheet and absence data
    };

    hasUnsavedChanges() ? showUnsavedChangesAlert(reloadData) : reloadData();
  };

  const handleDelete = () => {
    if (isEditMode) {
      Alert.alert(
        t("confirm_deletion_title"),
        t("confirm_deletion_message"),
        [
          {
            text: t("cancel"),
            style: "cancel",
          },
          {
            text: t("confirm"),
            onPress: async () => {
              try {
                const formData = {
                  data: {
                    [`${
                      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
                    }-component`]: `Client-${APP.LOGIN_USER_CLIENT}-all`,
                    [`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-extID`]: "",
                    [`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-id`]: timesheetId,
                    [`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-intStatus`]: 3,
                  },
                };

                const queryStringParams = {
                  language: APP.LOGIN_USER_LANGUAGE,
                  userID: APP.LOGIN_USER_ID,
                  appName: APP_NAME.TIMESHEET,
                  client: APP.LOGIN_USER_CLIENT,
                };

                const updateResponse = await updateFields(
                  formData,
                  queryStringParams
                );

                // Check if update was successful
                if (updateResponse.success) {
                  if (i18n.language !== "en") {
                    showToast(t("delete_success"));
                  }

                  updateForceRefresh(true);

                  // Go back to the previous screen (timesheet list)
                  navigation.goBack();
                } else {
                  showToast(t("delete_failure"), "error");
                }

                if (updateResponse.message) {
                  showToast(updateResponse.message);
                }
              } catch (error) {
                console.error(
                  "Error in handleDelete of TimesheetDetail",
                  error
                );
                showToast(t("unexpected_error"), "error");
              }
            },
          },
        ],
        { cancelable: true } // Allow the dialog to be canceled by tapping outside of it
      );
    }
  };

  const getTimesheetTypeFields = () => [
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-type:TimeConfType-defaultAsHomeDefault`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-type:TimeConfType-defaultInputDays`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-type:TimeConfType-headerCommentRequired`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-type:TimeConfType-itemCommentRequired`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-type:TimeConfType-maxTasksPreload`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-type:TimeConfType-minTimeIncrement`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-type:TimeConfType-nonBillableComments`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-type:TimeConfType-overtimeAllowed`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-type:TimeConfType-validateWorkSchedule`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-type:TimeConfType-validateIncrement`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-type:TimeConfType-minTimeIncrement`,
  ];

  const getTimesheetFields = () => [
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-id`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-type`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-extStatus`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-busUnitID`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-employeeID`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-files`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-comments`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-start`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-end`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-remark`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-totalTime`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-billableTime`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-totalOvertime`,
    // Below line is commented because when I send this in query a few task properties don't come in the response
    // `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks`, // commented out
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-subID`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-customerID`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-customerID:Customer-name-text`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-projectWbsID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-tasks-projectWbsID:ProjectWBS-text-text`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-projectWbsID:ProjectWBS-extID`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-taskID`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-taskID:Task-text-text`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-taskID:Task-extID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-tasks-taskID:Task-quantities-unitTime`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-tasks-taskID:Task-quantities-actualQuantity`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-tasks-taskID:Task-quantities-plannedQuantity`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-taskID:Task-type`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-tasks-taskID:Task-timeItemTypeNonEditable`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-billable`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-timeType`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-timeType:TimeItemType-id`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-timeType:TimeItemType-name`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-items`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-extStatus`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-extStatus-recipient`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-tasks-extStatus-recipient:Person-name-knownAs`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-extStatus-setBy`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-extStatus-setBy:User-personID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
    }-tasks-extStatus-setBy:User-personID:Person-name-knownAs`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-extStatus-statusID`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-taskTime`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-taskID:Task-dates-actualFinish`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-department`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-department:BusUnit-extID`,
    `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks-department:BusUnit-name-text`,
    ...getTimesheetTypeFields(), // Include the TimeConfType fields
  ];

  const loadTimesheetCreateDetail = async () => {
    try {
      if (!selectedDate) {
        return;
      }

      if (!workScheduleExtId) {
        showToast(t("no_workschedule_assigned"), "error");
        return;
      }

      const validPeriodDates = await fetchSelectedDatePeriodFromTimesheetType(
        timeConfirmationType
      );

      if (
        !validPeriodDates ||
        !validPeriodDates.start ||
        !validPeriodDates.end
      ) {
        showToast(t("timesheet_creation_error"), "error");
        console.error(
          "Timesheet cannot be created, start or end date missing."
        );

        return;
      }

      console.debug(validPeriodDates);

      if (validPeriodDates) {
        setTimesheetStart(validPeriodDates.start);
        setTimesheetEnd(validPeriodDates.end);
        setTimesheetCompanyId(companyId);
        setTimesheetEmployeeId(APP.LOGIN_USER_EMPLOYEE_ID);

        const defaultTimesheetRemark = `Timesheet from ${format(
          validPeriodDates.start,
          convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
        )} to ${format(
          validPeriodDates.end,
          convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
        )}`;
        setTimesheetRemark(
          setRemarkText(undefined, lang, defaultTimesheetRemark)
        );

        // Set the timesheet type here to ensure all required settings (e.g., start and end dates) are correctly applied,
        // preventing rendering issues or errors from incomplete configuration.
        setTimesheetType(timeConfirmationType);

        const updatedChanges = { ...updatedValues };

        updatedChanges["type"] = timeConfirmationType;
        updatedChanges["start"] = validPeriodDates.start;
        updatedChanges["end"] = validPeriodDates.end;
        updatedChanges["busUnitID"] = companyId;
        updatedChanges["employeeID"] = APP.LOGIN_USER_EMPLOYEE_ID;
        updatedChanges["responsible"] = personId;
        updatedChanges["remark:text"] = defaultTimesheetRemark;

        // Update the ref
        updatedValuesRef.current = updatedChanges;
        // Update the changes state
        setUpdatedValues(updatedChanges);
      }

      // The status check is not required in create mode, as there's no need to verify
      // if the document can be modified. However, since this operation also sets the
      // current status and next possible statuses, enabling the customStatus component
      // to display the workflow status, we are calling it here.
      await documentStatusCheck(
        t,
        APP_ACTIVITY_ID.TIMESHEET,
        BUSOBJCATMAP[BUSOBJCAT.TIMESHEET],
        timesheetId,
        timeConfirmationType,
        null, // Timesheet extStatus
        setCurrentStatus,
        setListOfNextStatus
      );
    } catch (error) {
      console.error("Error in loading timesheet create detail: ", error);
    } 
  };

  const loadTimesheetDetail = async () => {
    try {
      const queryFields = {
        fields: getTimesheetFields(),
        where: [
          {
            fieldName: `${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-id`,
            operator: "=",
            value: timesheetId,
          },
        ],
      };

      const commonQueryParams = {
        testMode: TEST_MODE,
        client: parseInt(APP.LOGIN_USER_CLIENT),
        user: APP.LOGIN_USER_ID,
        userID: APP.LOGIN_USER_ID,
        language: APP.LOGIN_USER_LANGUAGE,
        intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      };

      const formData = {
        query: JSON.stringify(queryFields),
        ...commonQueryParams,
      };

      const response = await fetchData(
        API_ENDPOINTS.QUERY,
        "POST",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        new URLSearchParams(formData).toString()
      );

      if (
        response.success === true &&
        response.data &&
        response.data instanceof Array &&
        response.data.length > 0
      ) {
        const data = response.data[0];

        setTimesheetFiles(data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-files`]);
        setTimesheetComments(
          data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-comments`]
        );
        setTimesheetCompanyId(
          data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-busUnitID`]
        );
        setTimesheetEmployeeId(
          data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-employeeID`]
        );
        setTimesheetStart(data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-start`]);
        setTimesheetEnd(data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-end`]);
        setTimesheetRemark(data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-remark`]);
        setTimesheetTotalTime(
          data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-totalTime`]
        );
        setTimesheetBillableTime(
          data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-billableTime`]
        );
        setTimesheetOverTime(
          data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-totalOvertime`]
        );
        setTimesheetTasks(data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-tasks`]);

        const fetchedTimesheetExtStatus =
          data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-extStatus`] || {};
        setTimesheetExtStatus(fetchedTimesheetExtStatus);

        const fetchedTimesheetType =
          data[`${BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}-type`] || "";
        setTimesheetType(fetchedTimesheetType);

        setTimesheetTypeDetails({
          defaultAsHomeDefault:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
              }-type:TimeConfType-defaultAsHomeDefault`
            ] || "",
          defaultInputDays:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
              }-type:TimeConfType-defaultInputDays`
            ] || "",
          headerCommentRequired:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
              }-type:TimeConfType-headerCommentRequired`
            ] || "",
          itemCommentRequired:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
              }-type:TimeConfType-itemCommentRequired`
            ] || "",
          maxTasksPreload:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
              }-type:TimeConfType-maxTasksPreload`
            ] || "",
          minTimeIncrement:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
              }-type:TimeConfType-minTimeIncrement`
            ] || "",
          nonBillableComments:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
              }-type:TimeConfType-nonBillableComments`
            ] || false,
          overtimeAllowed:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
              }-type:TimeConfType-overtimeAllowed`
            ] || false,
          validateWorkSchedule:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
              }-type:TimeConfType-validateWorkSchedule`
            ] || "",
          validateIncrement:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]
              }-type:TimeConfType-validateIncrement`
            ] || "",
        });

        const { changeAllowed } = await documentStatusCheck(
          t,
          APP_ACTIVITY_ID.TIMESHEET,
          BUSOBJCATMAP[BUSOBJCAT.TIMESHEET],
          timesheetId,
          fetchedTimesheetType,
          fetchedTimesheetExtStatus,
          setCurrentStatus,
          setListOfNextStatus
        );

        if (!changeAllowed) {
          setIsLocked(true);
        } else {
          setOrClearLock(
            "set",
            BUSOBJCATMAP[BUSOBJCAT.TIMESHEET],
            timesheetId,
            setIsLocked,
            setLoading
          );
        }
      }
    } catch (error) {
      console.error("Error in loading timesheet detail: ", error);
    }
  };

  const loadAbsences = async () => {
    try {
      const queryFields = {
        fields: [
          `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-id`,
          `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-employeeID`,
          `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-type:AbsenceType-name`,
          `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-start`,
          `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-end`,
          `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-hoursByDay`,
          `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-remark:text`,
        ],
        where: [
          {
            fieldName: `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-employeeID`,
            operator: "=",
            value: APP.LOGIN_USER_EMPLOYEE_ID,
          },
          {
            fieldName: `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-adjustAbsence`,
            operator: "=",
            value: false,
          },
          {
            fieldName: `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-redemption`,
            operator: "=",
            value: false,
          },
          {
            fieldName: `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-submittedOn`,
            operator: "!=",
            value: null,
          },
        ],
      };

      const commonQueryParams = {
        appName: APP_NAME.ABSENCE,
        client: parseInt(APP.LOGIN_USER_CLIENT),
        user: APP.LOGIN_USER_ID,
        userID: APP.LOGIN_USER_ID,
        language: APP.LOGIN_USER_LANGUAGE,
        intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      };

      const formData = {
        query: JSON.stringify(queryFields),
        ...commonQueryParams,
      };

      const response = await fetchData(
        API_ENDPOINTS.QUERY,
        "POST",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        new URLSearchParams(formData).toString()
      );

      if (response.success === true) {
        setTimesheetAbsences(response.data || []);
      }
    } catch (error) {
      console.error("Error in loading absences: ", error);
    }
  };

  const fetchProcessTemplate = async () => {
    if (!statusTemplateExtId) {
      setItemStatusIDMap({});
      return;
    }

    try {
      const queryFields = {
        fields: [
          "ProcessTemplate-id",
          "ProcessTemplate-extID",
          "ProcessTemplate-steps",
        ],
      };

      const whereConditions = [];
      const orConditions = [];

      whereConditions.push({
        fieldName: "ProcessTemplate-extID",
        operator: "=",
        value: statusTemplateExtId,
      });

      const response = await fetchBusObjCatData(
        "ProcessTemplate",
        null,
        null,
        queryFields,
        whereConditions,
        orConditions
      );

      let statusLabelAndStepMap = {};

      if (!response.error && response.data) {
        statusLabelAndStepMap = createExtIdStatusLabelMap(response.data);
      } else {
        console.error("Error fetching process template data:", response.error);
      }

      setItemStatusIDMap(statusLabelAndStepMap);
    } catch (error) {
      console.error("Error fetching process template data:", error);
    }
  };

  /**
   * Creates a map of extID and associated status labels.
   *
   * @param {Array} data - Process template data.
   * @returns {Object} - Map of extID and status labels.
   */
  const createExtIdStatusLabelMap = (data) => {
    const extIdStatusLabelMap = {};

    // Loop through each returned process template
    data.forEach((processTemplate) => {
      const steps = processTemplate["ProcessTemplate-steps"];

      // Check if steps is not null and is an array
      if (steps && Array.isArray(steps)) {
        // Loop through steps in each process template
        steps.forEach((step) => {
          const { extID, statusLabel } = step;
          // Add the extID and statusLabel to the map
          extIdStatusLabelMap[extID] = statusLabel;
        });
      }
    });

    return extIdStatusLabelMap;
  };

  const fetchTimeAndAbsence = async () => {
    setLoading(true);

    try {
      await Promise.all([
        isEditMode ? loadTimesheetDetail() : loadTimesheetCreateDetail(),
        loadAbsences(),
        fetchProcessTemplate(),
      ]);
    } catch (error) {
      console.error(
        "Error in loading timesheet details, absences or process template: ",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Memoized function to render the headerLeft with CustomBackButton and title text.
   * The function re-renders only when `hasUnsavedChanges`, `isEditMode`, or `t` changes.
   */
  const headerLeft = useCallback(() => {
    return (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton
          navigation={navigation}
          hasUnsavedChanges={hasUnsavedChanges()}
          t={t}
        />
        <Text
          style={styles.headerLeftText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {isEditMode ? t("timesheet_edit") : t("timesheet_create")}
        </Text>
      </View>
    );
  }, [hasUnsavedChanges, isEditMode, t]);

  /**
   * Memoized function to render the headerRight with multiple buttons.
   * The function re-renders only when `isEditMode`, `isLocked`, `loading`, `updatedValues`, or `timesheetTasks` change.
   */
  const headerRight = useCallback(() => {
    return (
      <View style={styles.headerRightContainer}>
        <CustomButton
          onPress={handleLock}
          label=""
          icon={{
            name: isLocked ? "lock" : "lock-open-variant",
            library: "MaterialCommunityIcons",
            size: 24,
          }}
          disabled={!isEditMode || loading}
        />
        <CustomButton
          onPress={handleReload}
          label=""
          icon={{
            name: "refresh-circle",
            library: "MaterialCommunityIcons",
            size: 24,
          }}
          disabled={!isEditMode || loading}
        />
        <CustomButton
          onPress={handleDelete}
          label=""
          icon={{
            name: "delete",
            library: "MaterialCommunityIcons",
            size: 24,
          }}
          disabled={!isEditMode || loading || isLocked}
        />
        <CustomButton
          onPress={handleSave}
          label=""
          icon={{
            name: "content-save",
            library: "MaterialCommunityIcons",
            size: 24,
          }}
          disabled={
            loading || isLocked || Object.keys(updatedValues).length === 0
          }
        />
      </View>
    );
  }, [isEditMode, isLocked, loading, updatedValues, timesheetTasks]);

  /**
   * Sets the header options for the screen, including the custom headerLeft and headerRight components.
   * This useEffect will run whenever dependencies in the header functions change.
   */
  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft: headerLeft,
      headerRight: headerRight,
    });
  }, [headerLeft, headerRight, navigation]);

  useEffect(() => {
    if (!workScheduleExtId) {
      showToast(t("no_workschedule_assigned"), "error");
      return;
    }

    fetchTimeAndAbsence();

    return () => {
      if (isEditMode) {
        setOrClearLock(
          "clear",
          BUSOBJCATMAP[BUSOBJCAT.TIMESHEET],
          timesheetId,
          setIsLocked,
          setLoading
        );
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <ScreenHeader left={headerLeft()} right={headerRight()} />
      {loading ? (
        <Loader />
      ) : (
        /* 
        The set functions in React, like setTimesheetType(fetchedTimesheetType), are asynchronous.
        This means that when you call setTimesheetType, the state update doesn't happen immediately.
        React schedules the update to happen at a later point in the rendering cycle.
        
        Because of this, there may be a brief moment where the component renders before the state update is applied.
        Therefore, it's necessary to check if timesheetType is defined before rendering the Tab.Navigator and its screens.
        This ensures that we don't attempt to render the components that rely on timesheetType being defined,
        preventing potential errors or unintended behavior during the initial render.

        Similarly, timesheetAbsences and itemStatusIDMap is initially set to null and will be updated asynchronously after fetching data.
      */
        timesheetType &&
        timesheetAbsences &&
        itemStatusIDMap && (
          <>
            <Tab.Navigator
              tabBar={(props) => <ThemedTopTabBar {...props} />}
              screenOptions={{
                swipeEnabled: false,
              }}
            >
              <Tab.Screen
                name={t("general")}
                options={{
                  tabBarLabel: ({ color }) => (
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{
                        color,
                        fontSize: 14,
                        textTransform: "uppercase",
                      }}
                    >
                      {t("general")}
                    </Text>
                  ),
                }}
              >
                {() => (
                  <GestureHandlerRootView>
                    <TimesheetDetailGeneral
                      navigation={navigation}
                      busObjCat={BUSOBJCAT.TIMESHEET}
                      busObjId={timesheetId}
                      isParentLocked={isLocked}
                      isEditMode={isEditMode}
                      currentStatus={currentStatus}
                      listOfNextStatus={listOfNextStatus}
                      handleReload={handleReload}
                      loading={loading}
                      setLoading={setLoading}
                      selectedDateInCreate={selectedDate}
                      onTimesheetDetailChange={handleTimesheetDetailChange}
                      OnFindingLeaveDates={handleFindingLeaveDates}
                      timesheetTypeDetails={timesheetTypeDetails}
                      employeeInfo={employeeInfo}
                      timesheetDetail={{
                        timesheetType,
                        timesheetExtStatus,
                        timesheetStart,
                        timesheetEnd,
                        timesheetTotalTime,
                        timesheetBillableTime,
                        timesheetOverTime,
                        timesheetRemark,
                        timesheetTasks,
                        timesheetAbsences,
                        itemStatusIDMap,
                      }}
                    />
                  </GestureHandlerRootView>
                )}
              </Tab.Screen>
              <Tab.Screen
                name={t("files")}
                options={{
                  tabBarLabel: ({ color }) => (
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{
                        color,
                        fontSize: 14,
                        textTransform: "uppercase",
                      }}
                    >
                      {t("files")}
                    </Text>
                  ),
                }}
              >
                {() => (
                  <File
                    busObjCat={BUSOBJCAT.TIMESHEET}
                    busObjId={timesheetId}
                    initialFilesIdList={timesheetFiles}
                    isParentLocked={isLocked}
                  />
                )}
              </Tab.Screen>
              <Tab.Screen
                name={t("comments")}
                options={{
                  tabBarLabel: ({ color }) => (
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{
                        color,
                        fontSize: 14,
                        textTransform: "uppercase",
                      }}
                    >
                      {t("comments")}
                    </Text>
                  ),
                }}
              >
                {() => (
                  <Comment
                    busObjCat={BUSOBJCAT.TIMESHEET}
                    busObjId={timesheetId}
                    initialComments={timesheetComments}
                    isParentLocked={isLocked}
                  />
                )}
              </Tab.Screen>
              <Tab.Screen
                name={t("history")}
                options={{
                  tabBarLabel: ({ color }) => (
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{
                        color,
                        fontSize: 14,
                        textTransform: "uppercase",
                      }}
                    >
                      {t("history")}
                    </Text>
                  ),
                }}
              >
                {() => (
                  <History
                    busObjCat={BUSOBJCAT.TIMESHEET}
                    busObjID={timesheetId}
                  />
                )}
              </Tab.Screen>
            </Tab.Navigator>
          </>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerLeftContainer: {
    maxWidth: screenDimension.width / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flexShrink: 1,
  },
  headerLeftText: {
    fontSize: screenDimension.width > 400 ? 18 : 16,
    fontWeight: "bold",
    color: "white",
  },
  headerRightContainer: {
    maxWidth: screenDimension.width / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    columnGap: 2,
    flexShrink: 0,
  },
});

export default TimesheetDetail;
