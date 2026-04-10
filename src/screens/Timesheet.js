import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "react-i18next";

import { format, isValid } from "date-fns";

import {
  APP,
  BUSOBJCAT,
  BUSOBJCATMAP,
  DOUBLE_CLICK_DELTA,
  PAGE_SIZE,
} from "../constants";

import { fetchBusObjCatData, loadMoreData } from "../utils/APIUtils";
import { convertToFilterScreenFormat, filtersMap } from "../utils/FilterUtils";
import { checkTimesheetExistsForDate } from "../utils/TimesheetUtils";
import {
  convertMillisecondsToUnit,
  convertToDateFNSFormat,
} from "../utils/FormatUtils";
import { showToast } from "../utils/MessageUtils";
import { screenDimension } from "../utils/ScreenUtils";

import CustomButton from "../components/CustomButton";
import CustomDateTimePicker from "../components/CustomDateTimePicker";
import Loader from "../components/Loader";

import { useTimesheetForceRefresh } from "../../context/ForceRefreshContext";
import Sort from "../components/filters/Sort";
import CustomBackButton from "../components/CustomBackButton";

/**
 * Timesheet component displays a list of timesheets with the ability to refresh
 * and load more data using pagination.
 *
 * @param {Object} route - The route object provided by React Navigation.
 * @param {Object} navigation - The navigation object provided by React Navigation.
 * @returns {JSX.Element} - Rendered component.
 */
const Timesheet = ({ route, navigation }) => {
  // Initialize useTranslation hook
  const { t } = useTranslation();

  // Destructure the forceRefresh variable and updateForceRefresh function from the useTimesheetForceRefresh hook,
  // which is accessing the TimesheetForceRefreshContext.
  const { forceRefresh, updateForceRefresh } = useTimesheetForceRefresh();

  const navigationTimeoutRef = useRef(null); // Ref to store the timeout ID

  // State variables
  const [refreshing, setRefreshing] = useState(false); // Pull-to-refresh
  const [isFetchingMore, setIsFetchingMore] = useState(false); // Infinite scroll loader
  const [isLoadingInCreate, setIsLoadingInCreate] = useState(false);
  const [error, setError] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});
  const [additionalData, setAdditionalData] = useState({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [whereConditions, setWhereConditions] = useState([]);
  const [orConditions, setOrConditions] = useState([]);
  const [sortConditions, setSortConditions] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [appliedFiltersCount, setAppliedFiltersCount] = useState(0);
  const [lastPress, setLastPress] = useState(0);
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isModalVisibleInCreate, setModalVisibleInCreate] = useState(false);
  const [selectedDateInCreate, setSelectedDateInCreate] = useState(new Date());
  const [errorMessageInCreate, setErrorMessageInCreate] = useState(null);
  const [infoMessageInCreate, setInfoMessageInCreate] = useState(null);

  /**
   * Opens the modal for creating a timesheet entry.
   */
  const showCreateTimesheetPopup = () => {
    setModalVisibleInCreate(true);
  };

  /**
   * Updates the selected date when the user picks a date.
   * @param {Date} date - The newly selected date.
   */
  const handleDateChangeInCreate = (date) => {
    setSelectedDateInCreate(date);
  };

  /**
   * Sets an error message to be displayed and clears any informational message.
   * @param {string} message - The error message to display.
   */
  const showErrorInCreate = (message) => {
    setErrorMessageInCreate(message);
    setInfoMessageInCreate(null); // Clear info message
  };

  /**
   * Sets an informational message to be displayed and clears any error message.
   * @param {string} message - The informational message to display.
   */
  const showInfoInCreate = (message) => {
    setInfoMessageInCreate(message);
    setErrorMessageInCreate(null); // Clear error message
  };

  /**
   * Handles the confirmation of the timesheet creation.
   * Validates the date, performs a network call, and shows appropriate messages.
   */
  const handleConfirmInCreate = async () => {
    if (!selectedDateInCreate) {
      showErrorInCreate(t("date_cannot_be_empty")); // Show error if date is empty
      return;
    }

    setIsLoadingInCreate(true);

    try {
      // Make network call to check if timesheet exists for the selected date
      const response = await checkTimesheetExistsForDate(
        selectedDateInCreate,
        showInfoInCreate,
        t
      );

      const handleNavigation = () => {
        setIsLoadingInCreate(false);
        handleCloseModalInCreate();

        if (response.exists) {
          navigation.navigate("TimesheetDetail", {
            timesheetId: response.data[0].id,
            statusTemplateExtId: response.data[0].statusTemplateExtId,
          });
        } else {
          navigation.navigate("TimesheetDetail", {
            selectedDate: selectedDateInCreate.toISOString(),
          });
        }
      };

      if (response.exists) {
        showInfoInCreate(t("info_timesheet_exists"));
      } else {
        showInfoInCreate(t("info_timesheet_not_exists"));
      }

      // Set a timeout for 3 seconds before navigating
      navigationTimeoutRef.current = setTimeout(handleNavigation, 3000);
    } catch (error) {
      setIsLoadingInCreate(false);
      console.error("Error checking timesheet existence:", error);
      showErrorInCreate(t("error_checking_timesheet"));
    }
  };

  /**
   * Closes the modal and clears any displayed messages.
   */
  const handleCloseModalInCreate = () => {
    setModalVisibleInCreate(false);
    setErrorMessageInCreate(null); // Clear error message
    setInfoMessageInCreate(null); // Clear informational message
    setSelectedDateInCreate(new Date()); // Reset selected date
    setIsLoadingInCreate(false); // Reset loading state when closing the modal

    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current); // Clear the timeout if it exists
      navigationTimeoutRef.current = null; // Reset the timeout variable
    }
  };

  /**
   * Toggle the expansion state of an item and display additional data if available.
   *
   * This function toggles the expansion state of an item identified by its unique itemId.
   * If the item is being expanded (i.e., it was previously collapsed), this function
   * retrieves additional data related to the item from the timesheets data and updates
   * the additional data state accordingly.
   *
   * @param {string} itemId - The unique identifier of the item.
   * @returns {void}
   */
  const toggleItemExpansion = (itemId) => {
    setExpandedItems((prevExpandedItems) => {
      // Toggle the item expansion state
      const newExpandedItems = {
        ...prevExpandedItems,
        [itemId]: !prevExpandedItems[itemId],
      };

      // If expanding, update additional data state
      if (!prevExpandedItems[itemId]) {
        // Retrieve additional data for the item from timesheets
        const item = timesheets.find(
          (item) => item["TimeConfirmation-id"] === itemId
        );

        const totalTime = item?.["TimeConfirmation-totalTime"] || 0;
        const convertedTotalTime =
          convertMillisecondsToUnit(
            totalTime,
            totalTime >= 3600000 ? "hours" : "minutes"
          )?.displayTime || "";

        const billableTime = item?.["TimeConfirmation-billableTime"] || 0;
        const convertedBillableTime =
          convertMillisecondsToUnit(
            billableTime,
            billableTime >= 3600000 ? "hours" : "minutes"
          )?.displayTime || "";

        const overTime = item?.["TimeConfirmation-totalOvertime"] || 0;
        const convertedOverTime =
          convertMillisecondsToUnit(
            overTime,
            overTime >= 3600000 ? "hours" : "minutes"
          )?.displayTime || "";

        // Define the additional data for the item
        const additionalData = {
          totalTime: convertedTotalTime,
          billableTime: convertedBillableTime,
          overTime: convertedOverTime,
        };
        setAdditionalData((prevData) => ({
          ...prevData,
          [itemId]: additionalData,
        }));
      }

      return newExpandedItems;
    });
  };

  /**
   * Function to handle data refreshing.
   * This function is triggered when the user performs a pull-to-refresh action or when
   * the timesheet screen mounts for the first time. It fetches timesheet data from
   * the first page, resets the current page to 1, and updates the timesheets state
   * with the new data.
   *
   * @async
   * @function onRefresh
   * @returns {Promise<void>} A Promise that resolves when data refreshing is complete.
   */
  const onRefresh = useCallback(async () => {
    // Set refreshing state to true to indicate that data refreshing is in progress
    setRefreshing(true);

    // Reset page to 1 for refreshing
    setPage(1);

    try {
      // Fetch timesheet data for the first page
      const response = await fetchBusObjCatData(
        BUSOBJCAT.TIMESHEET,
        1,
        limit,
        null,
        whereConditions,
        orConditions,
        sortConditions
      );
      if (response?.error) {
        console.error("Error refreshing data:", response.error);
      } else {
        // Update timesheets state with new data if response is not null
        setTimesheets(response?.data || []);
        setTotalCount(response?.totalCount || 0);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      // Set refreshing state back to false after data refreshing is complete
      setRefreshing(false);
    }
  }, [setTimesheets, whereConditions, orConditions, sortConditions, limit]);

  useEffect(() => {
    // Update whereConditions when route params change
    setWhereConditions(route?.params?.whereConditions ?? []);
    // Update orConditions when route params change
    setOrConditions(route?.params?.orConditions ?? []);
  }, [route?.params?.whereConditions, route?.params?.orConditions]);

  useEffect(() => {
    // Update applied filters when route params change
    const newAppliedFilters = route?.params?.convertedAppliedFilters ?? {};
    setAppliedFilters(newAppliedFilters);
    // Update applied filters count when route params change
    setAppliedFiltersCount(Object.keys(newAppliedFilters).length);
  }, [route?.params?.convertedAppliedFilters]);

  useEffect(() => {
    setPage(1);
    // Trigger refresh when the component mounts
    onRefresh();
  }, [whereConditions, orConditions, sortConditions]);

  /**
   * Effect to ensure that the Timesheet component's data is refreshed whenever changes occur in other parts of the application
   * that affect the timesheet list. These changes may include updates to timesheet details, deletions of timesheets, or any other relevant modifications.
   * This effect resets the page to 1 and triggers a refresh when the 'forceRefresh' state is updated.
   */
  useEffect(() => {
    setPage(1);
    if (forceRefresh) {
      onRefresh();
      updateForceRefresh(false); // Resetting forceRefresh to false after triggering the refresh
    }
  }, [forceRefresh]);

  /**
   * Function to handle loading more data when the end of the list is reached.
   * This function is triggered to load additional data when the end of the list is reached during scrolling.
   * It calls a utility function to fetch more data and updates the list state accordingly.
   * @returns {void}
   */
  const handleLoadMoreData = useCallback(() => {
    // Check if the current data already contains all the items for the current page
    if (timesheets.length < page * limit) {
      showToast(t("no_more_data"), "warning");
      return;
    }

    // Proceed to load more data only if there are no errors
    if (!error) {
      // Call utility function to load more data
      loadMoreData(
        BUSOBJCAT.TIMESHEET,
        page + 1, // Increment page for the next set of data
        limit,
        null,
        whereConditions,
        orConditions,
        sortConditions,
        setTimesheets,
        setIsFetchingMore,
        setError
      ).finally(() => {
        setPage(page + 1); // Update page for the next load
      });
    }
  }, [
    page,
    limit,
    setTimesheets,
    timesheets.length,
    setError,
    error,
    whereConditions,
    orConditions,
    sortConditions,
  ]);

  /**
   * Navigate to the filters screen with initial filter settings.
   */
  const navigateToFilters = () => {
    const initialFilters = convertToFilterScreenFormat(
      appliedFilters,
      filtersMap[BUSOBJCAT.TIMESHEET],
      BUSOBJCAT.TIMESHEET
    );

    navigation.navigate("Filters", {
      busObjCatFilters: filtersMap[BUSOBJCAT.TIMESHEET],
      busObjCat: BUSOBJCAT.TIMESHEET,
      initialFilters: initialFilters,
    });
  };

  /**
   * Opens the sort modal.
   */
  const openSortingModal = () => {
    setIsSortModalVisible(true);
  };

  /**
   * Closes the sort modal and sets the sorting conditions.
   *
   * @param {Array} sortedArray - Array of sorted conditions.
   */
  const closeSortingModal = (sortedArray) => {
    if (sortedArray) {
      setSortConditions(sortedArray);
    }
    setIsSortModalVisible(false);
  };

  /**
   * Rendered component for the left side of the header.
   * Displays the count of timesheets and total count.
   */
  const headerLeft = useCallback(() => {
    // Calculate the current timesheet count
    let timesheetCount = timesheets.length;

    return (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton navigation={navigation} t={t} />
        <Text
          style={styles.recordCountText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {/* Display timesheet count, pluralize as necessary, and show totalCount if available */}
          {`${t("timesheet")}${timesheetCount !== 1 ? t("s") : ""}: ${
            timesheetCount > 0 ? timesheetCount : 0
          }${totalCount > 0 ? ` / ${totalCount}` : ""}`}
        </Text>
      </View>
    );
    // Dependencies: re-render only when timesheets or totalCount changes
  }, [timesheets, totalCount]);

  /**
   * Rendered component for the right side of the header.
   * Contains buttons for creating a timesheet, filtering, and sorting.
   */
  const headerRight = useCallback(() => {
    return (
      <View style={styles.headerRightContainer}>
        {/* Button for creating a new timesheet */}
        <CustomButton
          onPress={showCreateTimesheetPopup}
          label=""
          icon={{
            name: "add-circle-sharp",
            library: "Ionicons",
            size: 30,
            color: "white",
          }}
          disabled={refreshing}
        />
        <View style={styles.headerIconsContainer}>
          {/* Button for applying filters */}
          <CustomButton
            onPress={navigateToFilters}
            label=""
            icon={{
              name: "filter",
              library: "FontAwesome",
              size: 30,
              color: "white",
            }}
            disabled={refreshing}
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
        <View style={styles.headerIconsContainer}>
          {/* Button for sorting timesheets */}
          <CustomButton
            onPress={openSortingModal}
            label=""
            icon={{
              name: "sort",
              library: "FontAwesome",
              size: 30,
              color: "white",
            }}
            disabled={refreshing}
          />
          {/* Show the number of sort conditions applied */}
          {sortConditions.length > 0 && (
            <View style={styles.headerIconsCountContainer}>
              <Text style={styles.headerIconsCountText}>
                {sortConditions.length}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
    // Dependencies: re-render only when appliedFiltersCount or sortConditions changes
  }, [appliedFiltersCount, sortConditions, refreshing]);

  /**
   * useEffect hook to set the header options (left and right components) when the component is mounted
   * or when timesheets, totalCount, appliedFiltersCount, or sortConditions change.
   */
  useEffect(() => {
    // Set custom header components
    navigation.setOptions({
      headerTitle: "",
      headerLeft: headerLeft,
      headerRight: headerRight,
    });
    // Dependencies: ensure the header updates when these values change
  }, [
    headerLeft,
    headerRight,
    timesheets,
    totalCount,
    appliedFiltersCount,
    sortConditions,
  ]);

  return (
    <SafeAreaView style={styles.container}>
      {
        // Hack/Workaround for iOS: Display the loader manually when refreshing
        // state is true because onRefresh loader doesn't trigger correctly on
        // component mount for iOS.
      }
      {Platform.OS === "ios" && refreshing && <Loader />}
      <FlatList
        data={timesheets}
        keyExtractor={(item) => item["TimeConfirmation-id"]}
        renderItem={({ item, index }) => {
          try {
            // Extracting and formatting data for each timesheet item
            const timesheetId = item?.["TimeConfirmation-id"];

            const startDate = new Date(item["TimeConfirmation-start"]);
            const formattedStartDate = isValid(startDate)
              ? format(
                  startDate,
                  convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
                )
              : "Invalid start date";

            const endDate = new Date(item["TimeConfirmation-end"]);
            const formattedEndDate = isValid(endDate)
              ? format(
                  endDate,
                  convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
                )
              : "Invalid end date";

            const statusTemplateExtId =
              item?.["TimeConfirmation-extStatus-processTemplateID"] || "";

            const statusSteps =
              item?.[
                "TimeConfirmation-extStatus-processTemplateID:ProcessTemplate-steps"
              ] || [];

            const statusExtId =
              item?.["TimeConfirmation-extStatus-statusID"] || "";

            const matchingStep =
              statusExtId && statusSteps && statusSteps instanceof Array
                ? statusSteps.find((step) => step.extID === statusExtId)
                : null;

            const statusLabel = matchingStep ? matchingStep.statusLabel : "";

            let remark = item?.["TimeConfirmation-remark:text"] || "";

            const totalTime = item?.["TimeConfirmation-totalTime"] || 0;
            const convertedTotalTime =
              convertMillisecondsToUnit(
                totalTime,
                totalTime >= 3600000 ? "hours" : "minutes"
              )?.displayTime || "";

            const itemStyle = {
              backgroundColor:
                formattedStartDate.includes("Invalid") ||
                formattedEndDate.includes("Invalid") ||
                statusLabel.includes("Invalid")
                  ? "lightcoral"
                  : "white",
            };

            const handlePress = () => {
              const currentTime = new Date().getTime();
              const delta = currentTime - lastPress;

              if (delta < DOUBLE_CLICK_DELTA) {
                // Double click threshold
                // Double click detected, navigate to add timesheet screen
                navigation.navigate("TimesheetDetail", {
                  timesheetId,
                  statusTemplateExtId,
                });
              }

              // Update last press timestamp and timesheet ID pressed
              setLastPress(currentTime);
            };

            return (
              <TouchableOpacity onPress={handlePress}>
                <View style={[styles.row, itemStyle]}>
                  <View style={styles.firstColumn}>
                    <Text
                      style={styles.firstColumnText}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {statusLabel}
                    </Text>
                  </View>
                  <View style={styles.secondColumn}>
                    <Text style={styles.secondColumnFirstRowText}>
                      {formattedStartDate}
                      {" - "}
                      {formattedEndDate}
                    </Text>
                    <Text
                      style={styles.secondColumnSecondRowText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {remark}
                    </Text>
                    {item && (
                      <View style={styles.showMoreButtonContainer}>
                        <TouchableOpacity
                          onPress={() => toggleItemExpansion(timesheetId)}
                        >
                          <Text style={styles.showMoreButtonText}>
                            {expandedItems[timesheetId]
                              ? t("show_less")
                              : t("show_more")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {expandedItems[timesheetId] && (
                      <>
                        {additionalData[timesheetId] ? (
                          <>
                            {/* Render additional data components here */}
                            <View style={styles.additionalDataContainer}>
                              <View style={styles.additionalDataItem}>
                                <View
                                  style={styles.additionalDataLabelContainer}
                                >
                                  <Text style={styles.additionalDataLabel}>
                                    {t("timesheet_work_time")}
                                  </Text>
                                </View>
                                <View
                                  style={styles.additionalDataValueContainer}
                                >
                                  <Text style={styles.additionalDataValue}>
                                    {additionalData[timesheetId]["totalTime"]}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.additionalDataItem}>
                                <View
                                  style={styles.additionalDataLabelContainer}
                                >
                                  <Text style={styles.additionalDataLabel}>
                                    {t("timesheet_billable_time")}
                                  </Text>
                                </View>
                                <View
                                  style={styles.additionalDataValueContainer}
                                >
                                  <Text style={styles.additionalDataValue}>
                                    {
                                      additionalData[timesheetId][
                                        "billableTime"
                                      ]
                                    }
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.additionalDataItem}>
                                <View
                                  style={styles.additionalDataLabelContainer}
                                >
                                  <Text style={styles.additionalDataLabel}>
                                    {t("timesheet_over_time")}
                                  </Text>
                                </View>
                                <View
                                  style={styles.additionalDataValueContainer}
                                >
                                  <Text style={styles.additionalDataValue}>
                                    {additionalData[timesheetId]["overTime"]}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </>
                        ) : (
                          // Loading indicator while fetching additional data
                          <Loader size={"small"} />
                        )}
                      </>
                    )}
                  </View>
                  <View style={styles.thirdColumn}>
                    <Text
                      style={[
                        styles.thirdColumnText,
                        {
                          color: totalTime === 0 ? "red" : "green",
                        },
                      ]}
                    >
                      {convertedTotalTime}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          } catch (error) {
            console.error("Error rendering item:", error);
            return (
              <Text style={{ color: "red" }}>
                {item?.["TimeConfirmation-id"]}
              </Text>
            );
          }
        }}
        onEndReached={handleLoadMoreData}
        onEndReachedThreshold={1}
        ListFooterComponent={() => {
          return isFetchingMore ? (
            <ActivityIndicator size="small" color="#0000ff" />
          ) : null;
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#0000ff"
            title={t("pull_to_refresh")}
            titleColor="#0000ff"
            colors={["#0000ff"]}
            onRefresh={onRefresh}
          />
        }
      />
      {/* Modal for date selection on creating timesheet*/}
      <Modal
        transparent={true}
        visible={isModalVisibleInCreate}
        onRequestClose={handleCloseModalInCreate}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.instructionTextInCreate}>
              {t("please_select_timesheet_create_date")}
            </Text>
            <CustomDateTimePicker
              placeholder={t("selected")}
              initialValue={selectedDateInCreate}
              onFilter={handleDateChangeInCreate}
              isTimePickerVisible={false}
              isDisabled={false}
              showClearButton={false}
            />
            {errorMessageInCreate && (
              <Text style={styles.errorMessageInCreate}>
                {errorMessageInCreate}
              </Text>
            )}
            {infoMessageInCreate && (
              <Text style={styles.infoMessageInCreate}>
                {infoMessageInCreate}
              </Text>
            )}
            {isLoadingInCreate && (
              <ActivityIndicator size="small" color="#0000ff" />
            )}
            <View style={styles.buttonContainerInCreate}>
              <Button
                title={t("confirm")}
                onPress={handleConfirmInCreate}
                disabled={isLoadingInCreate}
              />
              <Button title={t("cancel")} onPress={handleCloseModalInCreate} />
            </View>
          </View>
        </View>
      </Modal>
      {isSortModalVisible && (
        <Sort
          isModalVisible={isSortModalVisible}
          onClose={closeSortingModal}
          busObjCat={BUSOBJCATMAP[BUSOBJCAT.TIMESHEET]}
          allFields={[
            { propertyLabel: "Created On", propertyValue: "createdOn" },
            { propertyLabel: "Changed On", propertyValue: "changedOn" },
            { propertyLabel: "Start Date", propertyValue: "start" },
            { propertyLabel: "End Date", propertyValue: "end" },
            { propertyLabel: "Work Time", propertyValue: "totalTime" },
          ]}
          previousSortRows={sortConditions}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ccc",
    padding: 12,
  },
  firstColumn: {
    flex: 2,
  },
  firstColumnText: {
    color: "#2f4F4f",
  },
  secondColumn: {
    flex: 4,
    color: "#34495e",
  },
  secondColumnFirstRowText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  secondColumnSecondRowText: {
    paddingRight: 8,
  },
  thirdColumn: {
    flex: 1,
    alignItems: "flex-end",
  },
  thirdColumnText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  showMoreButtonContainer: {
    width: "50%",
  },
  showMoreButtonText: {
    color: "blue",
    fontSize: 16,
  },
  headerLeftContainer: {
    maxWidth: screenDimension.width / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headerRightContainer: {
    maxWidth: screenDimension.width / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    columnGap: 18,
  },
  headerIconsContainer: {
    position: "relative",
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
  additionalDataContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: "2%",
  },
  additionalDataItem: {
    width: "50%",
    height: "50%",
    justifyContent: "center",
    alignItems: "center",
  },
  additionalDataLabelContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  additionalDataValueContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  additionalDataLabel: {
    fontWeight: "bold",
  },
  additionalDataValue: {},
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#fff",
    padding: "4%",
    borderRadius: 5,
    alignItems: "center",
  },
  recordCountText: {
    fontSize: screenDimension.width > 400 ? 18 : 16,
    fontWeight: "bold",
    color: "#fff",
  },
  instructionTextInCreate: {
    fontSize: 16,
    color: "black",
    marginBottom: "8%",
    textAlign: "center",
  },
  buttonContainerInCreate: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: "8%",
  },
  errorMessageInCreate: {
    color: "#f00",
    marginVertical: "8%",
    fontSize: 16,
    textAlign: "center",
  },
  infoMessageInCreate: {
    color: "#00f",
    marginVertical: "8%",
    fontSize: 16,
    textAlign: "center",
  },
});

export default Timesheet;
