import React, { useContext, useEffect, useState, useRef } from "react";

import {
  Alert,
  Button,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native-gesture-handler";
import { LoggedInUserInfoContext } from "../../context/LoggedInUserInfoContext";

import ExpenseItemDetails from "./Expense Files/ExpenseItemDetails";
import ExpenseClassifications from "./Expense Files/ExpenseClassifications";
import { isEqual } from "date-fns";
import { showToast } from "../utils/MessageUtils";

const ExpenseDetailItemEditor = ({
  item,
  secondTab,
  setReceiptRequired,
  onConfirm,
  onCancel,
  isItemEditMode,
  isParentLocked,
  expenseDetail,
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { loggedInUserInfo } = useContext(LoggedInUserInfoContext);

  const { defaultAsHomeDefault } = expenseDetail;

  const [activeTab, setActiveTab] = useState(
    secondTab ? "classifications" : "item_details"
  );

  const [initialItem, setInitialItem] = useState({ ...item });
  const [tempItem, setTempItem] = useState({ ...item });
  const [isConfirming, setIsConfirming] = useState(false);

  const expenseItemDetailsRef = useRef(null);
  const expenseClassificationsRef = useRef(null);

  const handleSwitchTabs = (newTab) => {
    // should save info of one tab before switching to the other

    if (newTab !== activeTab) {
      if (activeTab === "item_details" && expenseItemDetailsRef.current) {
        expenseItemDetailsRef.current.saveChanges();
      } else if (
        activeTab === "classifications" &&
        expenseClassificationsRef.current
      ) {
        expenseClassificationsRef.current.saveChanges();
      }
      setActiveTab(newTab);
    }
  };

  const handleCancel = () => {
    // if (!isEqual(tempItem, initialItem)) {
    //   Alert.alert(
    //     t("unsaved_changes_title"),
    //     t("unsaved_changes_message"),
    //     [
    //       {
    //         text: t("cancel"),
    //         style: "cancel",
    //       },
    //       {
    //         text: t("discard"),
    //         style: "destructive",
    //         onPress: onCancel,
    //       },
    //     ],
    //     { cancelable: false }
    //   );
    // } else {
    // No changes, directly cancel
    onCancel();
    // }
  };

  const validateChanges = () => {
    let hasSplitItems = false;
    let totalSplitPercent = 0;

    for (const item of Object.values(tempItem).filter(i => typeof i === "object")) {
      const validationErrorMessages = {
        expense_type: "Expense type is required",
        amount: "Amount should be greater than zero",
        remark: "Description is required",
        task: t("task_required_message"),
        department: t("department_required_message"),
        departmentOrTask: t("department_or_task_required_message"),
        location: `Location is required for expense type ${item.expenseItemTypeText}`,
        supplier: `Expense Supplier is required for expense type ${item.expenseItemTypeText}`,
        vAT: `Tax Identifier is required for expense type ${item.expenseItemTypeText}`,
        maxClaimAmount: `Claim amount ${item.amtBU?.amount} is greater than allowed amount ${item.maxAmount}`,
      };

      const validationWarningMessages = {
        maxClaimAmount: `Claim amount ${item.amtBU?.amount} is greater than allowed amount ${item.maxAmount}`,
      };

      // Check for item expense type
      if (!item.expenseItemType) {
        Alert.alert(
          t("validation_error"),
          validationErrorMessages.expense_type,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      }

      // Check for location if locationInput is true
      // (not applicable for Mileage-based expense types)
      if (
        !item.itemTypeIsMileage &&
        item.locationRequired &&
        (!item.itemLocationObj ||
          Object.keys(item.itemLocationObj).length === 0)
      ) {
        Alert.alert(
          t("validation_error"),
          validationErrorMessages.location,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      }

      // Check for description
      if (item.descRequired && (!item.remark || !item.remark[0]?.text.trim())) {
        Alert.alert(
          t("validation_error"),
          validationErrorMessages.remark,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      }

      // Check for supplier
      if (item.supplierRequired && !item.expenseSupplierId) {
        Alert.alert(
          t("validation_error"),
          validationErrorMessages.supplier,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      }

      // Check for vATID
      if (item.vATRequired && (!item.vatID || !item.vatID.trim())) {
        Alert.alert(
          t("validation_error"),
          validationErrorMessages.vAT,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      }

      // Check for amount
      if (!item.amtBU?.amount) {
        Alert.alert(
          t("validation_error"),
          validationErrorMessages.amount,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      }

      // Check for claim amount exceeding allowed amount
      if (
        item.amtBU?.amount &&
        item.maxAmount &&
        item.amtBU?.amount > item.maxAmount
      ) {
        if (item.validateClaim === "E") {
          Alert.alert(
            t("validation_error"),
            validationErrorMessages.maxClaimAmount,
            [{ text: t("ok"), style: "cancel" }],
            { cancelable: false }
          );
          return false;
        }
        if (item.validateClaim === "W") {
          showToast(validationWarningMessages.maxClaimAmount, "warning");
        }
      }

      // Check for department or task requirement, ensuring only one is selected
      if (defaultAsHomeDefault === ".") {
        if (!item.taskId && !item.departmentId) {
          Alert.alert(
            t("validation_error"),
            validationErrorMessages.departmentOrTask,
            [{ text: t("ok"), style: "cancel" }],
            { cancelable: false }
          );
          return false;
        }

        if (item.taskId && item.departmentId) {
          Alert.alert(
            t("validation_error"),
            t("only_one_task_or_department_allowed"),
            [{ text: t("ok"), style: "cancel" }],
            { cancelable: false }
          );
          return false;
        }
      }

      // Check for department requirement
      if (defaultAsHomeDefault === "*" && !item.departmentId) {
        Alert.alert(
          t("validation_error"),
          validationErrorMessages.department,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      }

      // Check for task requirement
      if (
        defaultAsHomeDefault !== "*" &&
        defaultAsHomeDefault !== "." &&
        !item.taskId
      ) {
        Alert.alert(
          t("validation_error"),
          validationErrorMessages.task,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      }

      // Calculate total split percentage
      if (item.isSplit && item.splitPercent > 0) {
        hasSplitItems = true;
        totalSplitPercent += parseFloat(item.splitPercent);
      }
    }

    // Check for split percent
    if (hasSplitItems && !(totalSplitPercent === 100)) {
      Alert.alert(
        t("validation_error"),
        "Total split percentage of all classifications should be 100 %",
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    }

    return true;
  };

  const handleConfirm = () => {
    console.log("Temp Item before save:", JSON.stringify(tempItem));

    getSavedData(); // updates tempItem with data from both tabs
  };

  const getSavedData = () => {
    // call save function for both tabs
    if (expenseItemDetailsRef.current) {
      expenseItemDetailsRef.current.saveChanges();
    }

    if (expenseClassificationsRef.current) {
      expenseClassificationsRef.current.saveChanges();
    }

    setIsConfirming(true); // tempItem can be saved now
  };

  const finalizeConfirm = () => {
    if (!validateChanges()) {
      return;
    }

    console.log("Finalizing confirmation with:", JSON.stringify(tempItem));

    const updatedItem = { ...tempItem };

    if (!isEqual(updatedItem, initialItem)) {
      updatedItem.isDirty = true;
    }

    setTempItem(updatedItem);
    onConfirm(updatedItem);
  };

  useEffect(() => {
    if (isConfirming) {
      finalizeConfirm(); // Continue with the confirmation process

      setIsConfirming(false); // Reset confirming state
    }
  }, [tempItem, isConfirming]);

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <SafeAreaView
        style={styles.modalContainer}
        edges={["top", "right", "bottom", "left"]}
      >
        <Text style={styles.modalTitle} numberOfLines={1} ellipsizeMode="tail">
          {isItemEditMode
            ? isParentLocked
              ? "View Expense Item"
              : "Edit Expense Item"
            : "Create Expense Item"}
        </Text>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "item_details" && styles.activeTab,
            ]}
            onPress={() => handleSwitchTabs("item_details")}
          >
            <Text style={styles.tabText}>{t("item_details")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "classifications" && styles.activeTab,
            ]}
            onPress={() => handleSwitchTabs("classifications")}
          >
            <Text style={styles.tabText}>{t("classifications")}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          {activeTab === "item_details" ? (
            <ExpenseItemDetails
              ref={expenseItemDetailsRef}
              item={tempItem}
              setTempItem={setTempItem}
              setReceiptRequired={setReceiptRequired}
              isItemEditMode={isItemEditMode}
              isParentLocked={isParentLocked}
              expenseDetail={expenseDetail}
            />
          ) : (
            <ExpenseClassifications
              ref={expenseClassificationsRef}
              item={tempItem}
              setTempItem={setTempItem}
              isItemEditMode={isItemEditMode}
              isParentLocked={isParentLocked}
              expenseDetail={expenseDetail}
            />
          )}
        </ScrollView>
        <View style={styles.modalButtonsContainer}>
          <Button onPress={handleCancel} title={t("cancel")} />
          <Button
            title={t("confirm")}
            onPress={handleConfirm}
            disabled={isParentLocked}
          />
        </View>
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
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: "4%",
    textAlign: "center",
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  tabButton: {
    padding: 10,
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  activeTab: {
    borderColor: "#005eb8",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    textTransform: "uppercase",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: "4%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 6,
  },
  modalButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 20,
  },
});

export default ExpenseDetailItemEditor;
