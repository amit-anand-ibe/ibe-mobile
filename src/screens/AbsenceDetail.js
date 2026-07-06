import React, { useCallback, useContext, useEffect, useState, useRef } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

import CustomButton from "../components/CustomButton";
import CustomBackButton from "../components/CustomBackButton";
import Loader from "../components/Loader";

import AbsenceDetailGeneral from "./AbsenceDetailGeneral";
import File from "./File";
import Comment from "./Comment";
import History from "./History";

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

import useEmployeeInfo from "../hooks/useEmployeeInfo";

import { useAbsenceForceRefresh } from "../../context/ForceRefreshContext";
import { useAbsenceSave } from "../../context/SaveContext";
import { ThemeContext } from "../theme/ThemeContext";

import {
  fetchData,
  getAppNameByCategory,
  isDoNotReplaceAnyList,
} from "../utils/APIUtils";
import {
  convertToDateFNSFormat,
  getRemarkText,
  isEqual,
  normalizeDateToUTC,
} from "../utils/FormatUtils";
import { setOrClearLock } from "../utils/LockUtils";
import { showToast } from "../utils/MessageUtils";
import { screenDimension } from "../utils/ScreenUtils";
import updateFields from "../utils/UpdateUtils";
import { documentStatusCheck } from "../utils/WorkflowUtils";

import {
  fetchListData,
  fetchProcessTemplate,
  getAbsenceFields,
  updateFieldInState,
  fetchEligibleAbsenceTypes,
  fetchAbsenceTypes,
  isLeaveAllowedInEmploymentPeriod,
  fetchEmployeeAbsences,
  isAbsencesOverlap,
  validateDuration,
  mergeAbsenceData,
  isTimeOffOnHoliday,
  validateAbsenceOnSaveWithAdjustment,
} from "../utils/AbsenceUtils";
import { format } from "date-fns";

const Tab = createMaterialTopTabNavigator();

/**
 * AbsenceDetail component handles the detailed view of an absence record.
 * It allows users to view, edit, create, and delete absence records.
 * The component uses multiple tabs to organize the absence details, files, comments, and history.
 *
 * @param {Object} props - The component props.
 * @param {Object} props.route - The route object containing navigation parameters.
 * @param {Object} props.navigation - The navigation object for navigating between screens.
 *
 * @returns {JSX.Element} The rendered component.
 */
const AbsenceDetail = ({ route, navigation }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { theme } = useContext(ThemeContext);

  const { updateForceRefresh } = useAbsenceForceRefresh();

  const { notifySave } = useAbsenceSave();

  const updatedValuesRef = useRef({});
  const employeeIDRef = useRef(null);

  const statusTemplateExtId = route?.params?.statusTemplateExtId;
  const openedFromApproval = route?.params?.openedFromApproval;

  const [absenceId, setAbsenceId] = useState(route?.params?.absenceId);
  // Determine if the component is in edit mode (if a absence id is provided)
  // True if editing an existing absence, false if creating a new one
  const [isEditMode, setIsEditMode] = useState(!!absenceId);
  const [itemStatusIDMap, setItemStatusIDMap] = useState(null);
  const [absenceTypeOptions, setAbsenceTypeOptions] = useState(null);
  const [dayFractionOptions, setDayFractionOptions] = useState(null);
  const [currentStatus, setCurrentStatus] = useState({});
  const [listOfNextStatus, setListOfNextStatus] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isKPIUpdating, setIsKPIUpdating] = useState(false);
  const [updatedValues, setUpdatedValues] = useState({});

  const [absenceFiles, setAbsenceFiles] = useState([]);
  const [absenceComments, setAbsenceComments] = useState([]);
  const [absenceType, setAbsenceType] = useState("");
  const [absenceEmployeeId, setAbsenceEmployeeId] = useState("");
  const [absenceEmployeeName, setAbsenceEmployeeName] = useState("");
  const [absenceStart, setAbsenceStart] = useState(null);
  const [absenceEnd, setAbsenceEnd] = useState(null);
  const [absenceStartDayFraction, setAbsenceStartDayFraction] = useState(null);
  const [absenceEndDayFraction, setAbsenceEndDayFraction] = useState(null);
  const [absencePlannedDays, setAbsencePlannedDays] = useState(null);
  const [absenceSubmittedOn, setAbsenceSubmittedOn] = useState(null);
  const [absenceAdjustAbsence, setAbsenceAdjustAbsence] = useState(false);
  const [absenceIsNegativeBalance, setAbsenceIsNegativeBalance] =
    useState(false);
  const [absenceAdjustTaken, setAbsenceAdjustTaken] = useState(false);
  const [absenceHoursByDay, setAbsenceHoursByDay] = useState([]);
  const [absenceExtStatus, setAbsenceExtStatus] = useState({});
  const [absenceRemark, setAbsenceRemark] = useState("");
  const [absenceTypeDetails, setAbsenceTypeDetails] = useState({});
  const [allAbsenceTypes, setAllAbsenceTypes] = useState({});
  const [behaviorFields, setBehaviorFields] = useState({
    absenceTypeFixedCalendar: absenceTypeDetails.absenceTypeFixedCalendar || "",
    absenceTypeDisplayInHours:
      absenceTypeDetails.absenceTypeDisplayInHours || false,
    absenceTypeHourlyLeave: absenceTypeDetails.absenceTypeHourlyLeave || false,
    absenceTypeAllowedInProbation:
      absenceTypeDetails.absenceTypeAllowedInProbation || false,
    absenceTypeAllowedInTermination:
      absenceTypeDetails.absenceTypeAllowedInTermination || false,
    selectedHoliday: null,
    absenceTypeAdminAdjustOnly:
      absenceTypeDetails.absenceTypeAdminAdjustOnly || false,
    absenceTypeHalfDaysNotAllowed:
      absenceTypeDetails.absenceTypeHalfDaysNotAllowed || false,
    absenceTypeMinRequest: absenceTypeDetails.absenceTypeMinRequest || null,
    absenceTypeMaxRequest: absenceTypeDetails.absenceTypeMaxRequest || null,
    absenceTypeGender: absenceTypeDetails.absenceTypeGender || "",
  });
  const [isAddToBalance, setIsAddToBalance] = useState(true);
  const [processTemplate, setProcessTemplate] = useState(null);
  const [employeeAbsences, setEmployeeAbsences] = useState([]);

  const [kpiValues, setKPIValues] = useState({
    balanceBefore: "-",
    balanceAfter: "-",
    projectedBalance: "-",
    projectedCarryForward: "-",
  });

  // Use custom hook to get the employeeInfo based on openedFromApproval flag
  const employeeInfo = useEmployeeInfo(openedFromApproval);

  /**
   * Handles locking or unlocking the absence record.
   * Only proceeds if the component is in edit mode.
   */
  const handleLock = async () => {
    /**
     * Proceed only if the edit mode is enabled.
     */
    if (isEditMode) {
      /**
       * Check if changes are allowed based on the document's current status.
       * Calls the `documentStatusCheck` function to validate whether the action can proceed.
       */
      const { changeAllowed } = await documentStatusCheck(
        t,
        APP_ACTIVITY_ID.ABSENCE,
        BUSOBJCATMAP[BUSOBJCAT.ABSENCE],
        absenceId,
        absenceType,
        absenceExtStatus,
        setCurrentStatus,
        setListOfNextStatus
      );

      /**
       * If changes are not allowed (changeAllowed is false), exit the function.
       */
      if (!changeAllowed) {
        return;
      }

      /**
       * Determine whether to lock or unlock based on the current 'isLocked' state.
       * If 'isLocked' is true, action will be 'set' (lock). Otherwise, it will be 'clear' (unlock).
       */
      const action = isLocked ? "set" : "clear";

      /**
       * Perform the lock or unlock operation based on the action determined.
       * The `setOrClearLock` function handles both locking and unlocking, updating UI states (lock status, loading state).
       */
      setOrClearLock(
        action,
        BUSOBJCATMAP[BUSOBJCAT.ABSENCE],
        absenceId,
        setIsLocked,
        setLoading
      );
    }
  };

  /**
   * Handles reloading the absence data.
   * Fetches the latest absence data if there are no unsaved changes.
   * Shows an alert to confirm discarding unsaved changes before fetching data.
   * @param {string|null} idToReload - The specific ID to reload, bypassing the state.
   */
  const handleReload = (idToReload = null) => {
    const reloadData = () => {
      fetchAbsenceAndAuxiliaryData(true, idToReload);
    };

    hasUnsavedChanges() ? showUnsavedChangesAlert(reloadData) : reloadData();
  };

  /**
   * Handles deleting the absence record.
   * Shows a confirmation alert before deleting the record.
   */
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
                      BUSOBJCATMAP[BUSOBJCAT.ABSENCE]
                    }-component`]: `Client-${APP.LOGIN_USER_CLIENT}-all`,
                    [`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-extID`]: "",
                    [`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-id`]: absenceId,
                    [`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-intStatus`]: 3,
                  },
                };

                const queryStringParams = {
                  language: APP.LOGIN_USER_LANGUAGE,
                  userID: APP.LOGIN_USER_ID,
                  appName: APP_NAME.ABSENCE,
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

                  // Go back to the previous screen (absence list)
                  navigation.goBack();
                } else {
                  showToast(t("delete_failure"), "error");
                }

                if (updateResponse.message) {
                  showToast(updateResponse.message);
                }
              } catch (error) {
                console.error("Error in handleDelete of AbsenceDetail", error);
                showToast(t("unexpected_error"), "error");
              }
            },
          },
        ],
        { cancelable: true } // Allow the dialog to be canceled by tapping outside of it
      );
    }
  };

  /**
   * Checks if there are unsaved changes by verifying if the `updatedValuesRef` object has any keys.
   * Uses the `useCallback` hook to ensure the function is only recreated when necessary, optimizing performance.
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

  /**
   * Shows an alert to confirm discarding unsaved changes.
   *
   * @param {Function} onDiscard - The function to call if the user confirms discarding changes.
   */
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

  /**
   * Updates the absence record with the provided updated values.
   * This function sends a request to update the absence fields with the new values.
   * It handles the response, updates the state, and shows appropriate messages based on the result.
   *
   * @param {Object} updatedValues - The updated values for the absence fields.
   * @param {boolean} isNegativeBalance - Indicates if the absence has a negative balance.
   */
  const updateAbsence = async (
    updatedValues = {},
    isNegativeBalance = false
  ) => {
    try {
      // Prefix the updated values with the absence category prefix
      const prefixedUpdatedValues = {};
      for (const key in updatedValues) {
        prefixedUpdatedValues[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-${key}`] =
          updatedValues[key];
      }

      // Include the negative balance flag if applicable
      if (isNegativeBalance) {
        prefixedUpdatedValues["Absence-negative"] = isNegativeBalance;
      }

      // Prepare the form data with the prefixed updated values
      const formData = {
        data: {
          [`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-id`]: absenceId,
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
        doNotReplaceAnyList: isDoNotReplaceAnyList(BUSOBJCAT.ABSENCE),
        appName: JSON.stringify(getAppNameByCategory(BUSOBJCAT.ABSENCE)),
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

      // Extract the new ID from the response and update the absenceId state
      const newId = updateResponse.response?.details[0]?.data?.ids?.[0];
      if (newId) {
        setAbsenceId(newId);
        setIsEditMode(true);
      }

      // Clear the updated values reference and state
      updatedValuesRef.current = {};
      setUpdatedValues({});

      // Force refresh the absence data on the list screen
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

      // Reload the absence data after saving, passing the new ID to ensure fresh data is fetched.
      handleReload(newId || absenceId);
    } catch (error) {
      // Handle any errors that occur during the update process
      console.error("Error in updateAbsence of AbsenceDetail", error);
      showToast(t("unexpected_error"), "error");
    }
  };

  /**
   * Handles saving the absence details.
   * Validates the absence details and updates the absence record if valid.
   */
  const handleSave = async () => {
    try {
      const { isValid, isNegativeBalance = false } = validateAbsenceOnSave();

      if (isValid) {
        await updateAbsence(updatedValues, isNegativeBalance);
      }
    } catch (error) {
      console.error("Error in saving absence", error);
    }
  };

  /**
   * Handles changes in the absence details.
   * Updates the state and reference object with the new values.
   *
   * @param {Object} values - The updated values for the absence details.
   */
  const handleAbsenceDetailChange = (values) => {
    console.log(
      `Received updated values in Absence Detail: ${JSON.stringify(values)}`
    );

    const updatedChanges = { ...updatedValuesRef.current };
    let newValues = { ...values }; // Avoid mutating original values

    // Normalize start and end dates before updating
    if (newValues.absenceStartDate) {
      newValues.absenceStartDate = normalizeDateToUTC(
        newValues.absenceStartDate
      );
    }
    if (newValues.absenceEndDate) {
      newValues.absenceEndDate = normalizeDateToUTC(newValues.absenceEndDate);
    }

    // Parse absence duration if it exists
    if (newValues.absenceDuration) {
      newValues.absenceDuration = parseFloat(newValues.absenceDuration);
    }

    // Handle Add to Balance update if it exists
    if (newValues.isAddToBalance !== undefined) {
      setIsAddToBalance(newValues.isAddToBalance);

      // Ensure correct deduction logic
      if (absenceAdjustAbsence && !newValues.isAddToBalance) {
        newValues.absenceDuration = parseFloat(newValues.absenceDuration * -1);
      }
    }

    // Directly update state fields as before
    updateFieldInState(
      newValues,
      "absenceType",
      absenceType,
      setAbsenceType,
      updatedChanges,
      "type"
    );
    updateFieldInState(
      newValues,
      "absenceStartDate",
      absenceStart,
      setAbsenceStart,
      updatedChanges,
      "start"
    );
    updateFieldInState(
      newValues,
      "absenceEndDate",
      absenceEnd,
      setAbsenceEnd,
      updatedChanges,
      "end"
    );
    updateFieldInState(
      newValues,
      "absenceStartDayFraction",
      absenceStartDayFraction,
      setAbsenceStartDayFraction,
      updatedChanges,
      "startHalfDay"
    );
    updateFieldInState(
      newValues,
      "absenceEndDayFraction",
      absenceEndDayFraction,
      setAbsenceEndDayFraction,
      updatedChanges,
      "endHalfDay"
    );
    updateFieldInState(
      newValues,
      "absenceDuration",
      absencePlannedDays,
      setAbsencePlannedDays,
      updatedChanges,
      "plannedDays"
    );
    updateFieldInState(
      newValues,
      "absenceFiles",
      absenceFiles,
      setAbsenceFiles,
      updatedChanges,
      "files"
    );
    updateFieldInState(
      newValues,
      "absenceComments",
      absenceComments,
      setAbsenceComments,
      updatedChanges,
      "comments"
    );

    // Special handling for remark
    if (
      newValues.absenceRemark !== undefined &&
      !isEqual(newValues.absenceRemark, absenceRemark)
    ) {
      setAbsenceRemark(newValues.absenceRemark);
      updatedChanges["remark:text"] = getRemarkText(
        newValues.absenceRemark,
        lang,
        PREFERRED_LANGUAGES
      );
    }

    // Prepare and update behavior fields
    let newBehaviorFields = { ...behaviorFields };
    const behaviorFieldsKeys = [
      "selectedHoliday",
      "absenceTypeFixedCalendar",
      "absenceTypeAllowedInProbation",
      "absenceTypeAllowedInTermination",
      "absenceTypeDisplayInHours",
      "absenceTypeHourlyLeave",
      "absenceTypeAdminAdjustOnly",
      "absenceTypeHalfDaysNotAllowed",
      "absenceTypeMinRequest",
      "absenceTypeMaxRequest",
      "absenceTypeNegativeDays",
      "absenceTypeAdjustAfterDays",
      "absenceTypeGender"
    ];

    behaviorFieldsKeys.forEach((field) => {
      if (
        newValues[field] !== undefined &&
        !isEqual(newValues[field], newBehaviorFields[field])
      ) {
        newBehaviorFields[field] = newValues[field];
      }
    });

    console.log(
      `Updated behavior fields after processing: ${JSON.stringify(
        newBehaviorFields
      )}`
    );
    setBehaviorFields(newBehaviorFields);

    // Update reference object and state for non-behavior fields
    updatedValuesRef.current = updatedChanges;
    setUpdatedValues(updatedChanges);

    console.log(
      `Updated changes after processing (for saving): ${JSON.stringify(
        updatedChanges
      )}`
    );
  };

  /**
   * Validates the absence details before saving.
   * Checks if the required fields are provided.
   *
   * @returns {Object} - Returns an object containing a boolean `isValid` and a boolean `isNegativeBalance` if applicable.
   */
  const validateAbsenceOnSave = () => {
    const {
      absenceTypeFixedCalendar,
      absenceTypeDisplayInHours,
      absenceTypeHourlyLeave,
      absenceTypeAllowedInProbation,
      absenceTypeAllowedInTermination,
      absenceTypeAdminAdjustOnly,
      absenceTypeHalfDaysNotAllowed,
      absenceTypeMinRequest,
      absenceTypeMaxRequest,
      absenceTypeGender,
      selectedHoliday,
    } = behaviorFields;

    // Check if the absence type is provided
    if (!absenceType) {
      showToast(t("type_required_message"), "error");
      return { isValid: false };
    }

    if (
      absenceTypeGender &&
      employeeInfo.gender &&
      absenceTypeGender.toLowerCase() !== employeeInfo.gender.toLowerCase()
    ) {
      showToast(
        t("gender_mismatch_error", { gender: absenceTypeGender }),
        "error"
      );
      return { isValid: false };
    }

    // Check if the absence start date is provided
    if (!absenceStart) {
      showToast(t("start_required_message"), "error");
      return { isValid: false };
    }

    // Check if the absence end date is provided
    if (!absenceEnd) {
      showToast(t("end_required_message"), "error");
      return { isValid: false };
    }

    // Check if the start date is greater than the end date
    if (
      absenceStart &&
      absenceEnd &&
      new Date(absenceStart) > new Date(absenceEnd)
    ) {
      showToast(t("start_date_must_be_less_than_equal_to_end_date"), "error");
      return { isValid: false };
    }

    // Validate if the absence is allowed during probation or notice period
    if (
      !isLeaveAllowedInEmploymentPeriod(
        employeeInfo,
        absenceTypeAllowedInProbation,
        absenceTypeAllowedInTermination,
        absenceStart,
        absenceEnd,
        t
      )
    ) {
      return { isValid: false };
    }

    const absenceTypeData = allAbsenceTypes[absenceType] || {};

    // Validate adjustment fields
    if (absenceAdjustAbsence) {
      const negativeDays = absenceTypeData["AbsenceType-negativeDays"] || 0;
      const projectedNextYear =
        absenceTypeData["AbsenceType-projectedNextYear"] || 0;
      const absenceTypeName = absenceTypeData["AbsenceType-name"] || "";

      if (
        !validateAbsenceOnSaveWithAdjustment(
          absencePlannedDays,
          negativeDays,
          projectedNextYear,
          absenceTypeName,
          t
        )
      ) {
        return { isValid: false };
      }
    }

    // Validate fixed calendar fields
    if (absenceTypeFixedCalendar) {
      if (absenceTypeDisplayInHours || absenceTypeHourlyLeave) {
        showToast(t("type_holiday_and_hourly_not_allowed"), "error");
        return { isValid: false };
      }

      if (!selectedHoliday) {
        showToast(t("holiday_required_message"), "error");
        return { isValid: false };
      }

      // All validations for fixed calendar absences have passed. Return true to bypass further checks.
      return { isValid :  true };
    }

    // Check if the time-off request falls on holidays or non-working days
    if (
      !isTimeOffOnHoliday(absenceStart, absenceEnd, t, employeeInfo, "error")
    ) {
      return { isValid: false };
    }

    // Find the minimum fraction value from dayFractionOptions
    const minFraction =
      Array.isArray(dayFractionOptions) && dayFractionOptions.length > 0
        ? dayFractionOptions.reduce((min, option) => {
            const fractionValue = parseFloat(option.value);
            return fractionValue < min ? fractionValue : min;
          }, 1)
        : 1;

    // Validate the duration
    if (
      !validateDuration(
        absencePlannedDays,
        absenceTypeMinRequest,
        absenceTypeMaxRequest,
        absenceTypeHalfDaysNotAllowed,
        absenceTypeHourlyLeave,
        absenceTypeDisplayInHours,
        employeeInfo.dailyStdHours,
        t,
        minFraction,
        true
      )
    ) {
      return { isValid: false };
    }

    // Negative balance validation
    let absenceIsNegativeBalance = false;
    const absenceTypeName = absenceTypeData["AbsenceType-name"] || "";
    const maxNegativeDays = absenceTypeData["AbsenceType-negativeDays"] || 0;
    const isNegativeDaysAllowed = maxNegativeDays > 0;

    // Convert balanceAfter to a number, defaulting to 0 if it's not a valid number
    const balance = isNaN(Number(kpiValues?.balanceAfter))
      ? 0
      : Number(kpiValues?.balanceAfter);

    const durationType =
      absenceTypeDisplayInHours || absenceTypeHourlyLeave
        ? " hour(s)"
        : " days";

    if (!isNegativeDaysAllowed && balance < 0) {
      console.log("Validation failed: Negative balance not allowed.");
      showToast(
        t("negative_balance_not_allowed", { absenceTypeName }),
        "error"
      );
      return { isValid: false };
    }

    if (isNegativeDaysAllowed && balance < 0) {
      if (Math.abs(balance) > maxNegativeDays) {
        showToast(
          t("max_negative_balance_exceeded", {
            absenceTypeName,
            maxNegativeDays,
            durationType,
          }),
          "error"
        );
        return { isValid: false };
      }

      absenceIsNegativeBalance = true;
      setAbsenceIsNegativeBalance(true);
    }

    // Check for overlapping absences
    for (const record of employeeAbsences) {
      const {
        "Absence-employeeID": recordEmployeeID,
        "Absence-start": recordStart,
        "Absence-end": recordEnd,
        "Absence-id": recordId,
      } = record;

      // Skip if current record is empty, or if it's the same record
      if (
        !recordStart ||
        !recordEnd ||
        absenceId === recordId ||
        recordEmployeeID !== absenceEmployeeId
      ) {
        continue;
      }

      // If absences overlap, show overlap message
      if (
        isAbsencesOverlap(absenceStart, absenceEnd, recordStart, recordEnd, t)
      ) {
        showToast(
          t("absence_exists_for_period", {
            start: format(
              recordStart,
              convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
            ),
            end: format(
              recordEnd,
              convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
            ),
          }),
          "error"
        );
        return { isValid: false };
      }
    }

    if (absenceTypeHourlyLeave) {
      if (absencePlannedDays < 1) {
        showToast(t("accrue_by_hours_worked_min_duration"), "error");
        return { isValid: false };
      }
    }

    return { isValid: true, isNegativeBalance: absenceIsNegativeBalance };
  };

  /**
   * Loads the initial details for creating a new absence record.
   */
  const loadAbsenceCreateDetail = async () => {
    try {
      const updatedChanges = { ...updatedValues };

      const normalizedDate = normalizeDateToUTC(new Date());

      let employeeId = APP.LOGIN_USER_EMPLOYEE_ID;
      employeeIDRef.current = employeeId;

      setAbsenceEmployeeId(employeeId);
      setAbsenceStart(new Date());
      setAbsenceEnd(new Date());
      setAbsenceStartDayFraction("1");
      setAbsenceEndDayFraction(null);
      setAbsencePlannedDays(1);

      updatedChanges["employeeID"] = employeeId;
      updatedChanges["adjustAbsence"] = false;
      updatedChanges["adjustTaken"] = false;
      updatedChanges["start"] = normalizedDate;
      updatedChanges["end"] = normalizedDate;
      updatedChanges["startHalfDay"] = "1";
      updatedChanges["endHalfDay"] = "0";
      updatedChanges["plannedDays"] = 1;
      updatedChanges["negative"] = absenceIsNegativeBalance;

      // Update the ref
      updatedValuesRef.current = updatedChanges;
      // Update the changes state
      setUpdatedValues(updatedChanges);

      // The status check is not required in create mode, as there's no need to verify
      // if the document can be modified. However, since this operation also sets the
      // current status and next possible statuses, enabling the customStatus component
      // to display the workflow status, we are calling it here.
      await documentStatusCheck(
        t,
        APP_ACTIVITY_ID.ABSENCE,
        BUSOBJCATMAP[BUSOBJCAT.ABSENCE],
        absenceId,
        absenceType,
        null, // Absence extStatus
        setCurrentStatus,
        setListOfNextStatus
      );
    } catch (error) {
      console.error("Error in loading absence create detail: ", error);
    }
  };

  /**
   * Loads the details for an existing absence record.
   * @param {string|null} idToLoad - The specific ID to load, bypassing the state.
   */
  const loadAbsenceDetail = async (idToLoad = null) => {
    const idToFetch = idToLoad || absenceId;
    if (!idToFetch) {
      return;
    }

    try {
      const queryFields = {
        fields: getAbsenceFields(),
        where: [
          {
            fieldName: `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-id`,
            operator: "=",
            value: idToFetch,
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

        let employeeId = data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-employeeID`];
        employeeIDRef.current = employeeId;

        setAbsenceFiles(data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-files`]);
        setAbsenceComments(data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-comments`]);
        setAbsenceEmployeeId(employeeId);
        setAbsenceEmployeeName(
          data[
            `${
              BUSOBJCATMAP[BUSOBJCAT.ABSENCE]
            }-employeeID:Resource-core-name-knownAs`
          ]
        );
        setAbsenceStart(data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-start`]);
        setAbsenceEnd(data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-end`]);
        setAbsenceStartDayFraction(
          data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-startHalfDay`]
        );
        setAbsenceEndDayFraction(
          data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-endHalfDay`]
        );
        setAbsencePlannedDays(
          data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-plannedDays`]
        );
        setAbsenceSubmittedOn(
          data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-submittedOn`]
        );
        setAbsenceAdjustAbsence(
          data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-adjustAbsence`]
        );
        setAbsenceAdjustTaken(
          data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-adjustTaken`]
        );
        setAbsenceHoursByDay(
          data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-hoursByDay`]
        );
        setAbsenceRemark(data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-remark`]);

        const fetchedAbsenceExtStatus =
          data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-extStatus`] || {};
        setAbsenceExtStatus(fetchedAbsenceExtStatus);

        const fetchedAbsenceType =
          data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-type`] || "";
        setAbsenceType(fetchedAbsenceType);

        setAbsenceTypeDetails({
          absenceTypeExtId:
            data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-type:AbsenceType-extID`] ||
            "",
          absenceTypeName:
            data[`${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-type:AbsenceType-name`] ||
            "",
          absenceTypePolicyText:
            data[
              `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-type:AbsenceType-policyText`
            ] || "",
          absenceTypeHourlyLeave:
            data[
              `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-type:AbsenceType-hourlyLeave`
            ] || false,
          absenceTypeDisplayInHours:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.ABSENCE]
              }-type:AbsenceType-displayInHours`
            ] || false,
          absenceTypeFixedCalendar:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.ABSENCE]
              }-type:AbsenceType-fixedCalendar`
            ] || "",
          absenceTypeAllowedInProbation:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.ABSENCE]
              }-type:AbsenceType-allowedInProbation`
            ] || false,
          absenceTypeAllowedInTermination:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.ABSENCE]
              }-type:AbsenceType-allowedInTermination`
            ] || false,
          absenceTypeAdminAdjustOnly:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.ABSENCE]
              }-type:AbsenceType-adminAdjustOnly`
            ] || false,
          absenceTypeHalfDaysNotAllowed:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.ABSENCE]
              }-type:AbsenceType-halfDaysNotAllowed`
            ] || false,
          absenceTypeMinRequest:
            data[
              `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-type:AbsenceType-minRequest`
            ] || null,
          absenceTypeMaxRequest:
            data[
              `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-type:AbsenceType-maxRequest`
            ] || null,
          absenceTypeNegativeDays:
            data[
              `${BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}-type:AbsenceType-negativeDays`
            ] || 0,
          absenceTypeGender:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.ABSENCE]
              }-type:AbsenceType-gender`
            ] || "",
          absenceTypeAdjustAfterDays:
            data[
              `${
                BUSOBJCATMAP[BUSOBJCAT.ABSENCE]
              }-type:AbsenceType-adjustAfterDays`
            ] || 0,
        });

        const { changeAllowed } = await documentStatusCheck(
          t,
          APP_ACTIVITY_ID.ABSENCE,
          BUSOBJCATMAP[BUSOBJCAT.ABSENCE],
          idToFetch,
          fetchedAbsenceType,
          fetchedAbsenceExtStatus,
          setCurrentStatus,
          setListOfNextStatus
        );

        if (!changeAllowed) {
          setIsLocked(true);
        } else {
          setOrClearLock(
            "set",
            BUSOBJCATMAP[BUSOBJCAT.ABSENCE],
            idToFetch,
            setIsLocked,
            setLoading
          );
        }
      }
    } catch (error) {
      console.error("Error in loading absence detail: ", error);
    }
  };

  /**
   * Fetches the absence data and related auxiliary data (e.g., process templates, absence types, day fractions).
   * This function handles both the "create" and "edit" modes and loads the corresponding absence details first
   * before fetching auxiliary data concurrently.
   *
   * * The `forceLoadAbsenceDetail` parameter is added to ensure that `loadAbsenceDetail` is always called,
   * since when this function is called from `handleReload`, it will always be in "edit" mode.
   *
   * @param {boolean} forceLoadAbsenceDetail - Ensures `loadAbsenceDetail` is always called when true,
   * @param {string|null} idToLoad - The specific ID to load, bypassing the state.
   * especially when the function is triggered from `handleReload` in "edit" mode
   */
  const fetchAbsenceAndAuxiliaryData = async (
    forceLoadAbsenceDetail = false,
    idToLoad = null
  ) => {
    setLoading(true);

    try {
      if (isEditMode || forceLoadAbsenceDetail) {
        // If in edit mode or forceLoadAbsenceDetail is true, always load absence detail
        await loadAbsenceDetail(idToLoad);
        if (!employeeIDRef.current) {
          throw new Error("Employee ID not found after loading absence detail");
        }
      } else {
        await loadAbsenceCreateDetail();
        if (!employeeIDRef.current) {
          throw new Error(
            "Employee ID not found after loading absence create detail"
          );
        }
      }

      // Fetch all auxiliary data concurrently
      const [
        processTemplate,
        absenceTypesMap,
        eligibleAbsenceTypes,
        dayFractionsMap,
        employeeAbsencesForThisYear,
      ] = await Promise.all([
        fetchProcessTemplate(statusTemplateExtId),
        fetchAbsenceTypes(),
        fetchEligibleAbsenceTypes(employeeIDRef.current, false, t),
        fetchListData("DayFraction"),
        fetchEmployeeAbsences(employeeIDRef.current),
      ]);

      const mergedAbsenceTypes = mergeAbsenceData(
        absenceTypesMap,
        eligibleAbsenceTypes
      );

      // Filter to include only eligible absence types
      const filteredAbsenceTypes = mergedAbsenceTypes.filter(
        ([key]) => eligibleAbsenceTypes[key]
      );

      // Update the state with the fetched data
      setItemStatusIDMap(processTemplate || {});
      setAllAbsenceTypes(Object.fromEntries(filteredAbsenceTypes));
      setAbsenceTypeOptions(
        filteredAbsenceTypes.map(([key, value]) => {
          const projected = value["AbsenceType-projectedNextYear"];
          const negativeIndicator =
            value["AbsenceType-negativeDays"] > 0 ? " (-ve)" : "";

          return {
            label:
              `${value["AbsenceType-name"]}` +
              `${` (${projected})`}` +
              `${negativeIndicator}`,
            value: key,
          };
        })
      );
      setDayFractionOptions(
        Object.entries(dayFractionsMap).map(([key, value]) => ({
          label: value,
          value: key,
        }))
      );
      setProcessTemplate(processTemplate);
      setEmployeeAbsences(employeeAbsencesForThisYear);
    } catch (error) {
      console.error(
        "Error fetching absence data or related auxiliary data: ",
        error
      );
      showToast(t("error_fetching_absence_data"), "error");
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
          {isEditMode ? t("absence_edit") : t("absence_create")}
        </Text>
      </View>
    );
  }, [hasUnsavedChanges, isEditMode, t]);

  /**
   * Memoized function to render the headerRight with multiple buttons.
   * The function re-renders only when `isEditMode`, `isLocked`, `loading` or `updatedValues` change.
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
            loading ||
            isKPIUpdating ||
            isLocked ||
            Object.keys(updatedValues)?.length === 0
          }
        />
      </View>
    );
  }, [isEditMode, isLocked, loading, isKPIUpdating, updatedValues]);

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

  /**
   * This effect is responsible for fetching absence details when the component is mounted.
   * It also ensures that any lock is cleared if the user is in edit mode when the component unmounts or re-renders.
   */
  useEffect(() => {
    fetchAbsenceAndAuxiliaryData();

    return () => {
      /**
       * Cleanup function to clear the lock when leaving the edit mode.
       * This will be executed when the component is unmounted or when dependencies change.
       * Clears the lock if `isEditMode` is true to ensure no lingering lock remains after the user exits edit mode.
       */
      if (isEditMode) {
        setOrClearLock(
          "clear",
          BUSOBJCATMAP[BUSOBJCAT.ABSENCE],
          absenceId,
          setIsLocked,
          setLoading
        );
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {loading ? (
        <Loader />
      ) : (
        /* 
        The set functions in React, like setAbsenceType(fetchedAbsenceType), are asynchronous.
        This means that when you call setAbsenceType, the state update doesn't happen immediately.
        React schedules the update to happen at a later point in the rendering cycle.
    
        As a result, there may be a brief moment where the component renders before the absenceType state update is applied.
        To prevent errors or unintended behavior during this initial render, we need to check if absenceType is defined 
        before rendering components that depend on it, such as the absence-related screens or logic.
  
        Similarly, itemStatusIDMap and other state variables are initially set to null and will be updated asynchronously 
        after fetching data, so they must be checked before being used in rendering.
        */
        (isEditMode ? absenceType : true) &&
        itemStatusIDMap && (
          <>
            <Tab.Navigator
              screenOptions={{
                swipeEnabled: false,
                tabBarActiveTintColor: theme.secondary,
                tabBarInactiveTintColor: theme.contrastOnPrimary,
                tabBarIndicatorStyle: { backgroundColor: theme.secondary },
                tabBarStyle: { backgroundColor: theme.primary },
              }}
            >
              <Tab.Screen
                name={t("general")}
                options={{
                  tabBarLabel: ({ focused, color }) => (
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
                    <AbsenceDetailGeneral
                      navigation={navigation}
                      busObjCat={BUSOBJCAT.ABSENCE}
                      busObjId={absenceId}
                      isParentLocked={isLocked}
                      isEditMode={isEditMode}
                      currentStatus={currentStatus}
                      listOfNextStatus={listOfNextStatus}
                      processTemplate={processTemplate}
                      handleReload={handleReload}
                      loading={loading}
                      isKPIUpdating={isKPIUpdating}
                      setLoading={setLoading}
                      setIsKPIUpdating={setIsKPIUpdating}
                      onAbsenceDetailChange={handleAbsenceDetailChange}
                      allAbsenceTypes={allAbsenceTypes}
                      absenceTypeDetails={absenceTypeDetails}
                      employeeInfo={employeeInfo}
                      pickerOptions={{ absenceTypeOptions, dayFractionOptions }}
                      absenceDetails={{
                        absenceType,
                        absenceEmployeeId,
                        absenceEmployeeName,
                        absenceStart,
                        absenceEnd,
                        absenceStartDayFraction,
                        absenceEndDayFraction,
                        absencePlannedDays,
                        absenceSubmittedOn,
                        absenceAdjustAbsence,
                        absenceAdjustTaken,
                        absenceHoursByDay,
                        absenceExtStatus,
                        absenceRemark,
                        itemStatusIDMap,
                      }}
                      kpiValues={kpiValues}
                      setKPIValues={setKPIValues}
                      openedFromApproval={openedFromApproval}
                    />
                  </GestureHandlerRootView>
                )}
              </Tab.Screen>
              <Tab.Screen
                name={t("files")}
                options={{
                  tabBarLabel: ({ focused, color }) => (
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
                    busObjCat={BUSOBJCAT.ABSENCE}
                    busObjId={absenceId}
                    initialFilesIdList={absenceFiles}
                    isParentLocked={isLocked}
                  />
                )}
              </Tab.Screen>
              <Tab.Screen
                name={t("comments")}
                options={{
                  tabBarLabel: ({ focused, color }) => (
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
                    busObjCat={BUSOBJCAT.ABSENCE}
                    busObjId={absenceId}
                    initialComments={absenceComments}
                    isParentLocked={isLocked}
                  />
                )}
              </Tab.Screen>
              <Tab.Screen
                name={t("history")}
                options={{
                  tabBarLabel: ({ focused, color }) => (
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
                  <History busObjCat={BUSOBJCAT.ABSENCE} busObjID={absenceId} />
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
    columnGap: 8,
  },
});

export default AbsenceDetail;
