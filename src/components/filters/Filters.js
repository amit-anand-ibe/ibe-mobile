import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  KeyboardAvoidingView,
  Platform,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { BUSOBJCATMAP } from "../../constants";
import DateFilter from "./DateFilter";
import DurationFilter from "./DurationFilter";
import PickerFilter from "./PickerFilter";
import StatusFilter from "./StatusFilter";
import TextFilter from "./TextFilter";

import {
  convertFiltersToOrConditions,
  convertFiltersToWhereConditions,
  convertToBusObjCatFormat,
  filtersMap,
  handleDateFilter,
  handleDurationFilter,
  handlePickerFilter,
  handleStatusFilter,
  handleTextFilter,
  validateAppliedFilters,
} from "../../utils/FilterUtils";
import { showToast } from "../../utils/MessageUtils";
import { screenDimension } from "../../utils/ScreenUtils";

import CustomBackButton from "../CustomBackButton";
import CustomButton from "../CustomButton";
import ScreenHeader from "../ScreenHeader";

const Filters = ({ route, navigation }) => {
  const {
    busObjCatFilters,
    busObjCat,
    initialFilters,
    pickerOptions = {},
  } = route.params;

  // Initialize useTranslation hook
  const { t } = useTranslation();

  const [appliedFilters, setAppliedFilters] = useState(initialFilters || {});
  const [appliedFiltersCount, setAppliedFiltersCount] = useState(0);
  const [clearFilterValue, setClearFilterValue] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState({});

  const applyFilters = useCallback(() => {
    setUnsavedChanges({});

    const validationResult = validateAppliedFilters(
      appliedFilters,
      filtersMap[busObjCat],
      t
    );

    if (validationResult?.isValid === false) {
      showToast(validationResult.message, "error");
      return;
    }

    const convertedAppliedFilters = convertToBusObjCatFormat(
      appliedFilters,
      filtersMap[busObjCat],
      busObjCat
    );

    const whereConditions = convertFiltersToWhereConditions(
      convertedAppliedFilters,
      filtersMap[busObjCat],
      busObjCat
    );

    const orConditions = convertFiltersToOrConditions(
      convertedAppliedFilters,
      filtersMap[busObjCat],
      busObjCat
    );

    console.log(
      `On click of "Apply" in filters screen the list of filters going to be applied in ${busObjCat} is ${JSON.stringify(
        convertedAppliedFilters,
        null,
        2
      )}. The applied filters is ${JSON.stringify(appliedFilters)}.
      The converted applied filters is ${JSON.stringify(
        convertedAppliedFilters,
        null,
        2
      )}. The list of where conditions is ${JSON.stringify(
        whereConditions,
        null,
        2
      )}. The list of or conditions is ${JSON.stringify(
        orConditions,
        null,
        2
      )}. Also, the object maintaining unsaved changes (if any) is ${JSON.stringify(
        unsavedChanges,
        null,
        2
      )}`
    );

    navigation.navigate(busObjCat, {
      whereConditions,
      orConditions,
      convertedAppliedFilters,
      appliedFiltersCount,
    });
  }, [appliedFilters]);

  const resetFilters = useCallback(() => {
    setAppliedFilters({});
    setUnsavedChanges({});
    setClearFilterValue(true);

    console.log(
      `On click of "Reset" in filters screen the list of filters going to be applied in ${busObjCat} is ${JSON.stringify(
        appliedFilters
      )} and the object maintaining unsaved changes (if any) is ${JSON.stringify(
        unsavedChanges
      )}`
    );

    // By adding this delay, we ensure that any pending state updates are processed before initiating
    // the navigation, ensuring a smooth user experience.
    setTimeout(() => {
      navigation.navigate(busObjCat, []);
    }, 500);
  }, []);

  const renderFilter = (filter) => {
    // Translate the filter label using t()
    const translatedLabel = t(filter.label);

    switch (filter.type) {
      case "text":
        return (
          <TextFilter
            key={filter.id}
            label={translatedLabel}
            initialValue={appliedFilters[filter.id]} // Pass initial value to pre-populate the filter
            onFilter={(value) =>
              handleTextFilter(
                filter.id,
                value,
                initialFilters,
                appliedFilters,
                setAppliedFilters,
                setUnsavedChanges
              )
            }
            clearValue={clearFilterValue}
          />
        );
      case "duration":
        return (
          <DurationFilter
            key={filter.id}
            label={translatedLabel}
            initialValue={appliedFilters[filter.id]} // Pass initial value to pre-populate the filter
            onFilter={({ greaterThanValue, lessThanValue, unit }) =>
              handleDurationFilter(
                filter.id,
                { greaterThanValue, lessThanValue, unit },
                initialFilters,
                appliedFilters,
                setAppliedFilters,
                setUnsavedChanges
              )
            }
            clearValue={clearFilterValue}
            units={filter.units}
            convertToMillisecondsEnabled={filter.convertToMillisecondsEnabled}
          />
        );
      case "date":
        return (
          <DateFilter
            key={filter.id}
            label={translatedLabel}
            initialValue={appliedFilters[filter.id]} // Pass initial value to pre-populate the filter
            onFilter={({ greaterThanDate, lessThanDate }) =>
              handleDateFilter(
                filter.id,
                { greaterThanDate, lessThanDate },
                initialFilters,
                appliedFilters,
                setAppliedFilters,
                setUnsavedChanges
              )
            }
            clearValue={clearFilterValue}
            initlalMode={filter.initialMode}
            isTimePickerVisible={filter.isTimePickerVisible}
          />
        );
      case "status":
        return (
          <StatusFilter
            key={filter.id}
            label={translatedLabel}
            initialValue={appliedFilters[filter.id]} // Pass initial value to pre-populate the filter
            onFilter={(value) =>
              handleStatusFilter(
                filter.id,
                value,
                initialFilters,
                appliedFilters,
                setAppliedFilters,
                setUnsavedChanges
              )
            }
            clearValue={clearFilterValue}
            busObjCat={BUSOBJCATMAP[busObjCat]}
          />
        );
      case "picker": {
        // Get the corresponding picker options based on the filter's option field
        const optionsForPicker = pickerOptions[filter.option] || [];

        return (
          <PickerFilter
            key={filter.id}
            label={translatedLabel}
            initialValue={appliedFilters[filter.id]} // Pass initial value to pre-populate the filter
            onFilter={(value) =>
              handlePickerFilter(
                filter.id,
                value,
                initialFilters,
                appliedFilters,
                setAppliedFilters,
                setUnsavedChanges
              )
            }
            clearValue={clearFilterValue}
            pickerOptions={optionsForPicker}
          />
        );
      }
      default:
        return null;
    }
  };

  /**
   * Determines if there are any unsaved changes by checking if any value in the `unsavedChanges` object is `true`.
   *
   * @param {Object} unsavedChanges - An object representing the unsaved changes for various fields. Each key corresponds to a field, and the value is a boolean indicating if the change is unsaved.
   *
   * The useMemo hook memoizes the result to prevent recalculating unless `unsavedChanges` changes, optimizing performance by avoiding unnecessary checks.
   *
   * @returns {boolean} - Returns `true` if any field has unsaved changes, otherwise `false`.
   */
  const hasUnsavedChanges = useMemo(() => {
    console.log(
      `Before navigating from filters screen to ${busObjCat} screen, object maintaining unsaved changes (if any)
       is ${JSON.stringify(unsavedChanges)}`
    );

    return Object.values(unsavedChanges).some((change) => change === true);
  }, [unsavedChanges]);

  /**
   * Renders the left section of the header, which includes a custom back button
   * and a text label displaying the count of applied filters.
   *
   * This component is memoized using `useCallback` to optimize performance
   * by preventing unnecessary re-renders unless the dependencies change.
   *
   * Dependencies:
   * - `hasUnsavedChanges`: A boolean indicating if there are unsaved changes.
   * - `appliedFiltersCount`: The current count of applied filters to display.
   *
   * @returns {JSX.Element} A View containing the CustomBackButton and a Text element
   *                        displaying the count of applied filters.
   */
  const headerLeft = useCallback(() => {
    return (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton
          navigation={navigation}
          hasUnsavedChanges={hasUnsavedChanges}
          t={t}
        />
        <Text
          style={styles.headerLeftText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {`${t("filters")} (${appliedFiltersCount})`}
        </Text>
      </View>
    );
  }, [hasUnsavedChanges, appliedFiltersCount]);

  /**
   * The `headerRight` component is used to display two buttons (Apply and Reset) in the header.
   * These buttons allow the user to either apply or reset filter changes.
   * Both buttons are dynamically enabled or disabled based on whether there are unsaved changes (`hasUnsavedChanges`).
   * The `useCallback` hook ensures that this component only re-renders when `hasUnsavedChanges` changes.
   */

  const headerRight = useCallback(() => {
    return (
      <View style={styles.headerRightContainer}>
        <CustomButton
          onPress={applyFilters}
          label={t("apply")}
          icon={{
            name: "check",
            library: "FontAwesome",
            size: 24,
            color: "white",
          }}
          disabled={!hasUnsavedChanges}
          backgroundColor={false}
          style={{ icon: { marginRight: 0 } }}
          labelStyle={styles.buttonLabelWhite}
          accessibilityLabel={t("apply")}
          accessibilityRole="button"
          testID="apply-filters-button"
        />
        <CustomButton
          onPress={resetFilters}
          label={t("reset")}
          icon={{
            name: "times",
            library: "FontAwesome",
            size: 24,
            color: "white",
          }}
          disabled={appliedFiltersCount === 0}
          backgroundColor={false}
          style={{ icon: { marginRight: 0 } }}
          labelStyle={styles.buttonLabelWhite}
          accessibilityLabel={t("reset")}
          accessibilityRole="button"
          testID="reset-filters-button"
        />
      </View>
    );
  }, [hasUnsavedChanges, appliedFiltersCount, appliedFilters]);

  /**
   * Update the count of applied filters whenever the `appliedFilters` state changes.
   * This effect recalculates the number of applied filters and updates the `appliedFiltersCount` state.
   *
   * It also updates the header options to reflect the new count of applied filters.
   * The header title is set to display the count of applied filters.
   *
   * Dependencies:
   * - `appliedFilters`: The state containing the currently applied filters.
   * - `headerLeft`: The component rendering the left section of the header, which displays the filter count.
   * - `headerRight`: The component rendering the right section of the header with action buttons.
   */
  useEffect(() => {
    // Update the count of applied filters
    const appliedFiltersCount = Object.keys(appliedFilters).length;
    setAppliedFiltersCount(appliedFiltersCount);

    // Update the header title
    navigation.setOptions({
      headerTitle: "",
      headerLeft: headerLeft,
      headerRight: headerRight,
    });
  }, [appliedFilters, headerLeft, headerRight]);

  /**
   * Reset the clear filter values after clearing filters.
   *
   * This effect resets the clear filter values after the filters have been cleared.
   * It sets the clearFilterValue state to false when clearFilterValue is true, indicating that the filters have been cleared.
   */
  useEffect(() => {
    if (clearFilterValue) {
      setClearFilterValue(false);
    }
  }, [clearFilterValue]);

  return (
    <View style={styles.screen}>
      <ScreenHeader left={headerLeft()} right={headerRight()} />
      <SafeAreaView style={styles.container} edges={["right", "bottom", "left"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={20}
        >
          <ScrollView>
            <View style={styles.filterContainer}>
              {busObjCatFilters.map((filter) => renderFilter(filter))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  },
  filterContainer: {
    flex: 1,
    justifyContent: "center",
    alignContent: "space-around",
    padding: "5%",
  },
  headerLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headerRightContainer: {
    width: screenDimension.width / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    columnGap: 10,
  },
  headerLeftText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  buttonLabelWhite: {
    color: "white",
  },
});

export default Filters;
