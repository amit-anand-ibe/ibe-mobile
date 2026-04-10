import React, { useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  View,
  Button,
  FlatList,
  TouchableOpacity,
  Platform,
  Text,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { isEqual } from "../utils/FormatUtils";
import CustomTextInput from "./CustomTextInput";

/**
 * CustomPicker component provides a customizable picker component for React Native.
 * @param {Object} props - Component props.
 * @param {string} props.placeholder - Placeholder text for the picker.
 * @param {Array} props.items - Array of objects representing picker items. Should be of the form { label: string, value: string }.
 * @param {string} props.initialValue - Initial value for the picker.
 * @param {Function} props.onFilter - Callback function triggered when the picker value changes.
 * @param {boolean} props.clearValue - Boolean indicating whether to clear the value.
 * @param {boolean} props.disabled - Boolean indicating whether the picker is disabled.
 * @param {boolean} props.hideSearchInput - Boolean indicating whether to hide the search input.
 * @param {Object} props.containerStyle - Custom style for the container of the picker and search input.
 * @param {Object} props.pickerStyle - Custom style for the Picker component.
 * @param {Object} props.inputStyle - Custom style for the TextInput component.
 * @param {boolean} props.useModalInIOS - Boolean indicating whether to use the modal picker on iOS.
 * @param {string} [props.accessibilityLabel] - Optional accessibility label for the picker for screen readers.
 * @param {string} [props.accessibilityRole] - Optional accessibility role for the picker, which helps define its purpose to assistive technologies.
 * @param {string} [props.testID] - Optional test identifier for targeting the picker in tests.
 * @returns {JSX.Element} CustomPicker component JSX.
 */
const CustomPicker = ({
  placeholder,
  items = [],
  initialValue,
  onFilter,
  clearValue = false,
  disabled = false,
  hideSearchInput = false,
  containerStyle = {},
  pickerStyle = {},
  inputStyle = {},
  useModalInIOS = true,
  accessibilityLabel,
  accessibilityRole,
  testID,
}) => {
  // Initialize useTranslation hook
  const { t } = useTranslation();

  if (!placeholder) {
    placeholder = `${t("select")}...`;
  }

  // State to manage the selected label
  const [selectedValue, setSelectedValue] = useState(initialValue || null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState(items);
  const [isModalVisible, setModalVisible] = useState(false);

  /**
   * Function to handle value change in the picker.
   * @param {string|number} itemValue - Selected value from the picker.
   * @param {number} itemIndex - Index of the selected item.
   */
  const handleValueChange = (itemValue, itemIndex) => {
    setSelectedValue(itemValue);

    // Call onFilter with the selected value
    if (onFilter) {
      onFilter(itemValue);
    }

    if (Platform.OS === "ios") {
      toggleModal();
    }
  };

  // Reset selectedValue when clearValue changes
  useEffect(() => {
    if (clearValue) {
      setSelectedValue(null);
    }
  }, [clearValue]);

  useEffect(() => {
    // If searchTerm is empty, reset filteredItems to the original items
    if (searchTerm.trim() === "") {
      // Sort items alphabetically by label when there is no search term
      setFilteredItems(
        [...items].sort((a, b) => a.label.localeCompare(b.label))
      );
    } else {
      // Sort filtered items when searching
      const filtered = items
        ?.filter((item) =>
          item.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => a.label.localeCompare(b.label));

      setFilteredItems(filtered);
    }
  }, [searchTerm, items]);

  useEffect(() => {
    console.log(
      "Initial value in custom picker: ",
      JSON.stringify(initialValue)
    );

    let selectedItem = null;

    if (initialValue && items && items.length > 0) {
      // Find the item in the items array that matches the initial value
      selectedItem = items.find((item) => {
        // Compare values based on their types
        if (typeof item.value === typeof initialValue) {
          // If both values are arrays, compare them element-wise
          if (Array.isArray(item.value) && Array.isArray(initialValue)) {
            // Ensure both arrays have the same length
            if (item.value.length === initialValue.length) {
              // Check if every element in the arrays is equal
              return item.value.every((val, index) =>
                isEqual(val, initialValue[index])
              );
            }
          } else {
            // Otherwise, compare them directly
            return item.value === initialValue;
          }
        }
        // Return false if types are different
        return false;
      });
    }

    // If a matching item is found, set it as the selected value
    setSelectedValue(selectedItem ? selectedItem.value : initialValue);
  }, [initialValue, items]);

  const toggleModal = () => {
    setModalVisible(!isModalVisible);
  };

  return (
    <View
      style={[styles.container, containerStyle]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      testID={testID}
    >
      {/* Picker component */}
      {Platform.OS === "ios" && useModalInIOS ? (
        <>
          <TouchableOpacity
            onPress={toggleModal}
            style={[styles.iOSPicker, pickerStyle]}
            disabled={disabled}
          >
            <View style={styles.iOSInput}>
              <Text>
                {selectedValue
                  ? items.find((item) => isEqual(item.value, selectedValue))
                      ?.label || placeholder
                  : placeholder}
              </Text>
            </View>
          </TouchableOpacity>

          <Modal
            visible={isModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={toggleModal}
          >
            <SafeAreaView style={styles.modalContainer}>
              <FlatList
                data={[{ label: placeholder, value: null }, ...filteredItems]}
                keyExtractor={(item, index) => `${item.value}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.itemContainer}
                    onPress={() => handleValueChange(item.value)}
                  >
                    <Text style={styles.itemText}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
              <Button title={t("close")} onPress={toggleModal} />
            </SafeAreaView>
          </Modal>
        </>
      ) : (
        <View style={[styles.androidPicker, pickerStyle]}>
          <Picker
            style={{ height: 50 }}
            selectedValue={selectedValue}
            onValueChange={handleValueChange}
            enabled={!disabled}
          >
            {/* Render default/placeholder option */}
            <Picker.Item label={placeholder} value={null} />

            {/* Render filtered picker items */}
            {filteredItems?.map((item, index) => (
              <Picker.Item key={index} label={item.label} value={item.value} />
            ))}
          </Picker>
        </View>
      )}
      {/* Search input */}
      {!hideSearchInput && (
        <CustomTextInput
          containerStyle={[styles.androidInput, inputStyle]}
          placeholder={`${t("placeholder_type_to_search")}...`}
          placeholderTextColor={"gray"}
          value={searchTerm}
          onChangeText={setSearchTerm}
          editable={!disabled}
        />
      )}
    </View>
  );
};

// Styles for the component
const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "black",
    marginBottom: "4%",
  },
  androidPicker: {
    width: "100%",
  },
  iOSPicker: {
    width: "100%",
    justifyContent: "center",
    flex: 1,
  },
  androidInput: {
    borderWidth: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  iOSInput: {
    padding: "5%",
    borderWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  itemContainer: {
    padding: "4%",
    borderBottomColor: "#ccc",
    borderBottomWidth: 0.5,
  },
  itemText: {
    fontSize: 16,
    color: "#000",
  },
});

export default CustomPicker;
