import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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

// Constants
import {
  APP,
  BUSOBJCAT,
  BUSOBJCATMAP,
  DOUBLE_CLICK_DELTA,
  PAGE_SIZE,
} from "../constants";

// Utility functions
import {
  booleanMap,
  fetchAbsenceTypes,
  formatLeaveDuration,
} from "../utils/AbsenceUtils";
import { fetchBusObjCatData, loadMoreData } from "../utils/APIUtils";
import { convertToFilterScreenFormat, filtersMap } from "../utils/FilterUtils";
import { convertToDateFNSFormat } from "../utils/FormatUtils";
import { showToast } from "../utils/MessageUtils";

// Custom components
import CustomButton from "../components/CustomButton";
import Loader from "../components/Loader";
import Sort from "../components/filters/Sort";
import CustomBackButton from "../components/CustomBackButton";

// Context
import { useAbsenceForceRefresh } from "../../context/ForceRefreshContext";
import { screenDimension } from "../utils/ScreenUtils";

/**
 * Absence component displays a list of absences with the ability to refresh
 * and load more data using pagination.
 *
 * @param {Object} route - The route object provided by React Navigation.
 * @param {Object} navigation - The navigation object provided by React Navigation.
 * @returns {JSX.Element} - Rendered component.
 */
const Absence = ({ route, navigation }) => {
  // Initialize useTranslation hook
  const { t } = useTranslation();

  // Destructure the forceRefresh variable and updateForceRefresh function from the useAbsenceForceRefresh hook,
  // which is accessing the AbsenceForceRefreshContext.
  const { forceRefresh, updateForceRefresh } = useAbsenceForceRefresh();

  // State variables
  const [refreshing, setRefreshing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState(null);
  const [absences, setAbsences] = useState([]);
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
  const [absenceTypeMap, setAbsenceTypeMap] = useState({});

  const openAbsenceDetail = () => {
    navigation.navigate("AbsenceDetail", {});
  };

  /**
   * Function to handle data refreshing.
   * This function is triggered when the user performs a pull-to-refresh action or when
   * the absence screen mounts for the first time. It fetches absence data from
   * the first page, resets the current page to 1, and updates the absences state
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
      // Fetch absence data for the first page
      const response = await fetchBusObjCatData(
        BUSOBJCAT.ABSENCE,
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
        // Update absences state with new data if response is not null
        setAbsences(response?.data || []);
        setTotalCount(response?.totalCount || 0);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      // Set refreshing state back to false after data refreshing is complete
      setRefreshing(false);
    }
  }, [setAbsences, whereConditions, orConditions, sortConditions, limit]);

  /**
   * Function to handle loading more data when the end of the list is reached.
   * This function is triggered to load additional data when the end of the list is reached during scrolling.
   * It calls a utility function to fetch more data and updates the list state accordingly.
   * @returns {void}
   */
  const handleLoadMoreData = useCallback(() => {
    // Check if the current data already contains all the items for the current page
    if (absences.length < page * limit) {
      showToast(t("no_more_data"), "warning");
      return;
    }

    // Proceed to load more data only if there are no errors
    if (!error) {
      // Call utility function to load more data
      loadMoreData(
        BUSOBJCAT.ABSENCE,
        page + 1, // Increment page for the next set of data
        limit,
        null,
        whereConditions,
        orConditions,
        sortConditions,
        setAbsences,
        setIsFetchingMore,
        setError
      ).finally(() => {
        setPage(page + 1); // Update page for the next load
      });
    }
  }, [
    page,
    limit,
    setAbsences,
    absences.length,
    setError,
    error,
    whereConditions,
    orConditions,
    sortConditions,
  ]);

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
   * Effect to ensure that the absence component's data is refreshed whenever changes occur in other parts of the application
   * that affect the absence list. These changes may include updates to absence details, deletions of absences, or any other relevant modifications.
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
   * Navigate to the filters screen with initial filter settings.
   */
  const navigateToFilters = () => {
    const initialFilters = convertToFilterScreenFormat(
      appliedFilters,
      filtersMap[BUSOBJCAT.ABSENCE],
      BUSOBJCAT.ABSENCE
    );

    const pickerOptions = {
      absenceTypeOptions: Object.entries(absenceTypeMap).map(
        ([key, value]) => ({
          label: value["AbsenceType-name"] || "Unknown",
          value: key,
        })
      ),
      booleanOptions: Object.entries(booleanMap).map(([key, value]) => ({
        label: value,
        value: key,
      })),
    };

    navigation.navigate("Filters", {
      busObjCatFilters: filtersMap[BUSOBJCAT.ABSENCE],
      busObjCat: BUSOBJCAT.ABSENCE,
      initialFilters: initialFilters,
      pickerOptions: pickerOptions,
    });
  };

  /**
   * useEffect hook to load initial data when the component mounts.
   *
   * This effect fetches absence type data asynchronously and updates the state.
   * If an error occurs during the fetch, it logs the error.
   */
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Fetch absence types
        const [absenceTypes] = await Promise.all([fetchAbsenceTypes()]);

        // Update state with the fetched absence types
        setAbsenceTypeMap(absenceTypes);
      } catch (error) {
        // Log any fetch errors
        console.error("Error loading absence type data:", error);
      }
    };

    // Load data on component mount
    loadInitialData();
  }, []);

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
   * Displays the count of absences and total count.
   */
  const headerLeft = useCallback(() => {
    // Calculate the current absences count
    let absenceCount = absences.length;

    return (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton navigation={navigation} t={t} />
        <Text
          style={styles.recordCountText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {/* Display absence count, pluralize as necessary, and show totalCount if available */}
          {`${t("absence")}${absenceCount !== 1 ? t("s") : ""}: ${
            absenceCount > 0 ? absenceCount : 0
          }${totalCount > 0 ? ` / ${totalCount}` : ""}`}
        </Text>
      </View>
    );
    // Dependencies: re-render only when absences or totalCount changes
  }, [absences, totalCount]);

  /**
   * Rendered component for the right side of the header.
   * Contains buttons for creating a absence, filtering, and sorting.
   */
  const headerRight = useCallback(() => {
    return (
      <View style={styles.headerRightContainer}>
        {/* Button for creating a new absence */}
        <CustomButton
          onPress={openAbsenceDetail}
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
          {/* Button for sorting absences */}
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
   * or when absences, totalCount, appliedFiltersCount, or sortConditions change.
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
    absences,
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
        data={absences}
        keyExtractor={(item) => item["Absence-id"]}
        // Render each absence item
        renderItem={({ item, index }) => {
          try {
            // Extracting and formatting data for each absence item
            const absenceId = item?.["Absence-id"];

            const startDate = new Date(item["Absence-start"]);
            const formattedStartDate = isValid(startDate)
              ? format(
                  startDate,
                  convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
                )
              : "Invalid start date";

            const endDate = new Date(item["Absence-end"]);
            const formattedEndDate = isValid(endDate)
              ? format(
                  endDate,
                  convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
                )
              : "Invalid end date";

            const statusTemplateExtId =
              item?.["Absence-extStatus-processTemplateID"] || "";

            const statusSteps =
              item?.[
                "Absence-extStatus-processTemplateID:ProcessTemplate-steps"
              ] || [];

            const statusExtId = item?.["Absence-extStatus-statusID"] || "";
            const matchingStep =
              statusExtId && statusSteps && statusSteps instanceof Array
                ? statusSteps.find((step) => step.extID === statusExtId)
                : null;
            const statusLabel = matchingStep ? matchingStep.statusLabel : "";
            const absenceType = item?.["Absence-type:AbsenceType-name"] || "";
            const remark = item?.["Absence-remark:text"] || "";
            const adjustAbsence = item["Absence-adjustAbsence"];
            const plannedDays = item["Absence-plannedDays"] || 0;
            const leaveDuration = formatLeaveDuration(
              plannedDays,
              item["Absence-type:AbsenceType-hourlyLeave"],
              item["Absence-type:AbsenceType-displayInHours"],
              adjustAbsence
            );

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
                // Double click detected, navigate to add absence screen
                navigation.navigate("AbsenceDetail", {
                  absenceId,
                  statusTemplateExtId,
                });
              }

              // Update last press timestamp and absence ID pressed
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
                    <Text
                      style={styles.secondColumnFirstRowText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {formattedStartDate}
                      {" - "}
                      {formattedEndDate}
                    </Text>
                    <Text
                      style={styles.secondColumnSecondRowText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {absenceType}
                    </Text>
                    {remark && (
                      <Text
                        style={styles.secondColumnThirdRowText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {remark}
                      </Text>
                    )}
                  </View>
                  <View style={styles.thirdColumn}>
                    <Text
                      style={[
                        styles.thirdColumnText,
                        {
                          color:
                            plannedDays === 0
                              ? "red"
                              : adjustAbsence
                              ? "darkorange"
                              : "green",
                        },
                      ]}
                    >
                      {leaveDuration}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          } catch (error) {
            console.error("Error rendering item:", error);
            return <Text style={{ color: "red" }}>{item?.["Absence-id"]}</Text>;
          }
        }}
        onEndReached={handleLoadMoreData}
        onEndReachedThreshold={0.1}
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
      {isSortModalVisible && (
        <Sort
          isModalVisible={isSortModalVisible}
          onClose={closeSortingModal}
          busObjCat={BUSOBJCATMAP[BUSOBJCAT.ABSENCE]}
          allFields={[
            { propertyLabel: "Created On", propertyValue: "createdOn" },
            { propertyLabel: "Changed On", propertyValue: "changedOn" },
            { propertyLabel: "Start Date", propertyValue: "start" },
            { propertyLabel: "End Date", propertyValue: "end" },
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
    color: "#6e2c00",
  },
  secondColumnThirdRowText: {},
  thirdColumn: {
    flex: 1,
    alignItems: "flex-end",
  },
  thirdColumnText: {
    fontSize: 16,
    fontWeight: "bold",
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
  recordCountText: {
    fontSize: screenDimension.width > 400 ? 18 : 16,
    fontWeight: "bold",
    color: "#fff",
  },
});

export default Absence;
