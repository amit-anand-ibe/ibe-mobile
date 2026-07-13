import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { fetchData } from "../utils/APIUtils";
import { API_ENDPOINTS } from "../constants";
import CustomTextInput from "./CustomTextInput";
import CustomButton from "./CustomButton";

/**
 * CustomRemotePicker Component
 *
 * This component allows users to search and select items from a remote source.
 *
 * Props:
 * @param {Object} queryParams - Parameters for the search query.
 * @param {string} pickerLabel - Label for the picker input.
 * @param {string} initialAdditionalLabel - Initial additional label to display.
 * @param {string} initialItemLabel - Initial label of the selected item.
 * @param {string} initialItemValue - Initial value of the selected item.
 * @param {string} labelItemField - The field name for the label in the search results.
 * @param {string} valueItemField - The field name for the value in the search results.
 * @param {Array} additionalFields - Additional fields to extract from the search results.
 * @param {Array} searchFields - Fields to search against.
 * @param {boolean} serverSearchEnabled - If false, only dropdown paging is used.
 * @param {boolean} multiline - If true, allows multiple lines of input.
 * @param {Function} onValueChange - Callback function when a value is selected or changed.
 * @param {boolean} disabled - If true, disables the entire component.
 * @param {Array} clearSearchData - Clears the existing search data.
 */

const CustomRemotePicker = ({
  queryParams,
  pickerLabel = "",
  initialAdditionalLabel = "",
  initialItemLabel = "",
  initialItemValue = "",
  labelItemField,
  valueItemField,
  additionalFields = [],
  searchFields = [],
  serverSearchEnabled = true,
  multiline = false,
  onValueChange,
  disabled = false,
  clearSearchData = false,
}) => {
  const { t } = useTranslation();

  // State variables
  const [searchDataLoading, setSearchDataLoading] = useState(false);
  const [searchData, setSearchData] = useState([]);
  const [searchQuery, setSearchQuery] = useState(initialItemLabel.trim());
  const [selectedLabel, setSelectedLabel] = useState(initialItemLabel.trim());
  const [selectedAdditionalLabel, setSelectedAdditionalLabel] = useState(
    initialAdditionalLabel
  );
  const [selectedValue, setSelectedValue] = useState(initialItemValue);
  const [noResults, setNoResults] = useState(false);
  const [isSearchButtonHidden, setIsSearchButtonHidden] = useState(true);
  const [searchPage, setSearchPage] = useState(1);
  const [searchLimit, setSearchLimit] = useState(5);
  const [searchDataTotalCount, setSearchDataTotalCount] = useState(0);
  const [chevronToggled, setChevronToggled] = useState(false);

  // Effect to toggle the search button visibility based on the search query
  useEffect(() => {
    const isSearchButtonVisible =
      serverSearchEnabled &&
      searchFields.length > 0 &&
      searchQuery.trim().length !== 0 &&
      selectedLabel !== searchQuery;
    setIsSearchButtonHidden(!isSearchButtonVisible);

    if (!isSearchButtonVisible) {
      setChevronToggled(false);
    }
  }, [searchFields.length, searchQuery, selectedLabel, serverSearchEnabled]);

  // Effect to update state when initial props change
  useEffect(() => {
    setSearchQuery(initialItemLabel.trim());
    setSelectedLabel(initialItemLabel.trim());
    setSelectedValue(initialItemValue);
    setSelectedAdditionalLabel(initialAdditionalLabel);
  }, [initialItemLabel, initialItemValue, initialAdditionalLabel]);

  useEffect(() => {
    if (clearSearchData) {
      setSearchData([]);
      setChevronToggled(false);
    }
  }, [clearSearchData]);

  // Handles input change in the search field
  const handleSearchInputChange = (text) => {
    setSelectedValue("");
    setSearchQuery(text);
    setSelectedAdditionalLabel("");
    setSearchData([]);

    if (text.length === 0) {
      // Call onValueChange callback to pass editedItem
      onValueChange({
        value: "",
        label: "",
        additionalData: {},
      });
    }
  };

  // Handles search button press
  const handleSearchButtonPress = () => {
    setSearchPage(1);
    fetchSearchData(1);
  };

  // Handles chevron button press for toggling search results
  const handleChevronButtonPress = () => {
    if (chevronToggled) {
      setSearchData([]);
    } else {
      setSearchPage(1);
      fetchSearchData(1);
    }
    setChevronToggled(!chevronToggled);
  };

  // Fetches search data from the remote source
  const fetchSearchData = async (page = 1) => {
    setSearchDataLoading(true);

    const { queryFields = {}, commonQueryParams = {} } = { ...queryParams }; // Ensure to copy queryParams to avoid mutation
    const { or = [], sort = [] } = { ...queryFields };

    if (serverSearchEnabled && !isSearchButtonHidden) {
      searchFields.forEach((field) => {
        or.push({
          fieldName: field,
          operator: "contains",
          value: searchQuery,
        });
      });
    }

    const newQueryFields = {
      ...queryFields,
      or: or,
    };

    delete newQueryFields.sort;

    const formData = {
      query: JSON.stringify(newQueryFields),
      ...commonQueryParams,
      page: page,
      limit: searchLimit,
      sort: JSON.stringify(sort),
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

      if (response.success === true && Array.isArray(response.data)) {
        const newData = response.data.map((item) => {
          const additionalData = additionalFields.reduce((acc, field) => {
            const key = Object.keys(field)[0]; // Get the key (e.g., 'extID')
            const fieldValue = field[key]; // Get the value (e.g., 'Customer-extID')
            acc[key] = item[fieldValue]; // Add the key-value pair to acc
            return acc;
          }, {});

          return {
            label: item[labelItemField] ?? "",
            additionalData: additionalData,
            value: item[valueItemField] ?? "",
          };
        });

        setSearchData(newData);
        setSearchDataTotalCount(response["TOTAL_RECORD_COUNT"] ?? 0);
        if (newData.length === 0) {
          setNoResults(true);
          setChevronToggled(false); // Reset chevron toggle on no results
          setSearchQuery(""); // Clear the search query when no results are found
          setTimeout(() => {
            setNoResults(false);
          }, 1000);
        }
      } else {
        setSearchData([]);
        setNoResults(true);
        setChevronToggled(false); // Reset chevron toggle on no results
        setSearchQuery(""); // Clear the search query when no results are found
        setTimeout(() => {
          setNoResults(false);
        }, 1000);
      }
    } catch (error) {
      console.error("Error in fetchSearchData (CustomRemotePicker): ", error);
    } finally {
      setSearchDataLoading(false);
    }
  };

  // Handles fetching the next page of search results
  const handleSearchNextPage = () => {
    const nextPage = searchPage + 1;
    setSearchPage(nextPage);
    fetchSearchData(nextPage);
  };

  // Handles fetching the previous page of search results
  const handleSearchPreviousPage = () => {
    if (searchPage > 1) {
      const prevPage = searchPage - 1;
      setSearchPage(prevPage);
      fetchSearchData(prevPage);
    }
  };

  // Handles selection of an item
  const handleItemSelection = (item) => {
    const { label = "", value = "", additionalData = {} } = item;
    const trimmedLabel = label.trim();
    const extID = additionalData.extID ?? "";

    // Update local state with selected values
    setSelectedValue(value);
    setSearchQuery(trimmedLabel);
    setSelectedLabel(trimmedLabel);
    setSelectedAdditionalLabel(extID);
    setSearchData([]);

    // Call onValueChange callback to pass editedItem
    onValueChange({
      value,
      label: trimmedLabel,
      additionalData,
    });
  };

  return (
    <>
      <View style={styles.rowContainer}>
        <Text style={styles.modalInputLabel}>{pickerLabel}</Text>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={styles.modalInputLabelRight}
        >
          {selectedAdditionalLabel}
        </Text>
      </View>
      <View style={styles.inputContainer}>
        <View style={styles.searchContainer}>
          <CustomTextInput
            containerStyle={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearchInputChange}
            placeholder={`${t("search")}...`}
            editable={
              !disabled &&
              !searchDataLoading &&
              (selectedLabel ? selectedLabel !== searchQuery : true)
            }
            showSearchIcon={!isSearchButtonHidden}
            onSearchPress={handleSearchButtonPress}
            searchButtonDisabled={searchDataLoading}
            forceEnableClearButton={!disabled}
            multiline={multiline}
          />
          {isSearchButtonHidden && (
            <View style={styles.chevronContainer}>
              <CustomButton
                onPress={handleChevronButtonPress}
                label=""
                icon={{
                  name: chevronToggled
                    ? "chevron-up-circle"
                    : "chevron-down-circle",
                  library: "MaterialCommunityIcons",
                  size: 24,
                  color: "blue",
                }}
                disabled={searchDataLoading || disabled}
              />
            </View>
          )}
        </View>
        {searchDataLoading && <ActivityIndicator style={styles.loader} />}
        {!searchDataLoading && (
          <ScrollView style={styles.searchItemView}>
            {searchData.length === 0 && noResults && (
              <View style={styles.emptyListContainer}>
                <Text>{t("no_result_found")}</Text>
              </View>
            )}
            {searchData.map((item) => {
              const extID = item.additionalData.extID ?? "";
              const label = item.label.trim() ?? "";

              return (
                <TouchableOpacity
                  style={styles.searchItem}
                  key={item.value}
                  onPress={() => handleItemSelection(item)}
                >
                  <Text style={styles.item}>
                    {extID && `${extID}: `}
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {searchData.length > 0 && (
              <View style={styles.paginationContainer}>
                <CustomButton
                  onPress={handleSearchPreviousPage}
                  label={t("previous")}
                  icon={{}}
                  backgroundColor={false}
                  labelStyle={{
                    fontSize: 14,
                    color: "#00f",
                  }}
                  disabled={searchPage <= 1}
                  style={{
                    paddingHorizontal: 0,
                    paddingVertical: 0,
                  }}
                />
                <Text>
                  {t("page")} {searchPage} {t("of")}{" "}
                  {Math.ceil(searchDataTotalCount / searchLimit)}
                </Text>
                <CustomButton
                  onPress={handleSearchNextPage}
                  label={t("next")}
                  icon={{}}
                  backgroundColor={false}
                  labelStyle={{
                    fontSize: 14,
                    color: "#00f",
                  }}
                  disabled={searchPage * searchLimit >= searchDataTotalCount}
                  style={{
                    paddingHorizontal: 0,
                    paddingVertical: 0,
                  }}
                />
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalInputLabel: {
    fontSize: 14,
    marginBottom: 5,
    fontWeight: "bold",
  },
  modalInputLabelRight: {
    color: "#808080",
    fontWeight: "bold",
  },
  inputContainer: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "black",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 6,
    borderWidth: 0,
  },
  loader: {
    marginVertical: 18,
  },
  item: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
  },
  emptyListContainer: {
    flex: 1,
    padding: "2%",
    borderTopWidth: 1,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  searchItemView: {
    flex: 1,
  },
  searchItem: {
    backgroundColor: "#e5eef7",
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4%",
    borderTopWidth: 2,
    borderTopColor: "#ccc",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  chevronContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#f0f0f0",
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
});

export default CustomRemotePicker;
