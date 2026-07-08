import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { format, isValid } from "date-fns";

import { Ionicons } from "@expo/vector-icons";

import { fetchBusObjCatData, loadMoreData } from "../utils/APIUtils";

import CustomButton from "../components/CustomButton";
import Sort from "../components/filters/Sort";
import ScreenHeader from "../components/ScreenHeader";

import { screenDimension } from "../utils/ScreenUtils";

import {
  convertAmountToDisplayFormat,
  convertToDateFNSFormat,
} from "../utils/FormatUtils";
import { showToast } from "../utils/MessageUtils";
import { convertToFilterScreenFormat, filtersMap } from "../utils/FilterUtils";

import { APP, BUSOBJCAT, BUSOBJCATMAP, PAGE_SIZE } from "../constants";

import Loader from "../components/Loader";
import CustomBackButton from "../components/CustomBackButton";

/**
 * Expense component displays a list of expenses with the ability to refresh
 * and load more data using pagination.
 *
 * @param {Object} route - The route object provided by React Navigation.
 * @param {Object} navigation - The navigation object provided by React Navigation.
 * @returns {JSX.Element} - Rendered component.
 */
const Expense = ({ route, navigation }) => {
  // Initialize useTranslation hook
  const { t } = useTranslation();
  const hasUserScrolledRef = useRef(false);

  // State variables
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [whereConditions, setWhereConditions] = useState([]);
  const [orConditions, setOrConditions] = useState([]);
  const [sortConditions, setSortConditions] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [appliedFiltersCount, setAppliedFiltersCount] = useState(0);
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);

  /**
   * Function to handle data refreshing.
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    setPage(1);

    try {
      // Fetch Expense data
      const response = await fetchBusObjCatData(
        BUSOBJCAT.EXPENSE,
        page,
        limit,
        null,
        whereConditions,
        orConditions,
        sortConditions
      );
      if (!response.error) {
        // Update expenses state with new data
        setExpenses(response.data || []);
        setTotalCount(response?.totalCount || 0);
      } else {
        console.error("Error refreshing data:", response.error);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [setExpenses, whereConditions, orConditions, sortConditions, limit]);

  /**
   * Function to handle loading more data.
   */
  const handleLoadMoreData = useCallback(() => {
    if (!hasUserScrolledRef.current || refreshing) {
      return;
    }

    if (expenses.length < page * limit) {
      showToast(t("no_more_data"), "warning");
      return;
    }

    if (!error) {
      // Call utility function to load more data
      loadMoreData(
        BUSOBJCAT.EXPENSE,
        page + 1, // Increment page for the next set of data
        limit,
        null,
        whereConditions,
        orConditions,
        sortConditions,
        setExpenses,
        setIsLoading,
        setError
      ).finally(() => {
        // Update the page for the next load
        setPage(page + 1);
      });
    }
  }, [
    page,
    limit,
    setExpenses,
    expenses.length,
    whereConditions,
    orConditions,
    sortConditions,
    setError,
    error,
  ]);

  useEffect(() => {
    setPage(1);
    // Trigger refresh when the component mounts
    onRefresh();
  }, [whereConditions, orConditions, sortConditions]);

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

  const navigateToFilters = () => {
    const initialFilters = convertToFilterScreenFormat(
      appliedFilters,
      filtersMap[BUSOBJCAT.EXPENSE],
      BUSOBJCAT.EXPENSE
    );

    navigation.navigate("Filters", {
      busObjCatFilters: filtersMap[BUSOBJCAT.EXPENSE],
      busObjCat: BUSOBJCAT.EXPENSE,
      initialFilters: initialFilters,
    });
  };

  const createNewExpense = () => {
    navigation.navigate("ExpenseDetail");
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
   */
  const headerLeft = useCallback(() => {
    // Calculate the current expense count
    let recordCount = expenses.length;

    return (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton navigation={navigation} t={t} />
        <Text
          style={styles.recordCountText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {/* Display expense count, pluralize as necessary, and show totalCount if available */}
          {`Expense${recordCount > 0 ? "s" : ""}: ${
            recordCount > 0 ? recordCount : ""
          }${totalCount > 0 ? ` / ${totalCount}` : "No records"}`}
        </Text>
      </View>
    );
    //  Re-render only when expenses or totalCount changes
  }, [expenses, totalCount]);

  /**
   * Rendered component for the right side of the header.
   */
  const headerRight = useCallback(() => {
    return (
      <View style={styles.headerRightContainer}>
        {/* Button for creating a new expense entry */}
        <CustomButton
          onPress={createNewExpense}
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
          <TouchableOpacity onPress={navigateToFilters}>
            <Ionicons name="filter" size={30} color="white" />
          </TouchableOpacity>
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
          {/* Button for sorting expenses */}
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
  }, [appliedFiltersCount, sortConditions, refreshing]);

  // Set header options with custom components
  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft: headerLeft,
      headerRight: headerRight,
    });
  }, [
    headerLeft,
    headerRight,
    expenses,
    totalCount,
    appliedFiltersCount,
    sortConditions,
  ]);

  return (
    <View style={styles.screen}>
      <ScreenHeader left={headerLeft()} right={headerRight()} />
      <SafeAreaView
        style={styles.container}
        edges={["right", "bottom", "left"]}
      >
        <FlatList
        data={expenses}
        keyExtractor={(item) => item["ExpenseClaim-id"]}
        renderItem={({ item }) => {
          try {
            // Extracting and formatting data for each expense item

            const expenseId = item?.["ExpenseClaim-id"];
            const expenseDate = new Date(item["ExpenseClaim-date"]);
            const formattedExpenseDate = isValid(expenseDate)
              ? format(
                  expenseDate,
                  convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)
                )
              : "Invalid claim date";

            const statusTemplateExtId =
              item?.["ExpenseClaim-extStatus-processTemplateID"] || "";

            const statusSteps =
              item?.[
                "ExpenseClaim-extStatus-processTemplateID:ProcessTemplate-steps"
              ] || [];

            const statusExtId = item?.["ExpenseClaim-extStatus-statusID"] || "";

            const matchingStep =
              statusExtId && statusSteps && statusSteps instanceof Array
                ? statusSteps.find((step) => step.extID === statusExtId)
                : null;

            const statusLabel = matchingStep ? matchingStep.statusLabel : "";

            const remark = item?.["ExpenseClaim-remark:text"] || "";

            const extID = item?.["ExpenseClaim-extID"] || "";

            const amountBUObj = item?.["ExpenseClaim-amountBU"] ?? {
              amount: 0,
              currency: null,
            };
            const convertedAmount =
              convertAmountToDisplayFormat(amountBUObj) || 0;

            const itemStyle = {
              backgroundColor:
                formattedExpenseDate.includes("Invalid") ||
                statusLabel.includes("Invalid")
                  ? "lightcoral"
                  : "white",
            };

            const handlePress = () => {
              navigation.navigate("ExpenseDetail", {
                expenseId,
                statusTemplateExtId,
              });
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
                      {formattedExpenseDate}
                    </Text>
                    <Text style={styles.secondColumnFirstRowText}>{extID}</Text>
                    <Text
                      style={styles.secondColumnSecondRowText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {remark}
                    </Text>
                  </View>
                  <View style={styles.thirdColumn}>
                    <Text
                      style={[
                        styles.thirdColumnText,
                        {
                          color: amountBUObj.amount === 0 ? "red" : "green",
                        },
                      ]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {convertedAmount}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          } catch (error) {
            console.error("Error rendering item:", error);
            return (
              <Text style={{ color: "red" }}>{item?.["ExpenseClaim-id"]}</Text>
            );
          }
        }}
        onScrollBeginDrag={() => {
          hasUserScrolledRef.current = true;
        }}
        onEndReached={handleLoadMoreData}
        onEndReachedThreshold={0.1}
        contentContainerStyle={styles.listContainer}
        refreshing={isLoading}
        ListFooterComponent={() => {
          return isLoading ? <Loader /> : null;
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
        {isSortModalVisible && (
          <Sort
            isModalVisible={isSortModalVisible}
            onClose={closeSortingModal}
            busObjCat={BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}
            allFields={[
              { propertyLabel: "Claim ID", propertyValue: "extID" },
              { propertyLabel: "Amount", propertyValue: "amountBU" },
              { propertyLabel: "Date", propertyValue: "date" },
            ]}
            previousSortRows={sortConditions}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  recordCountText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  container: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ccc",
    padding: 12,
  },
  firstColumn: {
    flex: 1,
  },
  firstColumnText: {},
  secondColumn: {
    flex: 2,
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
    columnGap: 6,
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
});

export default Expense;
