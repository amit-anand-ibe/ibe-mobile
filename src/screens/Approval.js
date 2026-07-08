// React and React Native Core Imports
import React, { useCallback, useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Third-Party Libraries
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

// Constants
import { APP, BUSOBJCAT, INTSTATUS } from "../constants";
import { API_ENDPOINTS } from "../constants";

// Utility Functions
import { fetchData } from "../utils/APIUtils";
import { screenDimension } from "../utils/ScreenUtils";
import { convertToDateFNSFormat } from "../utils/FormatUtils";
import {
  applyLocalFilters,
  componentMap,
  detailScreenParamsMap,
  fetchBusObjCatData,
  fetchMessageTypeData,
  getPublishedAge,
  getStartDateForFilter,
  handleStatusChangeMgmt,
  hasContent,
  messageWithinMap,
  processUpdateFields,
  fetchEmployeeDetails,
} from "../utils/ApprovalUtils";
import { convertToFilterScreenFormat, filtersMap } from "../utils/FilterUtils";
import { showToast } from "../utils/MessageUtils";

// Custom Components
import Loader from "../components/Loader";
import CustomBackButton from "../components/CustomBackButton";
import EditDialog from "../components/dialogs/EditDialog";
import CustomButton from "../components/CustomButton";
import ScreenHeader from "../components/ScreenHeader";

import { ApprovalUserInfoContext } from "../../context/ApprovalUserInfoContext";

/**
 * Approval screen component.
 *
 * This component renders a list of messages that require approval. It provides:
 * - Filtering options to display messages based on their status or time frame.
 * - Functionality to change the status of messages, including adding comments.
 * - Navigation to other screens for additional details or actions.
 *
 * Props:
 * @param {object} route - React Navigation's route object, used to access passed parameters.
 * @param {object} navigation - React Navigation's navigation object, used for screen navigation.
 *
 */

const Approval = ({ route, navigation }) => {
  const { t } = useTranslation();

  const { approvalUserInfo = {}, setApprovalUserInfo } = useContext(
    ApprovalUserInfoContext
  );

  // Component State
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(false);
  const [messageTypeMap, setMessageTypeMap] = useState({});
  const [busObjCatMap, setBusObjCatMap] = useState({});
  const [clickedStatusButton, setClickedStatusButton] = useState({});
  const [isCommentDialogVisible, setIsCommentDialogVisible] = useState(false);
  const [changeRecipient, setChangeRecipient] = useState(false);
  const [commentRequired, setCommentRequired] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [appliedFiltersCount, setAppliedFiltersCount] = useState(0);

  /**
   * Toggles the refresh key, triggering a component re-render.
   */
  const updateRefresh = () => setRefreshKey((prevKey) => !prevKey);

  /**
   * Toggles the read status of the item.
   * Changes the value of `isRead` between true and false.
   */
  const toggleReadStatus = () => {
    setIsRead((prevState) => !prevState);
  };

  /**
   * Opens a document based on the provided category and document ID.
   * Dynamically selects the target screen and prepares the parameters to pass to the screen.
   * If the document category does not exist in the map, shows a toast error message.
   *
   * @param {string} documentId - The ID of the document to open.
   * @param {string} documentCategory - The category of the document (e.g., "TimeConfirmation", "Expense", "Absence").
   * @param {string} processTemplateExtId - The external ID for the process template (optional).
   * @returns {Promise<void>} - A promise that resolves when the navigation is complete or exits early in case of an error.
   */
  const openDocument = useCallback(
    async (documentId, documentCategory, processTemplateExtId) => {
      try {
        setLoading(true);

        // Determine the target screen for the provided document category
        const targetScreen = componentMap[documentCategory];

        // If the category is not found in the component map, notify the user with a toast and exit
        if (!targetScreen) {
          showToast(t("document_cannot_open", { documentCategory }), "error");
          return; // Prevent further execution if the screen is invalid
        }

        // Get predefined parameters for the document category, or use an empty object if none are found
        const params = detailScreenParamsMap[documentCategory] || {};

        // Initialize an object to store navigation parameters dynamically
        const navigationParams = {};

        // Add the document ID to the navigation parameters if required by the document category
        if (params.documentId) {
          navigationParams[params.documentId] = documentId;
        }

        // Add the process template external ID to the navigation parameters if applicable
        if (params.statusTemplateExtId) {
          navigationParams[params.statusTemplateExtId] = processTemplateExtId;
        }

        // Mark the navigation as originating from the approval screen
        navigationParams.openedFromApproval = true;

        // Fetch additional employee details based on the document category and ID
        const { success, employeeDetails, error } = await fetchEmployeeDetails(
          documentCategory,
          documentId
        );

        // If fetching employee details fails, show an error toast and exit
        if (!success) {
          showToast(
            t("failed_to_fetch_employee_details") + `: ${error}`,
            "error"
          );
          return; // Exit early if employee details are unavailable
        }

        // If setApprovalUserInfo is asynchronous, await its completion here
        await setApprovalUserInfo({
          userType: employeeDetails["Resource-userID:User-type"] || "",
          timeConfirmationType: employeeDetails.timeConfirmationType || "",
          hireDate: employeeDetails["Resource-core-hireDate"] || null,
          gender: employeeDetails["Resource-core-gender"] || "",
          termDate: employeeDetails.termDate || null,
          personId: employeeDetails["Resource-personID"] || null,
          companyId: employeeDetails["Resource-companyID"] || null,
          workScheduleExtId:
            employeeDetails["Resource-timeMgt-workScheduleID"] || null,
          workScheduleName:
            employeeDetails[
              "Resource-timeMgt-workScheduleID:WorkSchedule-name"
            ] || null,
          calendarExtId:
            employeeDetails[
              "Resource-timeMgt-workScheduleID:WorkSchedule-calendarID"
            ] || null,
          nonWorkingDates:
            employeeDetails[
              "Resource-timeMgt-workScheduleID:WorkSchedule-calendarID:WorkCalendar-nonWorkingDates"
            ] || null,
          nonWorkingDays:
            employeeDetails[
              "Resource-timeMgt-workScheduleID:WorkSchedule-calendarID:WorkCalendar-nonWorkingDays"
            ] || null,
          startOfWeek:
            employeeDetails[
              "Resource-timeMgt-workScheduleID:WorkSchedule-calendarID:WorkCalendar-startOfWeek"
            ] || null,
          dailyStdHours:
            employeeDetails[
              "Resource-timeMgt-workScheduleID:WorkSchedule-dailyStdHours"
            ] || null,
          stdWorkHours: employeeDetails.stdWorkHours || null,
          minWorkHours:
            employeeDetails[
              "Resource-timeMgt-workScheduleID:WorkSchedule-minWorkHours"
            ] || null,
          maxWorkHours:
            employeeDetails[
              "Resource-timeMgt-workScheduleID:WorkSchedule-maxWorkHours"
            ] || null,
          workHoursInterval: employeeDetails.workHoursInterval || null,
          patterns:
            employeeDetails[
              "Resource-timeMgt-workScheduleID:WorkSchedule-patterns"
            ] || null,
        });

        // After ensuring that the context has been updated, navigate to the target screen
        navigation.navigate(targetScreen, navigationParams);
      } catch (error) {
        // Log any unexpected error for debugging and notify the user with a generic error message
        console.error("Error in openDocument: ", error);
        showToast(t("unexpected_error"), "error");
      } finally {
        setLoading(false);
      }
    },
    [navigation] // Re-create the function only if the `navigation` object changes
  );

  /**
   * Navigate to the filters screen with initial filter settings.
   */
  const navigateToFilters = () => {
    const initialFilters = convertToFilterScreenFormat(
      appliedFilters,
      filtersMap[BUSOBJCAT.MESSAGELOG],
      BUSOBJCAT.MESSAGELOG
    );

    const pickerOptions = {
      messageTypeOptions: Object.entries(messageTypeMap).map(
        ([key, value]) => ({
          label: value,
          value: key,
        })
      ),
      documentCategoryOptions: Object.entries(busObjCatMap).map(
        ([key, value]) => ({
          label: value,
          value: key,
        })
      ),
      messageWithinOptions: Object.entries(messageWithinMap).map(
        ([key, value]) => ({
          label: value,
          value: key,
        })
      ),
    };

    navigation.navigate("Filters", {
      busObjCatFilters: filtersMap[BUSOBJCAT.MESSAGELOG],
      busObjCat: BUSOBJCAT.MESSAGELOG,
      initialFilters: initialFilters,
      pickerOptions: pickerOptions,
    });
  };

  /**
   * Validates the recipient approval input.
   *
   * @param {Object} values - The values to validate.
   * @param {Object} values.recipientApproval - The recipient approval object.
   * @param {string} values.recipientApproval.label - The label of the recipient.
   * @param {string} values.recipientApproval.value - The value of the recipient.
   *
   * @returns {boolean|string|null} - Returns `null` if the recipient is valid, or an error message if invalid.
   */
  const validateRecipient = (values) => {
    const { recipientApproval } = values || {};

    // Check if recipientApproval, label, and value are valid
    if (
      recipientApproval &&
      hasContent(recipientApproval.label) &&
      hasContent(recipientApproval.value)
    ) {
      return null; // Return null if valid
    }

    return t("recipient_required"); // Return error message if invalid
  };

  /**
   * Validates the comment input.
   *
   * @param {string} comment - The comment to validate.
   * @param {object} values - The object containing additional validation values (e.g., commentApproval).
   * @returns {boolean|string|null} - Returns `null` if valid, an error message if invalid.
   */
  const validateComment = (values) => {
    const { commentApproval } = values || {};

    // Check if commentApproval has content and is truthy
    if (commentApproval && hasContent(commentApproval)) {
      return null; // Comment is valid if commentApproval exists and comment has content
    } else {
      return t("comment_required"); // Return error message if comment is missing or commentApproval is not valid
    }
  };

  /**
   * Handle the confirmation of the comment dialog and trigger the status change.
   *
   * @param {Object} values - The values entered in the dialog.
   * @param {string} values.commentApproval - The comment approval input.
   * @param {Object} values.recipientApproval - The recipient approval object.
   * @param {string} values.recipientApproval.label - The label of the recipient.
   * @param {string} values.recipientApproval.value - The value of the recipient.
   */
  const handleCommentDialogConfirm = async (values) => {
    try {
      console.log("Confirming comment dialog...");
      const { commentApproval, recipientApproval } = values || {};

      if (clickedStatusButton) {
        // Ensure immutability when updating the record's state
        if (clickedStatusButton.record) {
          clickedStatusButton.record = {
            ...clickedStatusButton.record, // Preserve existing properties
            commentsEntered: true, // Mark comments as entered
          };
        }

        const recipientValue = recipientApproval?.value || null;
        const commentValue = commentApproval || null;

        // Trigger the status change
        await handleStatusChangeMgmt(
          clickedStatusButton,
          updateRefresh,
          recipientValue,
          commentValue,
          [], // Additional parameters if needed
          null
        );

        console.log("Status change handled successfully.");
      }

      // Close the dialog after status change is completed
      setIsCommentDialogVisible(false);
      setChangeRecipient(false);
      setCommentRequired(false);
    } catch (error) {
      // Log error for debugging purposes
      console.error("Error during status change:", error);
    }
  };

  /**
   * Fetches message log data asynchronously from the API based on a date filter.
   *
   * This function constructs a request to fetch message log data using the `MessageLogRead` API method.
   * The logs are filtered based on the `messageWithin` value, which determines the start date for the filter.
   * It processes the response, checks if valid message log data is present, and returns the list of logs. If no valid data is found or an error occurs, an empty array is returned.
   *
   * @param {string} messageWithin - A filter value (e.g., "lastMonth", "lastWeek") used to determine the start date for fetching message logs.
   *                                 Defaults to "lastMonth" if no value is provided.
   * @returns {Promise<Array>} A promise that resolves to an array of message log data, or an empty array if no data is found or an error occurs.
   */

  const fetchMessageLogData = async (messageWithin = "lastMonth") => {
    try {
      setLoading(true);

      const publishedSinceDate = getStartDateForFilter(messageWithin);

      const requestBody = {
        interfaceName: "MessageLogRead",
        methodName: "getMessageLog",
        userID: APP.LOGIN_USER_ID,
        paramsMap: {
          clientID: APP.LOGIN_USER_CLIENT,
          userID: APP.LOGIN_USER_ID,
          language: APP.LOGIN_USER_LANGUAGE,
          isRead: isRead,
          user: null,
          publishedSinceDate: publishedSinceDate,
        },
      };

      const response = await fetchData(
        API_ENDPOINTS.INVOKE,
        "POST",
        {
          "Content-Type": "application/json",
        },
        JSON.stringify(requestBody)
      );

      // Check if the response contains the necessary message log data
      if (
        response &&
        response.success &&
        response.retVal &&
        response.retVal.uimessageloglist
      ) {
        const formattedPublishedSinceDate = format(
          publishedSinceDate,
          "dd MMMM yyyy"
        );

        showToast(
          t("message_log_fetched_since", {
            publishedSinceDate: formattedPublishedSinceDate,
          }),
          "warning"
        );
        console.log("Message log data fetched successfully.");
        return response.retVal.uimessageloglist;
      }

      console.log("No valid messages found.");
      return []; // Return empty array if no valid messages
    } catch (error) {
      console.error("Failed to fetch message log data:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Memoized headerLeft component.
   * This component will be used as the left side of the navigation header.
   * It includes a back button and a dynamic title with the count of items in the 'data' array.
   *
   * @returns {JSX.Element} Left side of the header
   */
  const headerLeft = useCallback(() => {
    return (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton navigation={navigation} t={t} />
        <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
          {t("approval")}s ({data.length}){" "}
          {/* Display "approvals" with count */}
        </Text>
      </View>
    );
  }, [navigation, data.length, t]);

  /**
   * Memoized headerRight component.
   * This component will be used as the right side of the navigation header.
   * It includes a button with a notification icon (bell) that can trigger a function when pressed.
   * Currently, the onPress function is empty for now.
   *
   * @returns {JSX.Element} Right side of the header
   */
  const headerRight = useCallback(() => {
    return (
      <View style={styles.headerRightContainer}>
        <TouchableOpacity
          style={styles.readToggleButton}
          onPress={toggleReadStatus}
          accessibilityLabel={isRead ? t("read") : t("unread")}
          accessibilityRole="switch"
          accessibilityState={{ checked: isRead }}
          testID="unread-toggle-switch"
        >
          <Text style={styles.readToggleText} numberOfLines={1}>
            {isRead ? t("read") : t("unread")}
          </Text>
          <View
            style={[
              styles.readToggleIndicator,
              isRead && styles.readToggleIndicatorActive,
            ]}
          />
        </TouchableOpacity>
        <View style={styles.headerIconsContainer}>
          <CustomButton
            onPress={navigateToFilters}
            label=""
            icon={{
              name: "filter",
              library: "FontAwesome",
              size: 24,
              color: "white",
            }}
            disabled={loading}
          />
          {/* Show filter count if filters are applied */}
          {appliedFiltersCount > 0 && (
            <View style={styles.headerIconsCountContainer}>
              <Text style={styles.headerIconsCountText}>
                {appliedFiltersCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }, [isRead, t, toggleReadStatus, appliedFiltersCount, loading]);

  /**
   * useEffect hook to set the navigation header options whenever the 'data' or
   * any of the header components change. This will update the left and right
   * header components dynamically.
   *
   * @returns {void}
   */
  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft,
      headerRight,
    });
  }, [navigation, data, headerLeft, headerRight]);

  useEffect(() => {
    // Update applied filters when route params change
    const newAppliedFilters = route?.params?.convertedAppliedFilters ?? {};
    setAppliedFilters(newAppliedFilters);
    // Update applied filters count when route params change
    setAppliedFiltersCount(Object.keys(newAppliedFilters).length);
  }, [route?.params?.convertedAppliedFilters]);

  /**
   * useEffect hook to fetch and load initial data when the component is mounted.
   *
   * This effect runs only once after the component is initially rendered. It fetches required data
   * asynchronously, including message types, business object categories, and message log data,
   * and updates the component state with the fetched data. If any fetch operation fails, an error
   * is logged.
   */
  useEffect(() => {
    /**
     * Asynchronous function to load required data for the component.
     *
     * The function performs the following tasks:
     * - Fetches message type data and business object categories concurrently using `Promise.all`.
     * - After the message type and business object categories are fetched, it proceeds to fetch the message log data.
     * - Updates component state with the fetched message types, business object categories, and message log data.
     * - Logs errors if any of the fetch operations fail.
     */
    const loadInitialData = async () => {
      try {
        // Fetch message types and business object categories concurrently
        const [messageTypes, busObjCats] = await Promise.all([
          fetchMessageTypeData(),
          fetchBusObjCatData(),
        ]);

        // Update state with fetched message types and business object categories
        setMessageTypeMap(messageTypes);
        setBusObjCatMap(busObjCats);

        // Fetch message log data after the initial data is loaded
        const result = await fetchMessageLogData();
        if (result) {
          setData(result);
        } else {
          console.error("No messages received or data was invalid.");
        }
      } catch (error) {
        // Log any errors that occur during the data fetching process
        console.error("Error loading data:", error);
      }
    };

    // Trigger the data loading once when the component is mounted
    loadInitialData();
  }, []);

  /**
   * The useEffect hook that loads message log data and applies filters based on the dependencies.
   *
   * This effect runs whenever the `isRead`, `refreshKey`, or `appliedFilters` (which includes `messageWithin`)
   * dependencies change. It performs the following actions:
   * 1. Sets the `messageWithin` filter state from `appliedFilters`.
   * 2. Fetches the message log data from the server using the `fetchMessageLogData` function.
   * 3. If the data is successfully fetched, it applies local filters (e.g., `messageType`, `documentCategory`)
   *    using the `applyLocalFilters` function.
   * 4. Finally, updates the `data` state with the filtered results.
   *
   * In case of any errors during the fetch operation, an error message is logged.
   */
  useEffect(() => {
    const loadDataAndApplyFilters = async () => {
      try {
        // Fetch message log data from the server
        const messageLogData = await fetchMessageLogData(
          appliedFilters.messageWithin
        );

        // If message log data is successfully fetched, apply filters
        if (messageLogData) {
          const filteredData = applyLocalFilters(
            messageLogData,
            appliedFilters
          );

          setData(filteredData); // Update the data state with filtered results
        } else {
          console.error("Failed to fetch message log data or data is empty.");
        }
      } catch (error) {
        console.error("Error fetching message log data:", error);
      }
    };

    loadDataAndApplyFilters();
  }, [isRead, refreshKey, appliedFilters]);

  /**
   * Render a single message item for the FlatList.
   */
  const renderItem = useCallback(
    ({ item }) => {
      const actionPerformed = item.fields.find(
        (field) => field.name === "actionPerformed"
      )?.value;
      const documentId = item.iD;
      const documentCategory = item.busObjCat;
      const processTemplateExtId = item.fields.find(
        (field) => field.name === "processTemplateID"
      )?.value;

      return (
        <View style={styles.itemContainer}>
          <View style={styles.firstRow}>
            <View style={styles.firstRowFirstColumn}>
              <Text numberOfLines={3} ellipsizeMode="tail">
                {item.text}
              </Text>
            </View>
            <View style={styles.firstRowSecondColumn}>
              <CustomButton
                onPress={() =>
                  openDocument(
                    documentId,
                    documentCategory,
                    processTemplateExtId
                  )
                }
                label=""
                icon={{
                  name: "open-outline",
                  library: "Ionicons",
                  size: 24,
                  color: "blue",
                }}
              />
            </View>
          </View>
          <View style={styles.secondRow}>
            <Text numberOfLines={1} ellipsizeMode="tail">
              {messageTypeMap[item.type] || item.type || ""}
            </Text>
            <Text numberOfLines={1} ellipsizeMode="tail">
              {busObjCatMap[item.busObjCat] || item.busObjCat || ""}
            </Text>
          </View>
          <View style={styles.thirdRow}>
            <Text numberOfLines={1} ellipsizeMode="tail">
              {item.publishedOn &&
                `${format(
                  item.publishedOn,
                  convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
                )} (${getPublishedAge(item.publishedOn)})`}
            </Text>
            <Text numberOfLines={1} ellipsizeMode="tail">
              {item.publishedByFullName || ""}
            </Text>
          </View>
          <View style={styles.lastRow}>
            <View style={styles.statusContainer}>
              <Text
                style={styles.textBold}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {actionPerformed || ""}
              </Text>
            </View>
            <GestureHandlerRootView>
              <View style={styles.buttonContainer}>
                {item.buttons &&
                  !item.respondedOn &&
                  item.buttons.map((button, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleButtonPress(item, button)}
                      style={styles.customButton}
                    >
                      <Text
                        style={styles.buttonText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {button.clickableTextMsg}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </GestureHandlerRootView>
          </View>
        </View>
      );
    },
    [messageTypeMap, busObjCatMap]
  );

  /**
   * Handle button press for status change, possibly triggering the comment dialog.
   *
   * @param {Object} item - The data record associated with the button.
   * @param {Object} button - The button details containing updFields.
   */
  const handleButtonPress = async (item, button) => {
    try {
      console.log("Button Pressed:", button.clickableTextMsg);

      // Prepare clicked status button details
      const clickedStatusButtonDetails = {
        record: item,
        updFields: button.updFields,
      };

      setClickedStatusButton(clickedStatusButtonDetails);

      // Process the update fields
      const {
        changeRecipient,
        comment,
        nextStatusCodes,
        openPreviousGateways,
      } = processUpdateFields(clickedStatusButtonDetails.updFields);

      // Check conditions for comment dialog
      const needsCommentDialog =
        !clickedStatusButtonDetails.record.commentsEntered &&
        (changeRecipient || comment);

      setChangeRecipient(changeRecipient);
      setCommentRequired(comment);

      if (needsCommentDialog) {
        // Show comment dialog if necessary
        setIsCommentDialogVisible(true);
      } else {
        // Proceed with status change if no comment dialog is needed
        await handleStatusChangeMgmt(
          clickedStatusButtonDetails,
          updateRefresh,
          null, // remarkComment
          null, // recipient
          nextStatusCodes,
          openPreviousGateways
        );
      }
    } catch (error) {
      console.error(`Error handling ${button.clickableTextMsg} button:`, error);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader left={headerLeft()} right={headerRight()} />
      <SafeAreaView
        style={styles.container}
        edges={["right", "bottom", "left"]}
      >
      {/* Loader when data is being fetched */}
      {loading ? (
        <Loader />
      ) : data.length === 0 ? (
        // Display 'No new messages' if data is empty
        <View style={styles.emptyMessageContainer}>
          <Text style={styles.emptyMessageText}>{t("no_new_messages")}</Text>
        </View>
      ) : (
        // FlatList to display the message log data
        <FlatList
          data={data}
          keyExtractor={(item, index) => item.id.toString() ?? index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
      {/* EditDialog for displaying the comment input form */}
      <EditDialog
        isVisible={isCommentDialogVisible}
        onClose={() => setIsCommentDialogVisible(false)}
        onConfirm={handleCommentDialogConfirm}
        title={""}
        inputsConfigs={[
          // Show recipientApproval only if changeRecipient is true
          ...(changeRecipient
            ? [
                {
                  id: "recipientApproval",
                  type: "dropdown",
                  allowBlank: true,
                  queryFields: {
                    fields: ["Person-id", "Person-name-knownAs"],
                    sort: [
                      {
                        property: "Person-name-knownAs",
                        direction: "ASC",
                      },
                    ],
                  },
                  commonQueryParams: {
                    filterQueryValue: "",
                    userID: APP.LOGIN_USER_ID,
                    client: parseInt(APP.LOGIN_USER_CLIENT),
                    language: APP.LOGIN_USER_LANGUAGE,
                    intStatus: JSON.stringify([INTSTATUS.ACTIVE, 1]),
                    page: 1,
                    start: 0,
                    limit: 20,
                  },
                  pickerLabel: t("select_recipient"),
                  labelItemField: "Person-name-knownAs",
                  valueItemField: "Person-id",
                  searchFields: ["Person-name-knownAs"],
                  validateInput: validateRecipient,
                },
              ]
            : []),
          // Show commentApproval only if commentRequired is true
          ...(commentRequired
            ? [
                {
                  id: "commentApproval",
                  type: "richText",
                  initialValue: null,
                  validateInput: validateComment,
                },
              ]
            : []),
        ]}
      />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
  headerLeftContainer: {
    maxWidth: screenDimension.width * 0.62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flexShrink: 1,
  },
  headerRightContainer: {
    maxWidth: screenDimension.width * 0.36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 0,
  },
  headerIconsContainer: {
    position: "relative",
  },
  headerText: {
    fontSize: screenDimension.width > 400 ? 18 : 16,
    fontWeight: "bold",
    color: "#fff",
  },
  listContainer: {
    paddingTop: 10,
    paddingBottom: 24,
  },
  itemContainer: {
    backgroundColor: "#fff",
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  firstRow: {
    flexDirection: "row",
    alignItems: "center",
    fontWeight: "bold",
    padding: "2%",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  firstRowFirstColumn: {
    flex: 1,
  },
  firstRowSecondColumn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  secondRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "2%",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  thirdRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "2%",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  lastRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "2%",
    backgroundColor: "#e5eef7",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  statusContainer: {
    flex: 1 / 2,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    rowGap: 4,
    columnGap: 4,
  },
  customButton: {
    padding: "2%",
    borderWidth: 1,
    backgroundColor: Platform.OS === "ios" ? "#007AFF" : "#2196F3",
    borderRadius: 4,
  },
  buttonText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  textBold: {
    fontWeight: "bold",
  },
  readToggleButton: {
    minHeight: 36,
    maxWidth: 112,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingLeft: 10,
    paddingRight: 6,
  },
  readToggleText: {
    flexShrink: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginRight: 6,
  },
  readToggleIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    opacity: 0.72,
  },
  readToggleIndicatorActive: {
    backgroundColor: "#f5dd4b",
    opacity: 1,
  },
  emptyMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyMessageText: {
    fontSize: 18,
    color: "#555",
  },
  headerIconsCountContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#ffd33d",
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    pointerEvents: "none",
  },
  headerIconsCountText: {
    color: "black",
    fontSize: 12,
    fontWeight: "bold",
  },
});

export default Approval;
