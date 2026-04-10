import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Button,
  Modal,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomPicker from "../CustomPicker";
import CustomButton from "../CustomButton";
import {
  GestureHandlerRootView,
  ScrollView,
} from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

/**
 * Sort component that allows users to define sorting criteria with multiple rows.
 *
 * @param {boolean} isModalVisible - Determines if the modal is visible.
 * @param {function} onClose - Callback function called with the sorting options when the modal is closed.
 * @param {string} [busObjCat=""] - Business object category used to prefix the property name.
 * @param {Array} allFields - Array of available fields for sorting, each containing `label` and `value`.
 * @param {Array} [previousSortRows=[]] - Previously applied sorting conditions to initialize the component with.
 */
const Sort = ({
  isModalVisible,
  onClose,
  busObjCat = "",
  allFields = [],
  previousSortRows = [], // Added prop for previous sort conditions
}) => {
  const { t } = useTranslation(); // Hook for internationalization

  // State to manage sorting rows
  const [sortRows, setSortRows] = useState([]);
  const [errorMessage, setErrorMessage] = useState(""); // State for error message

  useEffect(() => {
    // Initialize state with previous sort conditions if provided
    if (previousSortRows.length) {
      setSortRows(
        previousSortRows.map((row) => ({
          field: row.property.replace(`${busObjCat}-`, ""),
          order: row.direction,
        }))
      );
    } else {
      setSortRows([{ field: null, order: null }]);
    }
  }, [previousSortRows]);

  // Options for sorting order
  const sortOrders = [
    { label: `↑ ${t("ascending")}`, value: "ASC" },
    { label: `↓ ${t("descending")}`, value: "DESC" },
  ];

  /**
   * Handles the confirmation of sorting options.
   * Filters out rows with null field or order values and formats them.
   */
  const handleConfirm = () => {
    // Check for rows with null field or order
    const incompleteRows = sortRows.filter((row) => !row.field || !row.order);
    if (incompleteRows.length > 0) {
      setErrorMessage(t("please_complete_all_sorting_rows"));
      return;
    }

    // Create the sorted array in the required format
    const sortedArray = sortRows.map((row) => ({
      property: `${busObjCat}-${row.field}`, // Prefix field with category
      direction: row.order,
    }));

    console.log("Sort confirmed:", JSON.stringify(sortedArray));
    onClose(sortedArray);
  };

  /**
   * Handles the cancellation of sorting options.
   */
  const handleCancel = () => {
    onClose();
  };

  /**
   * Adds a new row for sorting.
   */
  const addSortingCriteria = () => {
    setSortRows([...sortRows, { field: null, order: null }]);
  };

  /**
   * Removes a row at the specified index.
   *
   * @param {number} index - Index of the row to be removed.
   */
  const removeRow = (index) => {
    setSortRows(sortRows.filter((_, i) => i !== index));
    setErrorMessage(""); // Clear error message on row delete
  };

  /**
   * Updates the value of a specific field or order in a row.
   *
   * @param {number} index - Index of the row to be updated.
   * @param {string} type - The type of update (`field` or `order`).
   * @param {string} value - The new value to be set.
   */
  const updateRow = (index, type, value) => {
    const newRows = [...sortRows];
    newRows[index][type] = value;
    setSortRows(newRows);
    setErrorMessage(""); // Clear error message on row update
  };

  /**
   * Returns the available fields for a given row index,
   * excluding fields already selected in other rows.
   *
   * @param {number} index - Index of the row for which to get available fields.
   * @returns {Array} Filtered array of available fields.
   */
  const getAvailableFields = (index) => {
    // Collect fields selected in other rows
    const selectedFields = sortRows
      .filter((_, i) => i !== index) // Exclude the current row
      .map((row) => row.field)
      .filter(Boolean); // Remove any null or undefined fields

    // Filter out selected fields from allFields
    return allFields.filter(
      (field) =>
        !selectedFields.includes(field.propertyValue) ||
        field.propertyValue === sortRows[index].field
    );
  };

  return (
    <Modal
      transparent={true}
      visible={isModalVisible}
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.modalContainer}>
        <Text style={styles.modalTitle} numberOfLines={1} ellipsizeMode="tail">
          {t("select_sort_options")}
        </Text>
        <GestureHandlerRootView>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {sortRows.map((row, index) => (
              <View key={index} style={styles.rowContainer}>
                <CustomPicker
                  placeholder={`${t("select_field")}...`}
                  items={getAvailableFields(index).map((field) => ({
                    label: field.propertyLabel,
                    value: field.propertyValue,
                  }))}
                  initialValue={row.field}
                  onFilter={(value) => updateRow(index, "field", value)}
                  containerStyle={{ flex: 3 }}
                  disabled={false}
                  hideSearchInput={true}
                />

                <CustomPicker
                  placeholder={`${t("select_order")}...`}
                  items={sortOrders}
                  initialValue={row.order}
                  onFilter={(value) => updateRow(index, "order", value)}
                  containerStyle={{ flex: 2, marginLeft: 10 }}
                  disabled={false}
                  hideSearchInput={true}
                />
                <CustomButton
                  onPress={() => removeRow(index)}
                  label=""
                  icon={{
                    name: "remove-circle-sharp",
                    library: "Ionicons",
                    size: 30,
                    color: "red",
                  }}
                  style={{ paddingRight: 0, paddingTop: 0 }}
                />
              </View>
            ))}
            <CustomButton
              onPress={addSortingCriteria}
              label={t("add_sorting_criterion")}
              icon={{
                name: "add-circle-sharp",
                library: "Ionicons",
                size: 30,
                color: "#00f",
              }}
              backgroundColor={false}
              labelStyle={{
                color: "#00f",
              }}
              style={{ icon: { marginRight: 2 } }}
            />
            {errorMessage && (
              <Text style={styles.errorText}>{errorMessage}</Text>
            )}
          </ScrollView>
          <View style={styles.modalButtonsContainer}>
            <Button title={t("apply")} onPress={handleConfirm} />
            <Button title={t("close")} onPress={handleCancel} />
          </View>
        </GestureHandlerRootView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    padding: "4%",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: "4%",
    borderRadius: 8,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 20,
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginTop: 10,
  },
});

export default Sort;
