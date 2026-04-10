import React, {
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";

import { Alert, StyleSheet, Text, View } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

import {
  API_ENDPOINTS,
  APP,
  APP_ACTIVITY_ID,
  APP_NAME,
  BUSOBJCAT,
  BUSOBJCATMAP,
  INTSTATUS,
  PREFERRED_LANGUAGES,
  TEST_MODE,
} from "../constants";

import {
  fetchBusObjCatData,
  fetchData,
  getAppNameByCategory,
  isDoNotReplaceAnyList,
} from "../utils/APIUtils";

import { setOrClearLock } from "../utils/LockUtils";
import { showToast } from "../utils/MessageUtils";
import { screenDimension } from "../utils/ScreenUtils";
import updateFields from "../utils/UpdateUtils";
import { documentStatusCheck } from "../utils/WorkflowUtils";
import {
  changeDateToAPIFormat,
  convertAmountToDisplayFormat,
  getRemarkText,
  isEqual,
} from "../utils/FormatUtils";

import ExpenseDetailKeyInfo from "./ExpenseDetailKeyInfo";
import ExpenseDetailItemsTab from "./ExpenseDetailItemsTab";

import CustomButton from "../components/CustomButton";

import File from "./File";
import Comment from "./Comment";
import History from "./History";

import CustomBackButton from "../components/CustomBackButton";
import Loader from "../components/Loader";

import { useExpenseForceRefresh } from "../../context/ForceRefreshContext";
import { LoggedInUserInfoContext } from "../../context/LoggedInUserInfoContext";
import { useExpenseSave } from "../../context/SaveContext";
import { fetchCurrency, fetchEmployeeDetails } from "../utils/ExpenseUtils";

const Tab = createMaterialTopTabNavigator();

const ExpenseDetail = ({ route, navigation }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { loggedInUserInfo } = useContext(LoggedInUserInfoContext);

  const { updateForceRefresh } = useExpenseForceRefresh();

  const { notifySave } = useExpenseSave();

  const updatedValuesRef = useRef({});

  const statusTemplateExtId = route?.params?.statusTemplateExtId;

  const [expenseId, setExpenseId] = useState(route?.params?.expenseId);
  // Determine if the component is in edit mode (if expense id is provided)
  // True if editing existing expense, false if creating a new one
  const [isEditMode, setIsEditMode] = useState(!!expenseId);
  const [itemStatusIDMap, setItemStatusIDMap] = useState(null);
  const [currentStatus, setCurrentStatus] = useState({});
  const [listOfNextStatus, setListOfNextStatus] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updatedValues, setUpdatedValues] = useState({});

  const [expenseExtID, setExpenseExtID] = useState();
  const [expenseComments, setExpenseComments] = useState([]);
  const [expenseFiles, setExpenseFiles] = useState([]);
  const [expenseHeaderReceipts, setExpenseHeaderReceipts] = useState([]);
  const [expenseType, setExpenseType] = useState("");
  const [receiptRequired, setReceiptRequired] = useState(false);
  const [defaultAsHomeDefault, setDefaultAsHomeDefault] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("");
  const [empCurrency, setEmpCurrency] = useState("");
  const [allowedExpenseTypes, setAllowedExpenseTypes] = useState([]);
  const [taxTypes, setTaxTypes] = useState([]);
  const [currencyUnits, setCurrencyUnits] = useState([]);
  const [expenseTypeSingleProject, setExpenseTypeSingleProject] =
    useState(false);
  const [expenseTypeSingleCustomer, setExpenseTypeSingleCustomer] =
    useState(false);
  const [expenseExtStatus, setExpenseExtStatus] = useState({});
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [expenseDueDate, setExpenseDueDate] = useState();
  const [expenseStart, setExpenseStart] = useState(null);
  const [expenseEnd, setExpenseEnd] = useState(null);
  const [expenseRemark, setExpenseRemark] = useState("");
  const [expenseCompanyId, setExpenseCompanyId] = useState("");
  const [expenseCompanyName, setExpenseCompanyName] = useState("");
  const [expenseCompanyIsVatRegistered, setExpenseCompanyIsVatRegistered] =
    useState(false);
  const [expenseCompanyIsTaxExempt, setExpenseCompanyIsTaxExempt] =
    useState(false);
  const [expenseEmployeeId, setExpenseEmployeeId] = useState("");
  const [expensePaidAmt, setExpensePaidAmt] = useState("");
  const [expenseAmtDue, setExpenseAmtDue] = useState("");
  const [expenseAmountBU, setExpenseAmountBU] = useState("");
  const [expenseAmtDueBU, setExpenseAmtDueBU] = useState("");
  const [expenseTotalReimbursible, setExpenseTotalReimbursible] = useState("");
  const [expenseTotalReimbursibleBU, setExpenseTotalReimbursibleBU] =
    useState("");
  const [expenseClassifications, setExpenseClassifications] = useState([]);

  const [expenseAmountBUObj, setExpenseAmountBUObj] = useState({});
  const [expensePaidAmtObj, setExpensePaidAmtObj] = useState({});
  const [expenseAmtDueObj, setExpenseAmtDueObj] = useState({});

  /**
   * This function checks if there are unsaved changes by verifying if the `updatedValuesRef` object has any keys.
   * It uses the `useCallback` hook to ensure the function is only recreated when necessary, optimizing performance.
   *
   * @param {Object} updatedValuesRef - A reference object containing updated values. If it has any keys, it indicates unsaved changes.
   *
   * @returns {boolean} - Returns `true` if there are unsaved changes, otherwise `false`.
   */
  const hasUnsavedChanges = useCallback(() => {
    console.log(
      "Updated values reference (if any) in hasUnsavedChanges: ",
      JSON.stringify(updatedValuesRef)
    );

    return Object.keys(updatedValuesRef.current).length > 0;
  }, [updatedValuesRef]);

  const showUnsavedChangesAlert = (onDiscard) => {
    Alert.alert(
      t("unsaved_changes_title"),
      t("unsaved_changes_message"),
      [
        {
          text: t("cancel"),
          style: "cancel",
        },
        {
          text: t("discard"),
          style: "destructive",
          onPress: () => {
            // Reset updatedValuesRef.current and call onDiscard
            updatedValuesRef.current = {};
            setUpdatedValues({});
            onDiscard();
          },
        },
      ],
      { cancelable: false }
    );
  };

  const handleSave = async () => {
    try {
      const isValidExpense = validateExpenseOnSave();

      if (isValidExpense) {
        await updateExpense(updatedValues);
      }
    } catch (error) {
      console.error("Error in saving expense", error);
    }
  };

  const validateExpenseOnSave = () => {
    if (!expenseStart) {
      Alert.alert(
        t("validation_error"),
        t("timesheet_start_required_message"),
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    }

    if (!expenseEnd) {
      Alert.alert(
        t("validation_error"),
        t("timesheet_end_required_message"),
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    }

    if (!expenseCompanyId) {
      Alert.alert(
        t("validation_error"),
        t("timesheet_company_required_message"),
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    }

    if (!expenseEmployeeId) {
      Alert.alert(
        t("validation_error"),
        t("timesheet_employee_required_message"),
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    }

    const headerRemarkText = getRemarkText(
      expenseRemark,
      lang,
      PREFERRED_LANGUAGES
    );

    if (!headerRemarkText) {
      Alert.alert(
        t("validation_error"),
        "Expense description is required.",
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    }

    if (!expenseAmountBU) {
      Alert.alert(
        t("validation_error"),
        "Expense amount is required.",
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    }

    if (
      receiptRequired &&
      !updatedValues?.current?.classifications?.[0]?.items?.[0]?.expenseData
        ?.receipts
    ) {
      Alert.alert(
        t("validation_error"),
        "Receipt is required for one of the items.",
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    }

    return true;
  };

  const updateExpense = async (updatedValues = {}) => {
    try {
      const prefixedUpdatedValues = {};
      for (const key in updatedValues) {
        prefixedUpdatedValues[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-${key}`] =
          updatedValues[key];
      }

      // Add the prefixed updated values to the formData
      const formData = {
        data: {
          [`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-id`]: expenseId,
          ...prefixedUpdatedValues,
        },
      };

      const queryStringParams = {
        userID: APP.LOGIN_USER_ID,
        client: APP.LOGIN_USER_CLIENT,
        language: APP.LOGIN_USER_LANGUAGE,
        testMode: TEST_MODE,
        component: "platform",
        doNotReplaceAnyList: isDoNotReplaceAnyList(BUSOBJCAT.EXPENSE),
        appName: JSON.stringify(getAppNameByCategory(BUSOBJCAT.EXPENSE)),
      };

      const updateResponse = await updateFields(formData, queryStringParams);

      // Check if update was successful
      if (updateResponse.success) {
        // Extract the new ID from the response
        const newId = updateResponse.response?.details[0]?.data?.ids?.[0];
        const newExtID =
          updateResponse.response?.details[0]?.messages[0]?.message_params
            ?.extID;

        if (newId) {
          setExpenseId(newId); // Update with the new ID
          setExpenseExtID(newExtID);
          setIsEditMode(true);
        }

        // Clear updatedValuesRef.current and updatedValues state
        updatedValuesRef.current = {};
        setUpdatedValues({});

        handleReload(); // Call handleReload after saving

        // force refresh expense data on list screen
        updateForceRefresh(true);

        // Notify that save was clicked
        notifySave();

        if (lang !== "en") {
          showToast(t("update_success"));
        }

        updateForceRefresh(true);

        if (updateResponse.message) {
          showToast(updateResponse.message);
        }
      } else {
        showToast(t("update_failure"), "error");
      }
    } catch (error) {
      console.error("Error in updateExpense of ExpenseDetail", error);
      showToast(t("unexpected_error"), "error");
    }
  };

  /**
   * Handles reloading the expense data.
   * - Fetches the latest expense data if there are no unsaved changes.
   * - Shows an alert to confirm discarding unsaved changes before fetching data.
   */
  const handleReload = () => {
    const reloadData = () => {
      fetchExpense(); // Fetch the latest expense data
    };

    hasUnsavedChanges() ? showUnsavedChangesAlert(reloadData) : reloadData();
  };

  const getExpenseFields = () => [
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-id`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-extID`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-type`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-type:ExpenseClaimType-defaultAsHomeDefault`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-type:ExpenseClaimType-singleProject`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-type:ExpenseClaimType-singleCustomer`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-type:ExpenseClaimType-allowedExpenseTypes`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-extStatus`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-busUnitID`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-busUnitID:BusUnit-name-text`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-busUnitID:BusUnit-companySettings-vatRegistered`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-busUnitID:BusUnit-companySettings-taxExempt`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-busUnitID:BusUnit-companySettings-baseCurrency`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-employeeID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-employeeID:Resource-financeData-reimbursementCurrency`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-headerReceipts`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-files`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-comments`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-date`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-start`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-end`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-remark`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-dueDate`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-paidAmt`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-amountBU`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-amtDue`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-amtDueBU`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-totalReimbursible`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-totalReimbursibleBU`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-payments`,
    // `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-customerID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-customerID:Customer-name-text`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-projectWbsID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-projectWbsID:ProjectWBS-text-text`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-projectWbsID:ProjectWBS-extID`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-billable`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-amountBU`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-department`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-department:BusUnit-extID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-department:BusUnit-name-text`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-taskID`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-taskID:Task-text-text`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-invoiceRef`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-remark`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-isSplit`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-sortSeq`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-splitAmt`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-totalAcrossSplits`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-amtReimburse`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-splitPercent`,
    // `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-expenseData`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-expenseData-type`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-type:ExpenseType-name`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-type:ExpenseType-id`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-type:ExpenseType-isQtyBased`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-type:ExpenseType-isMileage`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-type:ExpenseType-isRateBased`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-type:ExpenseType-nonReimbursible`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-incurredOn`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-expenseData-amt`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-amtBU`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-expenseData-qty`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-unitAmt`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-taxBase`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-taxBaseBU`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-taxAmt`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-taxAmtBU`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-taxRate`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-vatID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-taxCode`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-taxCode:TaxCode-text`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-reimbursible`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-location`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-location-locationID:Location-extID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-receipts`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-supplierID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-expenseData-supplierID:ExpenseSupplier-extID`,
    // `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-mileage`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-mileage-startLocation`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-mileage-startLocation-locationID:Location-extID`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-mileage-endLocation`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-mileage-endLocation-locationID:Location-extID`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-mileage-calcDist`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-mileage-expensedDist`,
    `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications-items-mileage-unitAmt`,
    `${
      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
    }-classifications-items-mileage-returnTrip`,
  ];

  const fetchExpenseClaimTypeDetails = async () => {
    try {
      const queryFields = {
        fields: [
          "ExpenseClaimType-extID",
          "ExpenseClaimType-defaultAsHomeDefault",
          "ExpenseClaimType-allowedExpenseTypes",
          "ExpenseClaimType-singleCustomer",
          "ExpenseClaimType-singleProject",
        ],
        where: [
          {
            fieldName: "ExpenseClaimType-extID",
            operator: "=",
            value: "ExpenseClaim",
          },
        ],
      };

      const commonQueryParams = {
        testMode: TEST_MODE,
        client: parseInt(APP.LOGIN_USER_CLIENT),
        user: APP.LOGIN_USER_ID,
        userID: APP.LOGIN_USER_ID,
        language: APP.LOGIN_USER_LANGUAGE,
        intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      };

      const formData = {
        query: JSON.stringify(queryFields),
        ...commonQueryParams,
      };

      const response = await fetchData(
        API_ENDPOINTS.QUERY,
        "POST",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        new URLSearchParams(formData).toString()
      );

      if (
        response.success === true &&
        Array.isArray(response.data) &&
        response.data.length > 0
      ) {
        const data = response.data[0];

        if (data) {
          setExpenseType(data["ExpenseClaimType-extID"] || "");
          setDefaultAsHomeDefault(
            data["ExpenseClaimType-defaultAsHomeDefault"] || ""
          );
          setAllowedExpenseTypes(
            data["ExpenseClaimType-allowedExpenseTypes"] || ""
          );
          setExpenseTypeSingleCustomer(
            data["ExpenseClaimType-singleCustomer"] || ""
          );
          setExpenseTypeSingleProject(
            data["ExpenseClaimType-singleProject"] || ""
          );
        }
      } else {
        console.error("Unexpected response format or empty data array.");
        showToast(t("error_fetching_data"), "error");
      }
    } catch (error) {
      console.error("Error in fetchExpenseClaimTypeDetails:", error);
    }
  };

  const fetchExpenseCompanyDetails = async (companyId) => {
    try {
      const queryFields = {
        fields: [
          "BusUnit-name-text",
          "BusUnit-companySettings-vatRegistered",
          "BusUnit-companySettings-baseCurrency",
          "BusUnit-companySettings-taxExempt",
        ],
        where: [
          {
            fieldName: "BusUnit-id",
            operator: "=",
            value: companyId,
          },
        ],
      };

      const commonQueryParams = {
        testMode: TEST_MODE,
        client: parseInt(APP.LOGIN_USER_CLIENT),
        user: APP.LOGIN_USER_ID,
        userID: APP.LOGIN_USER_ID,
        language: APP.LOGIN_USER_LANGUAGE,
        intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      };

      const formData = {
        query: JSON.stringify(queryFields),
        ...commonQueryParams,
      };

      const response = await fetchData(
        API_ENDPOINTS.QUERY,
        "POST",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        new URLSearchParams(formData).toString()
      );

      if (
        response.success === true &&
        Array.isArray(response.data) &&
        response.data.length > 0
      ) {
        const data = response.data[0];

        if (data) {
          setExpenseCompanyName(data["BusUnit-name-text"] || "");
          setExpenseCompanyIsTaxExempt(
            data["BusUnit-companySettings-taxExempt"] || ""
          );
          setExpenseCompanyIsVatRegistered(
            data["BusUnit-companySettings-vatRegistered"] || ""
          );
          setBaseCurrency(data["BusUnit-companySettings-baseCurrency"] || "");
          setTaxTypes(data["BusUnit-companySettings-taxTypes"] || "");
        }
      } else {
        console.error("Unexpected response format or empty data array.");
        showToast(t("error_fetching_data"), "error");
      }
    } catch (error) {
      console.error("Error in fetchExpenseCompanyDetails:", error);
    }
  };

  const getCurrencies = async () => {
    try {
      const formattedCurrencies = await fetchCurrency();
      if (formattedCurrencies) {
        setCurrencyUnits(formattedCurrencies);
      }
    } catch (error) {
      console.error("Error in getCurrencies:", error);
    }
  };

  const loadExpenseCreateDetail = async () => {
    try {
      if (!loggedInUserInfo.workScheduleExtId) {
        showToast(t("no_workschedule_assigned"), "error");
        return;
      }

      await fetchExpenseCompanyDetails(loggedInUserInfo.companyId);
      await fetchExpenseClaimTypeDetails();
      await getCurrencies();
      const employeeData = await fetchEmployeeDetails(
        APP.LOGIN_USER_EMPLOYEE_ID
      );
      const empCurrency =
        employeeData["Resource-financeData-reimbursementCurrency"] || "";

      setExpenseCompanyId(loggedInUserInfo.companyId);
      setExpenseEmployeeId(APP.LOGIN_USER_EMPLOYEE_ID);
      setEmpCurrency(empCurrency);
      setExpenseStart(new Date());
      setExpenseEnd(new Date());

      const updatedChanges = { ...updatedValues };

      updatedChanges["type"] = "ExpenseClaim";
      updatedChanges["busUnitID"] = loggedInUserInfo.companyId;
      updatedChanges["employeeID"] = APP.LOGIN_USER_EMPLOYEE_ID;
      updatedChanges["responsible"] = loggedInUserInfo.personId;
      updatedChanges["start"] = changeDateToAPIFormat(new Date());
      updatedChanges["end"] = changeDateToAPIFormat(new Date());
      updatedChanges["purchaseOrderDate"] = changeDateToAPIFormat(new Date());

      // Update the ref
      updatedValuesRef.current = updatedChanges;
      // Update the changes state
      setUpdatedValues(updatedChanges);

      await documentStatusCheck(
        t,
        APP_ACTIVITY_ID.EXPENSE,
        BUSOBJCATMAP[BUSOBJCAT.EXPENSE],
        expenseId,
        "ExpenseClaim",
        null, // Expense extStatus
        setCurrentStatus,
        setListOfNextStatus
      );
    } catch (error) {
      console.error("Error in loading expense create detail: ", error);
    }
  };

  const loadExpenseDetail = async () => {
    try {
      const queryFields = {
        fields: getExpenseFields(),
        where: [
          {
            fieldName: `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-id`,
            operator: "=",
            value: expenseId,
          },
        ],
      };

      const commonQueryParams = {
        testMode: TEST_MODE,
        client: parseInt(APP.LOGIN_USER_CLIENT),
        user: APP.LOGIN_USER_ID,
        userID: APP.LOGIN_USER_ID,
        language: APP.LOGIN_USER_LANGUAGE,
        intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      };

      const formData = {
        query: JSON.stringify(queryFields),
        ...commonQueryParams,
      };

      const response = await fetchData(
        API_ENDPOINTS.QUERY,
        "POST",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        new URLSearchParams(formData).toString()
      );

      if (
        response.success === true &&
        response.data &&
        response.data instanceof Array &&
        response.data.length > 0
      ) {
        const data = response.data[0];

        setExpenseExtID(data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-extID`]);
        setExpenseFiles(data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-files`]);
        setExpenseHeaderReceipts(
          data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-headerReceipts`]
        );
        setExpenseComments(data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-comments`]);
        setExpenseCompanyId(
          data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-busUnitID`]
        );
        setExpenseCompanyName(
          data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-busUnitID:BusUnit-name-text`]
        );
        setExpenseCompanyIsVatRegistered(
          data[
            `${
              BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
            }-busUnitID:BusUnit-companySettings-vatRegistered`
          ]
        );
        setExpenseCompanyIsTaxExempt(
          data[
            `${
              BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
            }-busUnitID:BusUnit-companySettings-taxExempt`
          ]
        );
        setBaseCurrency(
          data[
            `${
              BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
            }-busUnitID:BusUnit-companySettings-baseCurrency`
          ]
        );
        setTaxTypes(
          data[
            `${
              BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
            }-busUnitID:BusUnit-companySettings-taxTypes`
          ]
        );
        setExpenseEmployeeId(
          data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-employeeID`]
        );
        setEmpCurrency(
          data[
            `${
              BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
            }-employeeID:Resource-financeData-reimbursementCurrency`
          ]
        );

        setExpenseDate(data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-date`]);
        setExpenseDueDate(data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-dueDate`]);
        setExpenseStart(data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-start`]);
        setExpenseEnd(data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-end`]);
        setExpenseRemark(data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-remark`]);

        setDefaultAsHomeDefault(
          data[
            `${
              BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
            }-type:ExpenseClaimType-defaultAsHomeDefault`
          ]
        );
        setExpenseTypeSingleCustomer(
          data[
            `${
              BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
            }-type:ExpenseClaimType-singleCustomer`
          ]
        );
        setExpenseTypeSingleProject(
          data[
            `${
              BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
            }-type:ExpenseClaimType-singleProject`
          ]
        );
        setAllowedExpenseTypes(
          data[
            `${
              BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
            }-type:ExpenseClaimType-allowedExpenseTypes`
          ]
        );

        const amountBUObj = data[
          `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-amountBU`
        ] || {
          amount: 0,
          currency: null,
        };
        const convertedAmountBU =
          convertAmountToDisplayFormat(amountBUObj) || "";
        setExpenseAmountBU(convertedAmountBU);
        setExpenseAmountBUObj(amountBUObj);

        const paidAmtObj = data[
          `${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-paidAmt`
        ] || {
          amount: 0,
          currency: null,
        };
        const convertedPaidAmt = convertAmountToDisplayFormat(paidAmtObj) || 0;
        setExpensePaidAmtObj(paidAmtObj);
        setExpensePaidAmt(convertedPaidAmt);

        const amtDueObj = data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-amtDue`] || {
          amount: 0,
          currency: null,
        };
        const convertedAmtDue = convertAmountToDisplayFormat(amtDueObj) || 0;
        setExpenseAmtDue(convertedAmtDue);
        setExpenseAmtDueObj(amtDueObj);

        setExpenseAmtDueBU(
          data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-amtDueBU`] || {
            amount: 0,
            currency: null,
          }
        );
        setExpenseTotalReimbursible(
          data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-totalReimbursible`] || {
            amount: 0,
            currency: null,
          }
        );
        setExpenseTotalReimbursibleBU(
          data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-totalReimbursibleBU`] || {
            amount: 0,
            currency: null,
          }
        );

        setExpenseClassifications(
          data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-classifications`]
        );

        const fetchedExpenseExtStatus =
          data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-extStatus`] || {};
        setExpenseExtStatus(fetchedExpenseExtStatus);

        const fetchedExpenseType =
          data[`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-type`] || "";
        setExpenseType(fetchedExpenseType);

        const { changeAllowed } = await documentStatusCheck(
          t,
          APP_ACTIVITY_ID.EXPENSE,
          BUSOBJCATMAP[BUSOBJCAT.EXPENSE],
          expenseId,
          fetchedExpenseType,
          fetchedExpenseExtStatus,
          setCurrentStatus,
          setListOfNextStatus
        );

        await getCurrencies();

        if (!changeAllowed) {
          setIsLocked(true);
        } else {
          setOrClearLock(
            "set",
            BUSOBJCATMAP[BUSOBJCAT.EXPENSE],
            expenseId,
            setIsLocked,
            setLoading
          );
        }
      }
    } catch (error) {
      console.error("Error in loading expense detail: ", error);
    }
  };

  const handleExpenseDetailChange = (values) => {
    if (!expenseType) {
      return;
    }

    console.log(`Updated values in Expense Detail: ${JSON.stringify(values)}`);

    const updatedChanges = { ...updatedValues };

    if (
      values.expenseRemark !== undefined &&
      !isEqual(values.expenseRemark, expenseRemark)
    ) {
      setExpenseRemark(values.expenseRemark);
      updatedChanges["remark:text"] = getRemarkText(
        values.expenseRemark,
        lang,
        PREFERRED_LANGUAGES
      );
    }
    if (
      values.expenseDate !== undefined &&
      !isEqual(values.expenseDate, expenseDate)
    ) {
      setExpenseDate(values.expenseDate);
      updatedChanges["date"] = values.expenseDate;
    }
    if (
      values.expenseDueDate !== undefined &&
      !isEqual(values.expenseDueDate, expenseDueDate)
    ) {
      setExpenseDueDate(values.expenseDueDate);
      updatedChanges["dueDate"] = values.expenseDueDate;
    }

    if (values.expenseClassifications !== undefined) {
      if (!isEqual(values.expenseClassifications, expenseClassifications)) {
        setExpenseClassifications(values.expenseClassifications);
      }
      updatedChanges["classifications"] = values.expenseClassifications;
    }

    if (values.expenseAmountBU !== undefined) {
      const convertedAmountBU = convertAmountToDisplayFormat(
        values.expenseAmountBU
      );
      if (!isEqual(convertedAmountBU, expenseAmountBU)) {
        setExpenseAmountBU(convertedAmountBU);
      }
      setExpenseAmountBUObj(values.expenseAmountBU);
      updatedChanges["amountBU"] = values.expenseAmountBU;
    }

    if (values.expenseAmtDue !== undefined) {
      const convertedAmtDue = convertAmountToDisplayFormat(
        values.expenseAmtDue
      );
      if (!isEqual(convertedAmtDue, expenseAmtDue)) {
        setExpenseAmtDue(convertedAmtDue);
      }
      setExpenseAmtDueObj(values.expenseAmtDue);
      updatedChanges["amtDue"] = values.expenseAmtDue;
    }

    if (values.expensePaidAmt !== undefined) {
      const convertedPaidAmt = convertAmountToDisplayFormat(
        values.expensePaidAmt
      );
      if (!isEqual(convertedPaidAmt, expensePaidAmt)) {
        setExpensePaidAmt(convertedPaidAmt);
      }
      setExpensePaidAmtObj(values.expensePaidAmt);
      updatedChanges["paidAmt"] = values.expensePaidAmt;
    }

    if (values.amtDueBU !== undefined) {
      if (!isEqual(values.amtDueBU, expenseAmtDueBU)) {
        setExpenseAmtDueBU(values.amtDueBU);
      }
      updatedChanges["amtDueBU"] = values.amtDueBU;
    }

    if (values.totalReimbursible !== undefined) {
      if (!isEqual(values.totalReimbursible, expenseTotalReimbursible)) {
        setExpenseTotalReimbursible(values.totalReimbursible);
      }
      updatedChanges["totalReimbursible"] = values.totalReimbursible;
    }

    if (values.totalReimbursibleBU !== undefined) {
      if (!isEqual(values.totalReimbursibleBU, expenseTotalReimbursibleBU)) {
        setExpenseTotalReimbursibleBU(values.totalReimbursibleBU);
      }
      updatedChanges["totalReimbursibleBU"] = values.totalReimbursibleBU;
    }

    if (
      values.expenseFiles !== undefined &&
      !isEqual(values.expenseFiles, expenseFiles)
    ) {
      setExpenseFiles(values.expenseFiles);
      updatedChanges["files"] = values.expenseFiles;
    }

    if (
      values.expenseHeaderReceipts !== undefined &&
      !isEqual(values.expenseHeaderReceipts, expenseHeaderReceipts)
    ) {
      setExpenseHeaderReceipts(values.expenseHeaderReceipts);
      updatedChanges["headerReceipts"] = values.expenseHeaderReceipts;
    }

    if (
      values.expenseComments !== undefined &&
      !isEqual(values.expenseComments, expenseComments)
    ) {
      setExpenseComments(values.expenseComments);
      updatedChanges["comments"] = values.expenseComments;
    }

    console.log(`Updated values in Expense Detail: ${JSON.stringify(values)}`);

    // Update the ref
    updatedValuesRef.current = updatedChanges;
    // Update the changes state
    setUpdatedValues(updatedChanges);
  };

  const fetchProcessTemplate = async () => {
    if (!statusTemplateExtId) {
      setItemStatusIDMap({});
      return;
    }

    try {
      const queryFields = {
        fields: [
          "ProcessTemplate-id",
          "ProcessTemplate-extID",
          "ProcessTemplate-steps",
        ],
      };

      const whereConditions = [];
      const orConditions = [];

      whereConditions.push({
        fieldName: "ProcessTemplate-extID",
        operator: "=",
        value: statusTemplateExtId,
      });

      const response = await fetchBusObjCatData(
        "ProcessTemplate",
        null,
        null,
        queryFields,
        whereConditions,
        orConditions
      );

      let statusLabelAndStepMap = {};

      if (!response.error && response.data) {
        statusLabelAndStepMap = createExtIdStatusLabelMap(response.data);
      } else {
        console.error("Error fetching process template data:", response.error);
      }

      setItemStatusIDMap(statusLabelAndStepMap);
    } catch (error) {
      console.error("Error fetching process template data:", error);
    }
  };

  /**
   * Creates a map of extID and associated status labels.
   *
   * @param {Array} data - Process template data.
   * @returns {Object} - Map of extID and status labels.
   */
  const createExtIdStatusLabelMap = (data) => {
    const extIdStatusLabelMap = {};

    // Loop through each returned process template
    data.forEach((processTemplate) => {
      const steps = processTemplate["ProcessTemplate-steps"];

      // Check if steps is not null and is an array
      if (steps && Array.isArray(steps)) {
        // Loop through steps in each process template
        steps.forEach((step) => {
          const { extID, statusLabel } = step;
          // Add the extID and statusLabel to the map
          extIdStatusLabelMap[extID] = statusLabel;
        });
      }
    });

    return extIdStatusLabelMap;
  };

  const fetchExpense = async () => {
    setLoading(true);

    try {
      await Promise.all([
        isEditMode ? loadExpenseDetail() : loadExpenseCreateDetail(),
        fetchProcessTemplate(),
      ]);
    } catch (error) {
      console.error("Error in either loading expense details: ", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isEditMode) {
      Alert.alert(
        t("confirm_deletion_title"),
        t("confirm_deletion_message"),
        [
          {
            text: t("cancel"),
            style: "cancel",
          },
          {
            text: t("confirm"),
            onPress: async () => {
              try {
                const formData = {
                  data: {
                    [`${
                      BUSOBJCATMAP[BUSOBJCAT.EXPENSE]
                    }-component`]: `Client-${APP.LOGIN_USER_CLIENT}-all`,
                    [`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-extID`]: "",
                    [`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-id`]: expenseId,
                    [`${BUSOBJCATMAP[BUSOBJCAT.EXPENSE]}-intStatus`]: 3,
                  },
                };

                const queryStringParams = {
                  language: APP.LOGIN_USER_LANGUAGE,
                  userID: APP.LOGIN_USER_ID,
                  appName: APP_NAME.EXPENSE,
                  client: APP.LOGIN_USER_CLIENT,
                };

                const updateResponse = await updateFields(
                  formData,
                  queryStringParams
                );

                // Check if update was successful
                if (updateResponse.success) {
                  if (i18n.language !== "en") {
                    showToast(t("delete_success"));
                  }

                  updateForceRefresh(true);

                  // Go back to the previous screen
                  navigation.goBack();
                } else {
                  showToast(t("delete_failure"), "error");
                }

                if (updateResponse.message) {
                  showToast(updateResponse.message);
                }
              } catch (error) {
                console.error("Error in handleDelete of ExpenseDetail", error);
                showToast(t("unexpected_error"), "error");
              }
            },
          },
        ],
        { cancelable: true } // Allow the dialog to be canceled by tapping outside of it
      );
    }
  };

  const handleLock = async () => {
    if (isEditMode) {
      const { changeAllowed } = await documentStatusCheck(
        t,
        APP_ACTIVITY_ID.EXPENSE,
        BUSOBJCATMAP[BUSOBJCAT.EXPENSE],
        expenseId,
        expenseType,
        expenseExtStatus,
        setCurrentStatus,
        setListOfNextStatus
      );

      if (!changeAllowed) {
        return;
      }

      const action = isLocked ? "set" : "clear";
      setOrClearLock(
        action,
        BUSOBJCATMAP[BUSOBJCAT.EXPENSE],
        expenseId,
        setIsLocked,
        setLoading
      );
    }
  };

  /**
   * Memoized function to render the headerLeft with CustomBackButton and title text.
   * The function re-renders only when `hasUnsavedChanges`, `isEditMode`, or `t` changes.
   */
  const headerLeft = useCallback(() => {
    return (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton
          navigation={navigation}
          hasUnsavedChanges={hasUnsavedChanges()}
          t={t}
        />
        <Text
          style={styles.headerLeftText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {isEditMode
            ? isLocked
              ? t("expense_view")
              : t("expense_edit")
            : t("expense_create")}
        </Text>
      </View>
    );
  }, [hasUnsavedChanges, isEditMode, isLocked, t]);

  /**
   * Memoized function to render the headerRight with multiple buttons.
   * The function re-renders only when `isEditMode`, `isLocked`, `loading`, `updatedValues` change
   */
  const headerRight = useCallback(() => {
    return (
      <View style={styles.headerRightContainer}>
        <CustomButton
          onPress={handleLock}
          label=""
          icon={{
            name: isLocked ? "lock" : "lock-open-variant",
            library: "MaterialCommunityIcons",
            size: 24,
          }}
          disabled={!isEditMode || loading}
        />
        <CustomButton
          onPress={handleReload}
          label=""
          icon={{
            name: "refresh-circle",
            library: "MaterialCommunityIcons",
            size: 24,
          }}
          disabled={!isEditMode || loading}
        />
        <CustomButton
          onPress={handleDelete}
          label=""
          icon={{
            name: "delete",
            library: "MaterialCommunityIcons",
            size: 24,
          }}
          disabled={!isEditMode || loading || isLocked}
        />
        <CustomButton
          onPress={handleSave}
          label=""
          icon={{
            name: "content-save",
            library: "MaterialCommunityIcons",
            size: 24,
          }}
          disabled={
            loading || isLocked || Object.keys(updatedValues).length === 0
          }
        />
      </View>
    );
  }, [isEditMode, isLocked, loading, updatedValues]);

  /**
   * Sets the header options for the screen, including the custom headerLeft and headerRight components.
   * This useEffect will run whenever dependencies in the header functions change.
   */
  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft: headerLeft,
      headerRight: headerRight,
    });
  }, [headerLeft, headerRight, navigation]);

  useEffect(() => {
    if (!loggedInUserInfo.workScheduleExtId) {
      showToast(t("no_workschedule_assigned"), "error");
      return;
    }

    fetchExpense();

    return () => {
      if (isEditMode) {
        setOrClearLock(
          "clear",
          BUSOBJCATMAP[BUSOBJCAT.EXPENSE],
          expenseId,
          setIsLocked,
          setLoading
        );
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {loading ? (
        <Loader />
      ) : (
        <>
          <Tab.Navigator
            screenOptions={{
              swipeEnabled: false,
            }}
          >
            <Tab.Screen
              name={t("key_info")}
              options={{
                tabBarLabel: ({ focused, color }) => (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      color,
                      fontSize: 14,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("key_info")}
                  </Text>
                ),
              }}
            >
              {() => (
                <GestureHandlerRootView>
                  <ExpenseDetailKeyInfo
                    navigation={navigation}
                    busObjCat={BUSOBJCAT.EXPENSE}
                    busObjId={expenseId}
                    isParentLocked={isLocked}
                    isEditMode={isEditMode}
                    currentStatus={currentStatus}
                    listOfNextStatus={listOfNextStatus}
                    handleReload={handleReload}
                    loading={loading}
                    setLoading={setLoading}
                    onExpenseDetailChange={handleExpenseDetailChange}
                    expenseDetail={{
                      expenseExtID,
                      expenseType,
                      expenseExtStatus,
                      expenseCompanyName,
                      expenseDueDate,
                      expenseDate,
                      expenseRemark,
                      expenseAmountBU,
                      expensePaidAmt,
                      expenseAmtDue,
                    }}
                  />
                </GestureHandlerRootView>
              )}
            </Tab.Screen>
            <Tab.Screen
              name={t("items")}
              options={{
                tabBarLabel: ({ focused, color }) => (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      color,
                      fontSize: 14,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("items")}
                  </Text>
                ),
              }}
            >
              {() => (
                <GestureHandlerRootView>
                  <ExpenseDetailItemsTab
                    navigation={navigation}
                    busObjCat={BUSOBJCAT.EXPENSE}
                    busObjId={expenseId}
                    isParentLocked={isLocked}
                    isEditMode={isEditMode}
                    currentStatus={currentStatus}
                    listOfNextStatus={listOfNextStatus}
                    handleReload={handleReload}
                    loading={loading}
                    setLoading={setLoading}
                    setReceiptRequired={setReceiptRequired}
                    onExpenseDetailChange={handleExpenseDetailChange}
                    expenseDetail={{
                      expenseType,
                      expenseStart,
                      expenseCompanyId,
                      baseCurrency,
                      empCurrency,
                      expenseTypeSingleCustomer,
                      expenseTypeSingleProject,
                      defaultAsHomeDefault,
                      allowedExpenseTypes,
                      taxTypes,
                      currencyUnits,
                      expenseCompanyIsTaxExempt,
                      expenseCompanyIsVatRegistered,
                      expenseClassifications,
                    }}
                  />
                </GestureHandlerRootView>
              )}
            </Tab.Screen>
            <Tab.Screen
              name={t("files")}
              options={{
                tabBarLabel: ({ focused, color }) => (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      color,
                      fontSize: 14,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("files")}
                  </Text>
                ),
              }}
            >
              {() => (
                <File
                  busObjCat={BUSOBJCAT.EXPENSE}
                  busObjId={expenseId}
                  initialFilesIdList={expenseHeaderReceipts}
                  isParentLocked={isLocked}
                />
              )}
            </Tab.Screen>
            <Tab.Screen
              name={t("comments")}
              options={{
                tabBarLabel: ({ focused, color }) => (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      color,
                      fontSize: 14,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("comments")}
                  </Text>
                ),
              }}
            >
              {() => (
                <Comment
                  busObjCat={BUSOBJCAT.EXPENSE}
                  busObjId={expenseId}
                  initialComments={expenseComments}
                  isParentLocked={isLocked}
                />
              )}
            </Tab.Screen>
            <Tab.Screen
              name={t("history")}
              options={{
                tabBarLabel: ({ focused, color }) => (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      color,
                      fontSize: 14,
                      textTransform: "uppercase",
                    }}
                  >
                    {t("history")}
                  </Text>
                ),
              }}
            >
              {() => (
                <History busObjCat={BUSOBJCAT.EXPENSE} busObjID={expenseId} />
              )}
            </Tab.Screen>
          </Tab.Navigator>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerLeftContainer: {
    maxWidth: screenDimension.width / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headerLeftText: {
    fontSize: screenDimension.width > 400 ? 18 : 16,
    fontWeight: "bold",
    color: "white",
  },
  headerRightContainer: {
    maxWidth: screenDimension.width / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    columnGap: 8,
  },
});

export default ExpenseDetail;
