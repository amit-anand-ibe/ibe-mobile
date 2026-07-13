import React, { useContext, useEffect, useState, useRef } from "react";

import {
  Alert,
  Button,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { format } from "date-fns";

import CustomButton from "../components/CustomButton";

import File from "./File";
import ExpenseDetailItemEditor from "./ExpenseDetailItemEditor";

import { screenDimension } from "../utils/ScreenUtils";

import {
  BUSOBJCAT,
  PREFERRED_LANGUAGES,
} from "../constants";

import {
  convertAmountToDisplayFormat,
  convertToDateObject,
  getRemarkText,
  isEqual,
  setRemarkText,
} from "../utils/FormatUtils";

import { updateSplitAmounts } from "../utils/ExpenseUtils";

const ExpenseDetailItemsTab = ({
  navigation,
  busObjCat,
  busObjId,
  isParentLocked,
  isEditMode,
  currentStatus,
  listOfNextStatus,
  handleReload,
  loading,
  setLoading,
  setReceiptRequired,
  onExpenseDetailChange,
  expenseDetail,
}) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const lang = i18n.language;
  const floatingButtonBottom = Math.max(insets.bottom, 24) + 20;

  const {
    expenseStart,
    baseCurrency,
    empCurrency,
    expenseClassifications,
  } = expenseDetail;

  const [isEditingItem, setIsEditingItem] = useState(false);
  const [isClassificationsTab, setIsClassificationsTab] = useState(false);
  const [isItemEditMode, setIsItemEditMode] = useState(false);

  const [currentItem, setCurrentItem] = useState({});
  const [sortedItems, setSortedItems] = useState({});

  const [expenseItemsMap, setExpenseItemsMap] = useState(new Map());
  const [expandedItem, setExpandedItem] = useState(new Set());

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItems, setSelectedItems] = useState(null);

  const [classifications, setClassifications] = useState(
    expenseClassifications
  );

  const prevClassificationsRef = useRef(classifications);

  const generateExpenseItemsMap = (classifications) => {
    console.log(
      "Classifications (or expense items) :",
      JSON.stringify(classifications)
    );

    const expenseItemsMap = new Map();

    classifications.forEach((classification) => {
      const {
        projectWbsID,
        "projectWbsID:ProjectWBS-extID": projectExtID,
        "projectWbsID:ProjectWBS-text-text": projectText,
        taskID,
        "taskID:Task-extID": taskExtID,
        "taskID:Task-text-text": taskText,
        department,
        "department:BusUnit-extID": departmentExtID,
        "department:BusUnit-name-text": departmentText,
        billable,
        amountBU,
        items,
      } = classification;

      items.forEach((item) => {
        const expenseData = item.expenseData || {}; // Extract `expenseData` if it exists
        const mileage = item.mileage || {};

        const {
          sortSeq,
          isSplit,
          splitAmt,
          invoiceRef,
          totalAcrossSplits,
          amtReimburse,
          billableQuantity,
          splitPercent,
          remark,
          "remark:text": remarkText,
        } = item;

        const expenseItemType = expenseData.type || item["expenseData-type"];

        const expenseItemTypeText =
          expenseData["type:ExpenseType-name"] ||
          item["expenseData-type:ExpenseType-name"];

        const expenseItemTypeId =
          expenseData["type:ExpenseType-id"] ||
          item["expenseData-type:ExpenseType-id"];

        const itemTypeIsMileage =
          expenseData["type:ExpenseType-isMileage"] ||
          item["expenseData-type:ExpenseType-isMileage"];

        const itemTypeIsQty =
          expenseData["type:ExpenseType-isQtyBased"] ||
          item["expenseData-type:ExpenseType-isQtyBased"];

        const itemTypeIsRate =
          expenseData["type:ExpenseType-isRateBased"] ||
          item["expenseData-type:ExpenseType-isRateBased"];

        const nonReimbursible =
          expenseData["type:ExpenseType-nonReimbursible"] ||
          item["expenseData-type:ExpenseType-nonReimbursible"];

        const itemDate =
          expenseData.incurredOn || item["expenseData-incurredOn"];

        const expAmt = expenseData.amt || item["expenseData-amt"];
        const amtBU = expenseData.amtBU || item["expenseData-amtBU"];
        const unitAmt = expenseData.unitAmt || item["expenseData-unitAmt"];
        const expenseQuantity = expenseData.qty || item["expenseData-qty"];
        const taxCode = expenseData.taxCode || item["expenseData-taxCode"];
        const taxCodeText =
          expenseData["taxCode:TaxCode-text"] ||
          item["expenseData-taxCode:TaxCode-text"];
        const taxIsChangeable =
          expenseData["taxCode:TaxCode-changeable"] ||
          item["expenseData-taxCode:TaxCode-changeable"];
        const taxRate = expenseData.taxRate || item["expenseData-taxRate"];
        const vatID = expenseData.vatID || item["expenseData-vatID"];
        const taxBase = expenseData.taxBase || item["expenseData-taxBase"];

        const taxBaseBU =
          expenseData.taxBaseBU || item["expenseData-taxBaseBU"];

        const taxAmt = expenseData.taxAmt || item["expenseData-taxAmt"];
        const taxAmtBU = expenseData.taxAmtBU || item["expenseData-taxAmtBU"];

        const receipts = expenseData.receipts || item["expenseData-receipts"];

        const expenseSupplierId =
          expenseData.supplierID || item["expenseData-supplierID"];
        const expenseSupplierText =
          expenseData["supplierID:ExpenseSupplier-extID"] ||
          item["expenseData-supplierID:ExpenseSupplier-extID"];

        const reimbursible =
          expenseData.reimbursible || item["expenseData-reimbursible"];
        const itemLocationObj =
          expenseData.location || item["expenseData-location"];
        const itemLocation =
          expenseData["location-locationID:Location-extID"] ||
          item["expenseData-location-locationID:Location-extID"];

        const startLocationObj =
          mileage.startLocation || item["mileage-startLocation"];
        const fromLoc =
          mileage["startLocation-locationID:Location-extID"] ||
          item["mileage-startLocation-locationID:Location-extID"];
        const endLocationObj =
          mileage.endLocation || item["mileage-endLocation"];
        const toLoc =
          mileage["endLocation-locationID:Location-extID"] ||
          item["mileage-endLocation-locationID:Location-extID"];
        const calcDist = mileage.calcDist || item["mileage-calcDist"];
        const overrideDist =
          mileage.expensedDist || item["mileage-expensedDist"];
        const returnTrip = mileage.returnTrip || item["mileage-returnTrip"];

        const expenseItem = {
          projectId: projectWbsID || "",
          projectExtId: projectExtID || "",
          projectText: projectText || "",
          taskId: taskID || "",
          taskExtId: taskExtID || "",
          taskText: taskText || "",
          departmentId: department || "",
          departmentExtId: departmentExtID || "",
          departmentText: departmentText || "",
          billable: billable || false,
          amountBU: amountBU || { amount: 0, currency: null },

          expenseItemType: expenseItemType || "",
          expenseItemTypeText: expenseItemTypeText || "",
          expenseItemTypeId: expenseItemTypeId || "",
          itemTypeIsMileage: itemTypeIsMileage || false,
          itemTypeIsRate: itemTypeIsRate || false,
          itemTypeIsQty: itemTypeIsQty || false,
          nonReimbursible: nonReimbursible || false,
          itemDate: itemDate || "",
          expAmt: expAmt || { amount: 0, currency: null },
          amtBU: amtBU || { amount: 0, currency: null },
          unitAmt: unitAmt || { amount: 0, currency: null },
          expenseQuantity: expenseQuantity || { quantity: 0, unit: "" },
          taxCode: taxCode || "",
          taxRate: taxRate || 0,
          vatID: vatID || "",
          taxCodeText: taxCodeText || "",
          taxIsChangeable: taxIsChangeable || false,
          taxBase: taxBase || { amount: 0, currency: null },
          taxBaseBU: taxBaseBU || { amount: 0, currency: null },
          taxAmt: taxAmt || { amount: 0, currency: null },
          taxAmtBU: taxAmtBU || { amount: 0, currency: null },
          expenseSupplierId: expenseSupplierId || "",
          expenseSupplierText: expenseSupplierText || "",
          reimbursible: reimbursible || false,

          isSplit: isSplit || false,
          splitAmt: splitAmt || { amount: 0, currency: null },
          sortSeq: sortSeq || "",
          remark: remark || [],
          remarkText: remarkText || "",
          receipts: receipts || [],
          invoiceRef: invoiceRef || "",
          amtReimburse: amtReimburse || { amount: 0, currency: null },
          itemLocation: itemLocation || "",
          itemLocationObj: itemLocationObj || {},
          billableQuantity: billableQuantity || { quantity: 0, unit: "" },
          splitPercent: splitPercent || 0,
          totalAcrossSplits: totalAcrossSplits || { amount: 0, currency: null },

          fromLoc: fromLoc || "",
          toLoc: toLoc || "",
          startLocationObj: startLocationObj || {},
          endLocationObj: endLocationObj || {},
          returnTrip: returnTrip || false,
          calcDist: calcDist || { quantity: 0, unit: "" },
          overrideDist: overrideDist || { quantity: 0, unit: "" },
        };

        if (!expenseItemsMap.has(expenseStart)) {
          expenseItemsMap.set(expenseStart, []);
        }

        expenseItemsMap.get(expenseStart).push(expenseItem);
      });
    });

    console.log(
      "Expense items map after conversion:",
      Array.from(expenseItemsMap.entries()).map(([key, value]) => ({
        start: key,
        items: JSON.stringify(value),
      }))
    );

    return expenseItemsMap;
  };

  const convertExpenseItemsMapToClassifications = (expenseItemsMap) => {
    const classifications = [];

    expenseItemsMap.forEach((items, expenseStart) => {
      items.forEach((item) => {
        const {
          projectId,
          projectExtId,
          projectText,
          taskId,
          taskExtId,
          taskText,
          departmentId,
          departmentExtId,
          departmentText,
          billable,
          amountBU,
          isSplit,
          splitAmt,
          sortSeq,
          remark,
          receipts,
          invoiceRef,
          amtReimburse,
          itemLocation,
          itemLocationObj,
          billableQuantity,
          splitPercent,
          totalAcrossSplits,
          expenseItemType,
          expenseItemTypeText,
          expenseItemTypeId,
          itemTypeIsMileage,
          itemTypeIsRate,
          itemTypeIsQty,
          nonReimbursible,
          itemDate,
          expAmt,
          amtBU,
          unitAmt,
          expenseQuantity,
          taxCode,
          taxRate,
          vatID,
          taxCodeText,
          taxIsChangeable,
          taxBase,
          taxBaseBU,
          taxAmt,
          taxAmtBU,
          expenseSupplierId,
          expenseSupplierText,
          reimbursible,
          fromLoc,
          toLoc,
          startLocationObj,
          endLocationObj,
          returnTrip,
          calcDist,
          overrideDist,
        } = item;

        // Create a unique key based on a combination of departmentId and taskId
        const uniqueKey = `${departmentId || ""}${taskId || ""}`;

        // Find or create the classification entry
        let classification = classifications.find(
          (i) => i.uniqueKey === uniqueKey
        );

        if (!classification) {
          classification = {
            uniqueKey, // Add uniqueKey to the classification for easier lookup
            projectWbsID: projectId,
            "projectWbsID:ProjectWBS-extID": projectExtId,
            "projectWbsID:ProjectWBS-text-text": projectText,
            taskID: taskId,
            "taskID:Task-extID": taskExtId,
            "taskID:Task-text-text": taskText,
            department: departmentId,
            "department:BusUnit-extID": departmentExtId,
            "department:BusUnit-name-text": departmentText,
            billable: billable,
            amountBU: amountBU,
            items: [],
          };

          classifications.push(classification);
        }

        const mileageData = itemTypeIsMileage
          ? {
              mileage: {
                startLocation: startLocationObj,
                "startLocation-locationID:Location-extID": fromLoc,
                endLocation: endLocationObj,
                "endLocation-locationID:Location-extID": toLoc,
                calcDist: calcDist,
                expensedDist: overrideDist,
                returnTrip: returnTrip,
              },
            }
          : {};

        const taxData = taxRate
          ? {
              taxBase: taxBase,
              taxAmt: taxAmt,
              taxBaseBU: taxBaseBU,
              taxAmtBU: taxAmtBU,
              "taxCode:TaxCode-text": taxCodeText,
              "taxCode:TaxCode-changeable": taxIsChangeable,
            }
          : {};

        // Add the item to the classifications' items
        classification.items.push({
          sortSeq: sortSeq,
          isSplit: isSplit,
          splitAmt: splitAmt,
          expenseData: {
            type: expenseItemType,
            "type:ExpenseType-name": expenseItemTypeText,
            "type:ExpenseType-id": expenseItemTypeId,
            "type:ExpenseType-isRateBased": itemTypeIsRate,
            "type:ExpenseType-isMileage": itemTypeIsMileage,
            "type:ExpenseType-isQtyBased": itemTypeIsQty,
            "type:ExpenseType-nonReimbursible": nonReimbursible,
            incurredOn: itemDate,
            amt: expAmt,
            amtBU: amtBU,
            qty: expenseQuantity,
            unitAmt: unitAmt,
            taxRate: taxRate,
            vatID: vatID,
            taxCode: taxCode,
            ...taxData,
            supplierID: expenseSupplierId,
            "supplierID:ExpenseSupplier-extID": expenseSupplierText,
            reimbursible: reimbursible,
            location: itemLocationObj,
            "location-locationID:Location-extID": itemLocation,
            receipts: receipts,
          },
          invoiceRef: invoiceRef,
          ...mileageData,
          billableQuantity: billableQuantity,
          totalAcrossSplits: totalAcrossSplits,
          splitPercent: splitPercent,
          amtReimburse: amtReimburse,
          "remark:text": getRemarkText(remark, lang, PREFERRED_LANGUAGES),
          // remark
        });
      });
    });

    // Remove the uniqueKey before returning classifications
    classifications.forEach((classification) => {
      delete classification.uniqueKey;
    });

    console.log(
      "Updated classifications (or expense items) after converting from expenseItemsMap:",
      JSON.stringify(classifications)
    );

    return classifications;
  };

  const goToClassificationsTab = (item) => {
    setIsClassificationsTab(true);
    setIsItemEditMode(true);
    setCurrentItem(item);
    setIsEditingItem(true);
  };

  const goToFiles = (items) => {
    setSelectedItems(items);
    setModalVisible(true);
  };

  const handleCreateItemClick = () => {
    setIsItemEditMode(false);

    setCurrentItem([
      {
        // Set default values for new item
        expenseItemType: "",
        expenseItemTypeText: "",
        expenseItemTypeId: "",
        itemTypeIsMileage: "",
        itemTypeIsQty: "",
        itemTypeIsRate: "",
        nonReimbursible: "",
        remark: [],
        itemDate: "",
        projectId: "",
        taskId: "",
        departmentId: "",
        billable: "",
        unitAmt: { amount: 0, currency: baseCurrency ?? "" },
        expAmt: { amount: 0, currency: "" },
        amtBU: { amount: 0, currency: baseCurrency ?? "" },
        totalAcrossSplits: { amount: 0, currency: baseCurrency ?? "" },
        amtReimburse: { amount: 0, currency: empCurrency ?? "" },
        isSplit: false,
        splitAmt: { amount: 0, currency: "" },
        splitPercent: 0,
        expenseSupplierId: "",
        invoiceRef: "",
        taxCode: "",
        taxRate: 0,
        vatID: "",
      },
    ]);

    setIsEditingItem(true);
  };

  const handleEditItemClick = (items) => {
    setIsItemEditMode(true);
    setCurrentItem(items);
    setIsEditingItem(true);
  };

  const handleCancelEditItem = () => {
    setIsEditingItem(false);
    setIsClassificationsTab(false);
    setCurrentItem({});
  };

  const handleDeletionIfNeeded = (editedItems) => {
    const filteredEditedItems = Object.keys(editedItems).filter(
      (key) => key !== "isDirty"
    );

    if (currentItem.length > filteredEditedItems.length) {
      console.log("Deletion detected!");

      const generateUniqueKey = (item) =>
        `${item.departmentId || ""}${item.taskId || ""}`;

      const editedKeys = new Set(
        Object.values(editedItems).map((item) => generateUniqueKey(item))
      );

      // Find deleted items by comparing currentItem with editedItems
      const deletedKeys = new Set(
        currentItem
          .map((item) => generateUniqueKey(item))
          .filter((key) => !editedKeys.has(key)) // Only keep missing keys
      );

      if (deletedKeys.size === 0) return; // No deletions, exit early

      let updatedItems = expenseItemsMap.has(expenseStart)
        ? [...expenseItemsMap.get(expenseStart)]
        : [];

      // Remove items with the deleted keys
      updatedItems = updatedItems.filter(
        (item) => !deletedKeys.has(generateUniqueKey(item))
      );

      const updatedExpenseItemsMap = new Map(expenseItemsMap);
      updatedExpenseItemsMap.set(expenseStart, updatedItems);

      setExpenseItemsMap(updatedExpenseItemsMap);
      generateSortedItems(updatedExpenseItemsMap);

      setClassifications(
        convertExpenseItemsMapToClassifications(updatedExpenseItemsMap)
      );

      // Keeps only the non-deleted ones
      const newCurrentItem = currentItem.filter((item) =>
        editedKeys.has(generateUniqueKey(item))
      );
      setCurrentItem(newCurrentItem);

      return { updatedExpenseItemsMap, newCurrentItem };
    }

    return null;
  };

  const handleConfirmCreateOrEditItem = async (editedItems) => {
    const deletionResult = handleDeletionIfNeeded(editedItems);

    // Uses updated values if deletion happened, otherwise fallbacks to current values
    const actualItemsMap =
      deletionResult?.updatedExpenseItemsMap ?? expenseItemsMap;
    const actualCurrentItem = deletionResult?.newCurrentItem ?? currentItem;

    let items = actualItemsMap.has(expenseStart)
      ? [...actualItemsMap.get(expenseStart)]
      : [];

    const generateUniqueKey = (item) =>
      `${item.departmentId || ""}${item.taskId || ""}`;

    let itemsMap = new Map(
      (items || []).map((item) => [generateUniqueKey(item), item])
    );
    let currentItemMap = new Map(
      actualCurrentItem.map((item) => [generateUniqueKey(item), item])
    );

    for (let [key, editedItem] of Object.entries(editedItems)) {
      if (key === "isDirty") continue; // Skip isDirty

      const editedItemKey = generateUniqueKey(editedItem);

      // Check if a different item with the same key already exists
      if (
        itemsMap.has(editedItemKey) &&
        !isEqual(itemsMap.get(editedItemKey), currentItemMap.get(editedItemKey))
      ) {
        Alert.alert(
          t("validation_error"),
          t("expense_item_exists"),
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return;
      }

      if (currentItemMap.has(editedItemKey)) {
        // Update the existing item in the map
        itemsMap.set(editedItemKey, editedItem);

        if (editedItem.isSplit) {
          itemsMap = await updateSplitAmounts(itemsMap, editedItem.sortSeq);
        }
      } else {
        // Check if the editedItem has a sortSeq
        if (!editedItem.sortSeq) {
          const highestSortSeq =
            items.length > 0
              ? Math.max(...items.map((item) => item.sortSeq ?? 0))
              : 0;
          editedItem.sortSeq = highestSortSeq + 1; // Assign a sortSeq
        }

        // Check if an existing item has the same sortSeq
        const existingItemWithSameSortSeq = [...itemsMap.values()].find(
          (item) => item.sortSeq === editedItem.sortSeq
        );

        if (existingItemWithSameSortSeq) {
          // Generate a unique key for the new item and add it
          const newItemKey = generateUniqueKey(editedItem);
          itemsMap.set(newItemKey, editedItem);

          // Call function to update split amounts
          itemsMap = await updateSplitAmounts(itemsMap, editedItem.sortSeq);
        } else {
          itemsMap.set(editedItemKey, editedItem);
        }
      }
    }

    // Convert back to array for saving
    const updatedItems = Array.from(itemsMap.values());

    const updatedExpenseItemsMap = new Map(actualItemsMap);
    updatedExpenseItemsMap.set(expenseStart, updatedItems);

    console.log(
      `On confirm, the items going to be updated are ${JSON.stringify(
        updatedItems
      )}`
    );

    setExpenseItemsMap(updatedExpenseItemsMap);
    generateSortedItems(updatedExpenseItemsMap);

    setCurrentItem({});
    setIsClassificationsTab(false);
    setIsEditingItem(false);

    setClassifications(
      convertExpenseItemsMapToClassifications(updatedExpenseItemsMap)
    );
  };

  const handleDeleteItemClick = (items) => {
    Alert.alert(
      t("delete_item"),
      t("delete_item_confirmation"),
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        { text: "OK", onPress: () => onDeleteItem(items) },
      ],
      { cancelable: false }
    );
  };

  const onDeleteItem = (itemsToDelete) => {
    // itemsToDelete is an array of all those items associated with the particular sortSeq
    let items = expenseItemsMap.has(expenseStart)
      ? [...expenseItemsMap.get(expenseStart)]
      : [];

    // Filter out all items from the map that have the same sortSeq as the item(s) to delete
    const updatedItems = items.filter(
      (item) => item.sortSeq !== itemsToDelete[0].sortSeq
    );

    // Update the map with the remaining items
    const updatedExpenseItemsMap = new Map(expenseItemsMap);
    updatedExpenseItemsMap.set(expenseStart, updatedItems);

    console.log(
      `On delete the item(s) remaining is/are ${JSON.stringify(items)}`
    );

    setExpenseItemsMap(updatedExpenseItemsMap); // Set the new map
    generateSortedItems(updatedExpenseItemsMap); // Generate the new sorted items
    setClassifications(
      convertExpenseItemsMapToClassifications(updatedExpenseItemsMap)
    );
  };

  const handleToggleExpand = (sortSeq) => {
    setExpandedItem((prev) => {
      const toggleSet = new Set(prev);

      if (toggleSet.has(sortSeq)) {
        toggleSet.delete(sortSeq);
      } else {
        toggleSet.add(sortSeq);
      }
      return toggleSet;
    });
  };

  const calculateAmounts = (classifications) => {
    let totalAmt = { amount: 0, currency: baseCurrency };
    let totalAmtReimburse = { amount: 0, currency: empCurrency };
    let paidAmt = { amount: 0, currency: empCurrency };

    for (const item of classifications) {
      for (const subItem of item.items) {
        if (
          subItem.expenseData?.amtBU?.amount &&
          subItem.expenseData?.amtBU.currency === totalAmt.currency
        ) {
          totalAmt.amount = Number(
            (
              totalAmt.amount + Number(subItem.expenseData?.amtBU.amount)
            ).toFixed(2)
          );
        }

        if (
          subItem.amtReimburse?.amount &&
          subItem.amtReimburse.currency === totalAmtReimburse.currency
        ) {
          totalAmtReimburse.amount = Number(
            (totalAmtReimburse.amount + subItem.amtReimburse.amount).toFixed(2)
          );
        }

        // if (!subItem.payment) {
        //   paidAmt = 0; // change this for when payment can be made
        // }
      }
    }

    let amtDueBU = { amount: 0, currency: baseCurrency };
    let totalReimbursibleBU = { amount: 0, currency: baseCurrency };
    let totalReimbursible = { amount: 0, currency: empCurrency };

    amtDueBU.amount = totalAmtReimburse.amount;
    totalReimbursible.amount = totalAmtReimburse.amount;
    totalReimbursibleBU.amount = totalAmtReimburse.amount;

    return {
      totalAmt,
      totalAmtReimburse,
      paidAmt,
      amtDueBU,
      totalReimbursible,
      totalReimbursibleBU,
    };
  };

  const generateSortedItems = (expenseItemsMap) => {
    // Arrange the items according to their sortSeq
    const newSortedItems = {};

    const allExpenseItems =
      expenseStart && expenseItemsMap.has(expenseStart)
        ? expenseItemsMap.get(expenseStart)
        : [];

    allExpenseItems.forEach((item) => {
      if (!newSortedItems[item.sortSeq]) {
        newSortedItems[item.sortSeq] = [];
      }
      newSortedItems[item.sortSeq].push(item);
    });

    setSortedItems(newSortedItems);
  };

  useEffect(() => {
    const newExpenseItemsMap = generateExpenseItemsMap(classifications);
    setExpenseItemsMap(newExpenseItemsMap);

    generateSortedItems(newExpenseItemsMap);
  }, []);

  useEffect(() => {
    if (prevClassificationsRef.current === classifications) {
      return;
    }
    prevClassificationsRef.current = classifications;

    const {
      totalAmt,
      totalAmtReimburse,
      paidAmt,
      amtDueBU,
      totalReimbursible,
      totalReimbursibleBU,
    } = calculateAmounts(classifications);

    const updatedValues = {
      expenseClassifications: classifications,
      expensePaidAmt: paidAmt,
      expenseAmtDue: totalAmtReimburse,
      expenseAmountBU: totalAmt,
      amtDueBU: amtDueBU,
      totalReimbursible: totalReimbursible,
      totalReimbursibleBU: totalReimbursibleBU,
    };

    // Call the callback function to propagate the changes
    onExpenseDetailChange(updatedValues);
  }, [classifications]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.itemsScrollViewContent}>
        {Object.entries(sortedItems).map(([sortSeq, items]) => (
          <View
            key={sortSeq}
            style={[
              styles.itemsCardContainer,
              items.some((item) => item.isDirty) && styles.dirtyItem,
            ]}
          >
            <View style={styles.itemsCardHeader}>
              <View style={styles.descContainer}>
                <Text numberOfLines={1} ellipsizeMode="tail">
                  {getRemarkText(items[0].remark, lang, PREFERRED_LANGUAGES) ||
                    items[0].remarkText ||
                    `${t("no_remarks_available")}...`}
                </Text>
              </View>
              <View style={styles.itemButtonContainer}>
                <View style={styles.editButtonContainer}>
                  <CustomButton
                    onPress={() => handleEditItemClick(items)}
                    label=""
                    icon={{
                      name: !isParentLocked
                        ? "square-edit-outline"
                        : "eye-outline",
                      library: "MaterialCommunityIcons",
                      size: 24,
                      color: "#005eb8",
                    }}
                    backgroundColor={false}
                    style={{ paddingHorizontal: 0, paddingVertical: 0 }}
                  />
                </View>
                {!isParentLocked && (
                  <View style={styles.deleteButtonContainer}>
                    <CustomButton
                      onPress={() => handleDeleteItemClick(items)}
                      label=""
                      icon={{
                        name: "trash-can-outline",
                        library: "MaterialCommunityIcons",
                        size: 24,
                        color: "#d9534f",
                      }}
                      backgroundColor={false}
                      style={{ paddingHorizontal: 0, paddingVertical: 0 }}
                    />
                  </View>
                )}
              </View>
            </View>
            <View style={styles.itemsCardSeparator} />
            <View style={styles.itemsCardMultiInRow}>
              <View style={styles.firstColumn}>
                <Text
                  style={styles.itemsCardMultiInRowLabel}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {t("expense_type")}
                </Text>
                <Text
                  style={styles.boldText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {items[0].expenseItemTypeText}
                </Text>
              </View>
              <View style={styles.secondColumn}>
                <Text style={styles.itemsCardMultiInRowLabel}>{t("date")}</Text>
                <Text>
                  {items[0].itemDate
                    ? format(new Date(items[0].itemDate), "yyyy-MM-dd")
                    : ""}
                </Text>
              </View>
              <View style={styles.thirdColumn}>
                <Text
                  style={styles.itemsCardMultiInRowLabel}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {t("amount")}
                </Text>
                <Text
                  style={styles.amountText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {convertAmountToDisplayFormat(
                    items[0].isSplit
                      ? items[0].totalAcrossSplits
                      : items[0].amtBU
                  )}
                </Text>
              </View>
            </View>
            <View style={styles.itemsCardMultiInRow}>
              <View style={styles.firstColumn}>
                <Text
                  style={styles.itemsCardMultiInRowLabel}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {t("quantity")}
                </Text>
                <Text numberOfLines={1} ellipsizeMode="tail">
                  {items[0].expenseQuantity?.quantity
                    ? `${items[0].expenseQuantity?.quantity} ${items[0].expenseQuantity?.unit}`
                    : ""}
                </Text>
              </View>
              <View style={styles.secondColumn}>
                <Text
                  style={styles.itemsCardMultiInRowLabel}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {t("rate")}
                </Text>
                <Text>{convertAmountToDisplayFormat(items[0].unitAmt)}</Text>
              </View>
              <View style={styles.thirdColumn}>
                <Text
                  style={styles.itemsCardMultiInRowLabel}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {t("reimbursable")}
                </Text>
                <Text numberOfLines={1} ellipsizeMode="tail">
                  {items[0].reimbursible ? t("yes") : "No"}
                </Text>
              </View>
            </View>
            <View style={styles.itemsCardMultiInRow}>
              <View style={[styles.firstColumn, { alignItems: "flex-start" }]}>
                <CustomButton
                  onPress={() => goToFiles(items)}
                  label=""
                  icon={{
                    name: "file",
                    library: "MaterialCommunityIcons",
                    size: 24,
                    color: "grey",
                  }}
                  backgroundColor={false}
                  style={{ paddingHorizontal: 0, paddingVertical: 0 }}
                />
                {items[0].receipts?.length > 0 && (
                  <View style={styles.receiptCountContainer}>
                    <Text style={styles.receiptCountText}>
                      {items[0].receipts.length}
                    </Text>
                  </View>
                )}
              </View>
              {items[0].isSplit && (
                <View
                  style={[styles.secondColumn, { alignItems: "flex-start" }]}
                >
                  <CustomButton
                    onPress={() => goToClassificationsTab(items)}
                    label=""
                    icon={{
                      name: "sitemap",
                      library: "FontAwesome",
                      size: 24,
                      color: "#000",
                    }}
                    backgroundColor={false}
                    style={{ paddingHorizontal: 0, paddingVertical: 0 }}
                  />
                </View>
              )}
              <View style={[styles.thirdColumn, { alignItems: "flex-end" }]}>
                <TouchableOpacity onPress={() => handleToggleExpand(sortSeq)}>
                  <Text style={styles.showMoreButtonText}>
                    {expandedItem.has(sortSeq)
                      ? t("show_less")
                      : t("show_more")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {expandedItem.has(sortSeq) && (
              <>
                {!items[0].isSplit && (
                  <>
                    {items[0].projectText && (
                      <View style={styles.itemsCardRow}>
                        <Text style={styles.itemsCardRowLabel}>
                          {t("project")}:
                        </Text>
                        <Text
                          style={styles.itemsCardRowValue}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {items[0].projectText.trim()}
                        </Text>
                      </View>
                    )}
                    {items[0].taskText && (
                      <View style={styles.itemsCardRow}>
                        <Text style={styles.itemsCardRowLabel}>
                          {t("task")}:
                        </Text>
                        <Text
                          style={styles.itemsCardRowValue}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {items[0].taskText?.trim()}
                        </Text>
                      </View>
                    )}
                    {items[0].departmentText && (
                      <View style={styles.itemsCardRow}>
                        <Text style={styles.itemsCardRowLabel}>
                          {t("department")}:
                        </Text>
                        <Text
                          style={styles.itemsCardRowValue}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {items[0].departmentText?.trim()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.itemsCardRow}>
                      <Text style={styles.itemsCardRowLabel}>
                        {t("billable")}:
                      </Text>
                      <Text style={styles.itemsCardRowValue} numberOfLines={1}>
                        {items[0].billable ? t("yes") : "No"}
                      </Text>
                    </View>
                  </>
                )}
                {items[0].expenseSupplier && (
                  <View style={styles.itemsCardRow}>
                    <Text style={styles.itemsCardRowLabel}>
                      {t("expense_supplier")}:
                    </Text>
                    <Text
                      style={styles.itemsCardRowValue}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {items[0].expenseSupplier}
                    </Text>
                  </View>
                )}
                {items[0].taxAmtBU?.amount > 0 && (
                  <View style={styles.itemsCardRow}>
                    <Text style={styles.itemsCardRowLabel}>
                      {t("tax_amount")}:
                    </Text>
                    <Text style={styles.itemsCardRowValue} numberOfLines={1}>
                      {convertAmountToDisplayFormat(items[0].taxAmtBU)}
                    </Text>
                  </View>
                )}
                {items[0].itemTypeIsMileage && (
                  <View
                    style={[styles.itemsCardMultiInRow, { marginTop: "2%" }]}
                  >
                    <View style={styles.firstColumn}>
                      <Text style={styles.itemsCardMultiInRowLabel}>
                        {t("from_loc")}
                      </Text>
                      <Text numberOfLines={3}>{items[0].fromLoc}</Text>
                    </View>
                    <View style={[styles.secondColumn, { marginLeft: "4%" }]}>
                      <Text style={styles.itemsCardMultiInRowLabel}>
                        {t("to_loc")}
                      </Text>
                      <Text
                        style={{ alignItems: "flex-end" }}
                        numberOfLines={3}
                      >
                        {items[0].toLoc}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        ))}
      </ScrollView>
      <View
        style={[
          styles.floatingContainer,
          { bottom: floatingButtonBottom },
        ]}
      >
        <CustomButton
          onPress={() => handleCreateItemClick()}
          label=""
          icon={{
            name: "plus",
            library: "MaterialCommunityIcons",
            size: 40,
            color: "#fff",
          }}
          disabled={isParentLocked}
          style={styles.floatingButton}
        />
      </View>
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedItems && (
              <File
                busObjCat={BUSOBJCAT.EXPENSE}
                busObjId={busObjId}
                initialFilesIdList={selectedItems[0].receipts}
                isParentLocked={isParentLocked}
              />
            )}
            <Button title="Close" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>
      {isEditingItem && (
        <ExpenseDetailItemEditor
          item={currentItem}
          secondTab={isClassificationsTab}
          setReceiptRequired={setReceiptRequired}
          onConfirm={handleConfirmCreateOrEditItem}
          onCancel={handleCancelEditItem}
          isItemEditMode={isItemEditMode}
          isParentLocked={isParentLocked}
          expenseDetail={expenseDetail}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    // backgroundColor: "#e5eef7",
  },
  modalContainer: {
    alignItems: "center",
    height: "100%",
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    justifyContent: "center",
    margin: "40%",
    width: "85%",
    height: "60%",
    padding: 10,
    borderRadius: 10,
  },
  itemsScrollViewContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: "2%",
    paddingBottom: screenDimension.height / 2,
  },
  itemsCardContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 0.5,
    borderRadius: 5,
    paddingVertical: "2%",
    paddingHorizontal: "4%",
    marginVertical: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
  },
  itemsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  descContainer: {
    flex: 1,
    marginRight: 10,
  },
  boldText: {
    // fontWeight: "bold",
  },
  itemButtonContainer: {
    flexDirection: "row",
  },
  editButtonContainer: {
    width: 35,
    alignItems: "flex-end",
  },
  deleteButtonContainer: {
    width: 35,
    alignItems: "flex-end",
  },
  multiClassButtonContainer: {
    width: 35,
    marginBottom: "2%",
    alignItems: "center",
  },
  itemsCardSeparator: {
    borderBottomColor: "#ccc",
    borderBottomWidth: 1,
    marginVertical: "2%",
  },
  itemsCardRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: "1%",
  },
  itemsCardRowLabel: {
    fontSize: 14,
    fontWeight: "bold",
    flexShrink: 0, // This prevents the label from shrinking
    marginRight: 5,
  },
  itemsCardRowValue: {
    fontSize: 14,
    flexShrink: 1, // This allows the value to shrink if needed
    flexWrap: "wrap", // Allow the text to wrap if it's too long
  },
  itemsCardMultiInRow: {
    flexDirection: "row",
    // justifyContent: "space-between",
    marginBottom: "2%",
  },
  itemsCardMultiInRowLabel: {
    fontWeight: "bold",
  },
  firstColumn: {
    flex: 3.5,
  },
  secondColumn: {
    flex: 3,
  },
  thirdColumn: {
    flex: 2,
  },
  showMoreButtonText: {
    color: "blue",
    fontSize: 15,
  },
  dirtyItem: {
    borderColor: "#f00",
    borderWidth: 2,
  },
  receiptCountContainer: {
    position: "absolute",
    top: -5,
    left: 20,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  receiptCountText: {
    color: "#d9534f",
    fontSize: 14,
    fontWeight: "bold",
  },
  amountText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "green",
  },
  floatingContainer: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  floatingButton: {
    marginBottom: 10,
    marginLeft: 10,
    width: 55,
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#005eb8",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
  },
});

export default ExpenseDetailItemsTab;
