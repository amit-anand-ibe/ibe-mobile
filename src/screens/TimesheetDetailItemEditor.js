import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Modal,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native-gesture-handler";
import CustomRemotePicker from "../components/CustomRemotePicker";
import CustomPicker from "../components/CustomPicker";
import CustomTextInput from "../components/CustomTextInput";
import {
  API_ENDPOINTS,
  APP,
  APP_NAME,
  INTSTATUS,
  PREFERRED_LANGUAGES,
  TEST_MODE,
} from "../constants";
import { getRemarkText, setRemarkText } from "../utils/FormatUtils";
import { showToast } from "../utils/MessageUtils";
import { fetchData } from "../utils/APIUtils";
import clientOverrides from "../config/clientOverrides";

const TimesheetDetailItemEditor = ({
  item,
  timesheetDetail,
  timesheetTypeDetails,
  onConfirm,
  onCancel,
  isItemEditMode,
  isParentLocked,
  employeeInfo,
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { personId } = employeeInfo;

  console.log(
    `Employee Info Loaded in TimesheetDetailItemEditor: `,
    JSON.stringify(employeeInfo, null, 2)
  );

  const {
    defaultAsHomeDefault,
    itemCommentRequired,
    minTimeIncrement,
    validateIncrement,
    overtimeAllowed,
  } = timesheetTypeDetails;

  const [editedItem, setEditedItem] = useState({ ...item });
  const [initialItem, setInitialItem] = useState({ ...item });

  const [timeValue, setTimeValue] = useState("");
  const [timeUnit, setTimeUnit] = useState("hours");
  const [quantityValue, setQuantityValue] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("ea");
  const [quantityUnitName, setQuantityUnitName] = useState("Each");

  const [initialTaskLoading, setInitialTaskLoading] = useState(false);
  const [taskTimeItemTypeNonEditable, setTaskTimeItemTypeNonEditable] =
    useState(false);
  const [taskTimeItemTypes, setTaskTimeItemTypes] = useState([]);
  const [isQuantityAllowedTask, setIsQuantityAllowedTask] = useState(false);
  const [quantityToTimeUnit, setQuantityToTimeUnit] = useState(3600000);
  const [decimalsAllowedInUnit, setDecimalsAllowedInUnit] = useState(0);
  const [taskBillable, setTaskBillable] = useState(false);

  const [clearCustomerSearchData, setClearCustomerSearchData] = useState(false);
  const [clearProjectSearchData, setClearProjectSearchData] = useState(false);
  const [clearTaskSearchData, setClearTaskSearchData] = useState(false);
  const [clearDepartmentSearchData, setClearDepartmentSearchData] =
    useState(false);

  const timeUnitOptions = [
    { label: "hour(s)", value: "hours" },
    { label: "minute(s)", value: "minutes" },
  ];

  /**
   * Fetches initial task details based on the provided task item.
   *
   * This function retrieves specific details about a task, including quantity settings and unit time,
   * by sending an API request with the provided task ID. The function manages the loading state
   * during the request and updates relevant states based on the response.
   *
   * @param {Object} item - The task item object containing the task ID.
   * @param {string} item.taskId - The ID of the task to fetch details for.
   *
   * @returns {void}
   */
  const fetchInitialTaskDetails = async (item) => {
    // Return early if taskId is not provided
    if (!item.taskId) {
      return;
    }

    // Set loading state to true
    setInitialTaskLoading(true);

    try {
      // Define the fields and conditions for the API query
      const queryFields = {
        fields: [
          "Task-billable",
          "Task-timeItemTypes",
          "Task-timeItemTypeNonEditable",
          "Task-type:TaskType-quantityAllowed",
          "Task-quantities-unitTime",
          "Task-quantities-plannedQuantity-unit",
          "Task-quantities-actualQuantity-unit",
          "Task-quantities-plannedQuantity-unit:Unit-name",
          "Task-quantities-actualQuantity-unit:Unit-name",
          "Task-quantities-plannedQuantity-unit:Unit-decimals",
          "Task-quantities-actualQuantity-unit:Unit-decimals",
        ],
        where: [
          {
            fieldName: "Task-id",
            operator: "=",
            value: item.taskId, // Filter by task ID
          },
        ],
      };

      // Define common query parameters for the API request
      const commonQueryParams = {
        testMode: TEST_MODE,
        client: parseInt(APP.LOGIN_USER_CLIENT), // Ensure client ID is a number
        user: APP.LOGIN_USER_ID,
        userID: APP.LOGIN_USER_ID,
        language: APP.LOGIN_USER_LANGUAGE,
        intStatus: JSON.stringify([INTSTATUS.ACTIVE]), // Filter active status
      };

      // Prepare form data for the API request by combining query and common parameters
      const formData = {
        query: JSON.stringify(queryFields),
        ...commonQueryParams,
      };

      // Fetch data from the API using POST method
      const response = await fetchData(
        API_ENDPOINTS.QUERY,
        "POST",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        new URLSearchParams(formData).toString()
      );

      // Check if the response is successful and contains valid data
      if (
        response.success &&
        Array.isArray(response.data) &&
        response.data.length > 0
      ) {
        const data = response.data[0];

        // Set the states based on the fetched data
        setTaskBillable(data["Task-billable"] || false);
        setTaskTimeItemTypes(data["Task-timeItemTypes"] || []);
        setTaskTimeItemTypeNonEditable(
          data["Task-timeItemTypeNonEditable"] || false
        );
        setIsQuantityAllowedTask(
          data["Task-type:TaskType-quantityAllowed"] || false
        );
        setQuantityToTimeUnit(data["Task-quantities-unitTime"] || 3600000); // Default to 1 hour if undefined
        setQuantityUnit(
          data["Task-quantities-plannedQuantity-unit"] ||
            data["Task-quantities-actualQuantity-unit"] ||
            "ea"
        );
        setQuantityUnitName(
          data["Task-quantities-plannedQuantity-unit:Unit-name"] ||
            data["Task-quantities-actualQuantity-unit:Unit-name"] ||
            "Each"
        );
        setDecimalsAllowedInUnit(
          data["Task-quantities-plannedQuantity-unit:Unit-decimals"] ||
            data["Task-quantities-actualQuantity-unit:Unit-decimals"] ||
            0
        );
      } else {
        // Log an error if no task is found or the data array is empty
        console.error("No task found or the data array is empty.");
      }
    } catch (error) {
      // Handle any errors that occur during the fetch operation
      console.error("Error fetching task details:", error);
      showToast(t("error_fetching_data"), "error");
    } finally {
      // Set loading state to false after operation is complete
      setInitialTaskLoading(false);
    }
  };

  // Effect to update initial values
  useEffect(() => {
    fetchInitialTaskDetails(initialItem);
    updateInitialTimeValues(initialItem);
    updateInitialQuantityValues(initialItem);
  }, []);

  /**
   * Updates the initial time values based on the `actualTime` property of the provided item.
   * Converts the time to minutes if it is less than an hour and updates the corresponding unit.
   *
   * @param {Object} item - The item object containing various properties, including actual time information.
   * @param {number} [item.actualTime] - The total time in milliseconds. If not provided, default time values are used.
   */
  const updateInitialTimeValues = (item) => {
    let initialTimeValue = "";
    let initialTimeUnit = "hours"; // Default to "hours"

    // If actualTime is provided, convert to hours or minutes as needed
    if (item.actualTime) {
      const totalMilliseconds = item.actualTime;
      const totalHours = totalMilliseconds / (60 * 60 * 1000); // Convert milliseconds to hours

      // Set the time value in hours or minutes based on the total time
      if (totalHours >= 1) {
        initialTimeValue = totalHours.toString(); // Convert hours to string for state update
      } else {
        initialTimeValue = (totalMilliseconds / (60 * 1000)).toString(); // Convert to minutes if less than 1 hour
        initialTimeUnit = "minutes"; // Set the unit to "minutes"
      }
    }

    // Update the state with the calculated time value and unit
    setTimeValue(initialTimeValue);
    setTimeUnit(initialTimeUnit);
  };

  /**
   * Updates the initial quantity values based on the `actualQuantity` property of the provided item.
   * Defaults to a quantity of "0" and a unit of "ea" if `actualQuantity` is not provided.
   *
   * @param {Object} item - The item object containing various properties, including quantity information.
   * @param {Object} [item.actualQuantity] - An object representing the actual quantity.
   * @param {number} [item.actualQuantity.quantity=0] - The quantity value, defaulting to 0 if not provided.
   * @param {string} [item.actualQuantity.unit="ea"] - The unit of the quantity, defaulting to "ea" if not provided.
   */
  const updateInitialQuantityValues = (item) => {
    const { quantity = 0, unit = "ea" } = item.actualQuantity || {}; // Destructure with defaults
    setQuantityValue(quantity.toString());
    setQuantityUnit(unit);
  };

  /**
   * Calculates the total time in milliseconds based on a given value and unit.
   * If the value is less than 1 and the unit is "hours", the function will prompt the user
   * to use minutes as the unit and adjust the value accordingly.
   *
   * @param {string} value - The value to be converted (can be a number or decimal as a string).
   * @param {string} unit - The unit of time ("hours" or "minutes").
   * @returns {number} - The total time in milliseconds.
   */
  const calculateActualTime = (value, unit) => {
    // Convert value to a float to handle decimal values
    let parsedValue = parseFloat(value);

    // Check if the parsed value is NaN or less than 0 (handle empty input or non-numeric input)
    if (isNaN(parsedValue) || parsedValue < 0) {
      parsedValue = 0;
    }

    // If unit is "hours" and value is less than 1, suggest using minutes instead
    if (unit === "hours" && parsedValue < 1) {
      console.log(
        "Value is less than 1 hour. Converting to minutes and updating unit."
      );
      // Convert the value to minutes
      parsedValue = parsedValue * 60;
      unit = "minutes";
    }

    let totalMilliseconds = 0;
    if (unit === "hours") {
      totalMilliseconds = parsedValue * 60 * 60 * 1000;
    } else if (unit === "minutes") {
      totalMilliseconds = parsedValue * 60 * 1000;
    }

    return totalMilliseconds;
  };

  const handleTimeValueChange = (text) => {
    // Update the state with the new time value entered by the user
    setTimeValue(text);

    // Calculate the actual time based on the entered text and the current time unit
    actualTime = calculateActualTime(text, timeUnit);

    // Update the editedItem state with the new calculated actualTime
    setEditedItem((prevItem) => ({
      ...prevItem,
      actualTime: actualTime,
    }));
  };

  const handleQuantityValueChange = (text) => {
    // Parse and round quantity
    let qty = parseFloat(text || "0");
    const coeff = Math.pow(10, decimalsAllowedInUnit);
    qty = Math.round(qty * coeff) / coeff;

    // Calculate actual time (if needed)
    const actualTime = qty * (quantityToTimeUnit || 3600000);

    // Update state with rounded quantity
    setQuantityValue(qty.toString());
    setEditedItem((prevItem) => ({
      ...prevItem,
      actualQuantity: { quantity: qty, unit: quantityUnit },
      actualTime,
    }));
  };

  const handleTimeUnitChange = (value) => {
    setTimeUnit(value);

    // Calculate actualTime based on current timeValue and the new timeUnit
    const actualTime = calculateActualTime(timeValue, value);

    // Update editedItem with the new actualTime
    setEditedItem((prevItem) => ({
      ...prevItem,
      actualTime: actualTime,
    }));
  };

  const handleRemarkChange = (text) => {
    const updatedRemark = setRemarkText(editedItem.remark, lang, text);
    setEditedItem({ ...editedItem, remark: updatedRemark });
  };

  const remarkText = getRemarkText(
    editedItem.remark,
    lang,
    PREFERRED_LANGUAGES
  );

  /**
   * Validates if the actual time of an edited item adheres to the minimum time increment requirement.
   *
   * This function performs the following checks:
   * 1. Converts `minTimeIncrement` from minutes to milliseconds.
   * 2. Verifies that the converted increment value is greater than zero.
   * 3. Checks if `editedItem.actualTime` is a multiple of the calculated increment value.
   *
   * @returns {boolean} - Returns `true` if `editedItem.actualTime` is a multiple of the minimum time increment; otherwise, `false`.
   */
  const validateMinIncrement = () => {
    // Convert the string to a number and convert minutes to milliseconds
    const minIncr = parseInt(minTimeIncrement, 10) * 60000; // 60000 ms = 1 minute

    // Check if minIncr is valid (greater than 0) and if there's an actual time increment issue
    if (
      !isNaN(minIncr) &&
      minIncr > 0 &&
      editedItem.actualTime % minIncr !== 0
    ) {
      return false;
    }

    return true;
  };

  const validateChanges = () => {
    const validationErrorMessages = {
      task: t("task_required_message"),
      department: t("department_required_message"),
      departmentOrTask: t("department_or_task_required_message"),
      timeRequiredMessage: t("time_required_message"),
      quantityRequiredMessage: t("quantity_required_message"),
      timeDurationExceed: t("duration_cannot_exceed_24_hours"),
      remark: t("remark_required_message"),
    };

    const validationWarningMessages = {
      remark: t("remark_recommended_message"),
    };

    // Check for department or task requirement, ensuring only one is selected
    if (defaultAsHomeDefault === ".") {
      if (!editedItem.taskId && !editedItem.departmentId) {
        Alert.alert(
          t("validation_error"),
          validationErrorMessages.departmentOrTask,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      }

      if (editedItem.taskId && editedItem.departmentId) {
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
    if (defaultAsHomeDefault === "*" && !editedItem.departmentId) {
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
      !editedItem.taskId
    ) {
      Alert.alert(
        t("validation_error"),
        validationErrorMessages.task,
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    }

    // Check for time requirement
    if (!editedItem.actualTime && !isQuantityAllowedTask) {
      Alert.alert(
        t("validation_error"),
        validationErrorMessages.timeRequiredMessage,
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    } else if (!parseFloat(quantityValue || "0") && isQuantityAllowedTask) {
      Alert.alert(
        t("validation_error"),
        validationErrorMessages.quantityRequiredMessage,
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    } else if (editedItem.actualTime > 86400000) {
      Alert.alert(
        t("validation_error"),
        validationErrorMessages.timeDurationExceed,
        [{ text: t("ok"), style: "cancel" }],
        { cancelable: false }
      );
      return false;
    }

    // Check for remark requirement conditionally
    if (!remarkText) {
      if (itemCommentRequired === "E") {
        Alert.alert(
          t("validation_error"),
          validationErrorMessages.remark,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      }
      if (itemCommentRequired === "W") {
        showToast(validationWarningMessages.remark, "warning");
      }
    }

    const isValidMinIncrement = validateMinIncrement();
    const minIncr = parseInt(minTimeIncrement) || "";

    if (!isValidMinIncrement) {
      if (validateIncrement === "E") {
        const errorMessage = t("validation_error_min_increment", {
          minIncr: minIncr,
        });
        Alert.alert(
          t("validation_error"),
          errorMessage,
          [{ text: t("ok"), style: "cancel" }],
          { cancelable: false }
        );
        return false;
      } else if (validateIncrement === "W") {
        const warningMessage = t("validation_warning_min_increment", {
          minIncr: minIncr,
        });
        showToast(warningMessage, "warning");
      }
    }

    return true;
  };

  const handleConfirm = () => {
    if (!validateChanges()) {
      return;
    }

    const updatedItem = { ...editedItem };

    if (!isEqual(updatedItem, initialItem)) {
      updatedItem.isDirty = true;
    }

    setEditedItem(updatedItem);
    onConfirm(updatedItem);

    console.log(`After edit item: ${JSON.stringify(updatedItem)}`);
  };

  const handleCancel = () => {
    if (!isEqual(editedItem, initialItem)) {
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
            onPress: onCancel,
          },
        ],
        { cancelable: false }
      );
    } else {
      // No changes, directly cancel
      onCancel();
    }
  };

  function isEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  const commonQueryParams = {
    filterQueryValue: "",
    userID: APP.LOGIN_USER_ID,
    client: parseInt(APP.LOGIN_USER_CLIENT),
    language: APP.LOGIN_USER_LANGUAGE,
    testMode: "",
    appName: APP_NAME.TIMESHEET,
    intStatus: JSON.stringify([INTSTATUS.ACTIVE, 1]),
    page: 1,
    start: 0,
    limit: 20,
  };

  const customerQueryParams = {
    fields: [
      "Customer-id",
      "Customer-extID",
      "Customer-type",
      "Customer-text",
      "Customer-name",
      "Customer-name:text",
    ],
    sort: [
      {
        property: "Customer-changedOn",
        direction: "DESC",
      },
      {
        property: "Customer-name-text",
        direction: "ASC",
      },
    ],
  };

  const projectQueryParams = {
    fields: [
      "ProjectWBS-id",
      "ProjectWBS-extID",
      "ProjectWBS-type",
      "ProjectWBS-text",
      "ProjectWBS-text:text",
      "ProjectWBS-remark:text",
      "ProjectWBS-text-text",
      "ProjectWBS-financeData-companyID",
      "ProjectWBS-financeData-companyID:BusUnit-name-text",
      "ProjectWBS-responsible",
      "ProjectWBS-responsible:Person-name-knownAs",
      "ProjectWBS-customerID",
      "ProjectWBS-customerID:Customer-extID",
      "ProjectWBS-customerID:Customer-name-text",
      "ProjectWBS-assigned",
      "ProjectWBS-percentComplete",
    ],
    where: [
      {
        fieldName: "ProjectWBS-assigned",
        operator: "in",
        value: personId,
      },
      { fieldName: "ProjectWBS-percentComplete", operator: "!=", value: 100 },
    ],
    sort: [
      {
        property: "ProjectWBS-changedOn",
        direction: "DESC",
      },
      {
        property: "ProjectWBS-text:text",
        direction: "ASC",
      },
    ],
  };

  if (editedItem.customerId) {
    projectQueryParams.where.push({
      fieldName: "ProjectWBS-customerID",
      operator: "=",
      value: editedItem.customerId,
    });
  }

  const taskQueryParams = {
    fields: [
      "Task-id",
      "Task-extID",
      "Task-type",
      "Task-text",
      "Task-text:text",
      "Task-remark:text",
      "Task-text-text",
      "Task-customerID",
      "Task-customerID:Customer-extID",
      "Task-customerID:Customer-name-text",
      "Task-projectWbsID",
      "Task-projectWbsID:ProjectWBS-extID",
      "Task-projectWbsID:ProjectWBS-text-text",
      "Task-allResources",
      "Task-timeConfAllowed",
      "Task-percentComplete",
      "Task-client",
      "Task-assigned",
      "Task-dates-actualFinish",
      "Task-type:TaskType-timeConfAllowed",
      "Task-type:TaskType-doNotAllowExpenses",
      "Task-type:TaskType-quantityAllowed",
      "Task-quantities-plannedQuantity",
      "Task-quantities-plannedQuantity-unit:Unit-decimals",
      "Task-quantities-plannedQuantity-unit:Unit-name",
      "Task-quantities-actualQuantity",
      "Task-quantities-actualQuantity-unit:Unit-decimals",
      "Task-quantities-actualQuantity-unit:Unit-name",
      "Task-quantities-unitTime",
      "Task-billable",
      "Task-resources-personID",
      "Task-resources-billable",
      "Task-resources-intStatus",
      "Task-resources-percentComplete",
      "Task-dates-actualStart",
      "Task-duration",
      "Task-timeItemTypes",
      "Task-timeItemTypes[0]:TimeItemType-id",
      "Task-timeItemTypes[0]:TimeItemType-name",
      "Task-timeItemTypeNonEditable",
      "Task-intStatus",
    ],
    where: [
      {
        fieldName: "Task-type:TaskType-timeConfAllowed",
        operator: "=",
        value: true,
      },
      {
        fieldName: "Task-client",
        operator: "=",
        value: parseInt(APP.LOGIN_USER_CLIENT),
        or: true,
        nestedConditions: [
          {
            fieldName: "Task-assigned",
            operator: "in",
            value: personId,
          },
          { fieldName: "Task-allResources", operator: "=", value: true },
        ],
      },
      {
        fieldName: "Task-intStatus",
        operator: "in",
        value: ["0", "1", "2", null],
        or: true,
        nestedConditions: [
          { fieldName: "Task-percentComplete", operator: "!=", value: 100 },
          {
            fieldName: "Task-dates-actualFinish",
            operator: ">=",
            value:
              timesheetDetail.selectedDate ?? // Use `selectedDate` if it's available
              timesheetDetail.timesheetStart ?? // Otherwise, use `timesheetStart`
              new Date(), // Fall back to the current date and time if both are unavailable
          },
        ],
      },
    ],
    sort: [
      {
        property: "Task-changedOn",
        direction: "DESC",
      },
      {
        property: "Task-text:text",
        direction: "ASC",
      },
    ],
  };

  const busUnitQueryParams = {
    fields: [
      "BusUnit-id",
      "BusUnit-extID",
      "BusUnit-type",
      "BusUnit-name",
      "BusUnit-name:text",
      "BusUnit-inactive",
      "BusUnit-busFunction",
    ],
    where: [
      { fieldName: "BusUnit-busFunction", operator: "=", value: "Department" },
      { fieldName: "BusUnit-inactive", operator: "!=", value: true },
    ],
    sort: [
      {
        property: "BUsUnit-changedOn",
        direction: "DESC",
      },
      {
        property: "BusUnit-name:text",
        direction: "ASC",
      },
    ],
  };

  const timeTypeQueryParams = {
    fields: ["TimeItemType-id", "TimeItemType-extID", "TimeItemType-name"],
    where: [
      {
        fieldName: "TimeItemType-busObjCat",
        operator: "=",
        value: "TimeItemType",
      },
    ],
    sort: [
      {
        property: "TimeItemType-name",
        direction: "ASC",
      },
    ],
  };

  if (editedItem.customerId) {
    taskQueryParams.where.push({
      fieldName: "Task-customerID",
      operator: "=",
      value: editedItem.customerId,
    });
  }

  if (editedItem.projectId) {
    taskQueryParams.where.push({
      fieldName: "Task-projectWbsID",
      operator: "=",
      value: editedItem.projectId,
    });
  }

  const handleCustomerChange = ({ value, label, additionalData }) => {
    console.log(
      `Additonal data in customer: ${JSON.stringify(additionalData)}`
    );

    const extID = additionalData.extID ?? "";

    setEditedItem({
      ...editedItem,
      billable: false,
      customerId: value ?? "",
      customerText: label ?? "",
      customerExtId: extID ?? "",
      // Reset project and task fields if customer is blank (null, undefined, or empty string)
      projectId: null,
      projectText: "",
      projectExtId: "",
      taskId: null,
      taskText: "",
      taskExtId: "",
      departmentId: "",
      departmentText: "",
      departmentExtId: "",
      timeItemTypeExtId: "",
      timeItemTypeId: "",
      timeItemTypeText: "",
      actualQuantity: { quantity: 0, unit: "" },
    });

    setIsQuantityAllowedTask(false);
    setQuantityToTimeUnit(3600000);
    setQuantityUnit("ea");
    setQuantityUnitName("Each");
    setDecimalsAllowedInUnit(0);
    setTaskTimeItemTypes([]);
    setTaskTimeItemTypeNonEditable(false);
    setTaskBillable(false);

    setClearTaskSearchData([]);
    setClearProjectSearchData([]);
    setClearDepartmentSearchData([]);
  };

  const handleProjectChange = ({ value, label, additionalData }) => {
    console.log(`Additonal data in project: ${JSON.stringify(additionalData)}`);

    const extID = additionalData.extID ?? "";

    setEditedItem({
      ...editedItem,
      billable: false,
      projectId: value ?? "",
      projectText: label ?? "",
      projectExtId: extID ?? "",
      // Reset task fields if project is blank (null, undefined, or empty string)
      taskId: null,
      taskText: "",
      taskExtId: "",
      // If customer is blank, set the project's corresponding customer details
      customerId:
        !editedItem.customerId && additionalData.projectCustomerId
          ? additionalData.projectCustomerId
          : editedItem.customerId,
      customerText:
        !editedItem.customerText && additionalData.projectCustomerText
          ? additionalData.projectCustomerText
          : editedItem.customerText,
      customerExtId:
        !editedItem.customerExtId && additionalData.projectCustomerExtId
          ? additionalData.projectCustomerExtId
          : editedItem.customerExtId,
      departmentId: "",
      departmentText: "",
      departmentExtId: "",
      timeItemTypeExtId: "",
      timeItemTypeId: "",
      timeItemTypeText: "",
      actualQuantity: { quantity: 0, unit: "" },
    });

    setIsQuantityAllowedTask(false);
    setQuantityToTimeUnit(3600000);
    setQuantityUnit("ea");
    setQuantityUnitName("Each");
    setDecimalsAllowedInUnit(0);
    setTaskTimeItemTypes([]);
    setTaskTimeItemTypeNonEditable(false);
    setTaskBillable(false);

    setClearCustomerSearchData([]);
    setClearTaskSearchData([]);
    setClearDepartmentSearchData([]);
  };

  const handleTaskChange = ({ value, label, additionalData }) => {
    console.log(`Additonal data in task: ${JSON.stringify(additionalData)}`);

    const extID = additionalData.extID || "";
    const taskBillable = additionalData.taskBillable || false;
    const taskQuantityAllowed = additionalData.taskQuantityAllowed || false;
    const taskResources = additionalData.taskResources || [];

    setEditedItem({
      ...editedItem,
      billable: retrieveBillableStatus(
        taskBillable,
        taskQuantityAllowed,
        taskResources
      ),
      taskId: value,
      taskText: label,
      taskExtId: extID,
      // If customer is blank, set the task's corresponding customer details
      customerId:
        !editedItem.customerId && additionalData.taskCustomerId
          ? additionalData.taskCustomerId
          : editedItem.customerId,
      customerText:
        !editedItem.customerText && additionalData.taskCustomerText
          ? additionalData.taskCustomerText
          : editedItem.customerText,
      customerExtId:
        !editedItem.customerExtId && additionalData.taskCustomerExtId
          ? additionalData.taskCustomerExtId
          : editedItem.customerExtId,
      // If project is blank, set the task's corresponding project details
      projectId:
        !editedItem.projectId && additionalData.taskProjectWBSId
          ? additionalData.taskProjectWBSId
          : editedItem.projectId,
      projectText:
        !editedItem.projectText && additionalData.taskProjectWBSText
          ? additionalData.taskProjectWBSText
          : editedItem.projectText,
      projectExtId:
        !editedItem.projectExtId && additionalData.taskProjectWBSExtId
          ? additionalData.taskProjectWBSExtId
          : editedItem.projectExtId,
      departmentId: "",
      departmentText: "",
      departmentExtId: "",
      timeItemTypeExtId: additionalData.taskTimeItemTypes?.[0] || "",
      timeItemTypeId: additionalData.taskTimeItemTypeId || "",
      timeItemTypeText: additionalData.taskTimeItemTypeText || "",
    });

    setIsQuantityAllowedTask(additionalData.taskQuantityAllowed ?? false);
    setQuantityToTimeUnit(additionalData.taskUnitTime || 3600000);
    setQuantityUnit(
      additionalData.taskPlannedQuantity?.unit ||
        additionalData.taskActualQuantity?.unit ||
        "ea"
    );
    setQuantityUnitName(
      additionalData.taskPlannedQuantityUnitName ||
        additionalData.taskActualQuantityUnitName ||
        "Each"
    );
    setDecimalsAllowedInUnit(
      additionalData.taskPlannedQuantityUnitDecimals ||
        additionalData.taskActualQuantityUnitDecimals ||
        0
    );
    setTaskTimeItemTypes(additionalData.taskTimeItemTypes || []);
    setTaskTimeItemTypeNonEditable(
      additionalData.taskTimeItemTypeNonEditable || false
    );
    setTaskBillable(taskBillable);

    setClearCustomerSearchData([]);
    setClearProjectSearchData([]);
    setClearDepartmentSearchData([]);
  };

  /**
   * Retrieves the billable status of a task based on its properties and resources.
   *
   * @param {boolean} taskBillable - Indicates if the task is generally billable.
   * @param {Array} taskResources - List of resources associated with the task. Each resource should have `personID` and `billable` properties.
   * @param {boolean} taskQuantityAllowed - Flag indicating whether the task is quantity-based, which automatically makes it billable.
   * @returns {boolean} - Returns `true` if the task is billable based on its properties and resources; otherwise, returns `false`.
   */
  const retrieveBillableStatus = (
    taskBillable,
    taskQuantityAllowed,
    taskResources
  ) => {
    // Return true if the task is quantity-based and allowed.
    if (taskQuantityAllowed) {
      console.log("Task is quantity allowed, so booked time is billable.");
      return true;
    }

    // If the task is not billable by default, return false.
    if (!taskBillable) {
      console.log("Task is not billable by default.");
      return false;
    }

    // Log the task resources for debugging purposes.
    console.log("Checking task resources:", taskResources);

    // Find the resource matching the logged-in person.
    const resource = taskResources?.find(
      (resource) => resource.personID === personId
    );

    // Return the billable status of the matched resource, or false if no resource is found.
    return resource ? resource.billable : false;
  };

  const handleDepartmentChange = ({ value, label, additionalData }) => {
    console.log(
      `Additonal data in department: ${JSON.stringify(additionalData)}`
    );

    const extID = additionalData.extID ?? "";

    setEditedItem({
      ...editedItem,
      billable: false,
      departmentId: value ?? "",
      departmentText: label ?? "",
      departmentExtId: extID ?? "",
      customerId: "",
      customerText: "",
      customerExtId: "",
      projectId: "",
      projectText: "",
      projectExtId: "",
      taskId: "",
      taskText: "",
      taskExtId: "",
      timeItemTypeExtId: "",
      timeItemTypeId: "",
      timeItemTypeText: "",
      actualQuantity: { quantity: 0, unit: "" },
    });

    setIsQuantityAllowedTask(false);
    setQuantityToTimeUnit(3600000);
    setQuantityUnit("ea");
    setQuantityUnitName("Each");
    setDecimalsAllowedInUnit(0);
    setTaskTimeItemTypes([]);
    setTaskTimeItemTypeNonEditable(false);
    setTaskBillable(false);

    setClearCustomerSearchData([]);
    setClearProjectSearchData([]);
    setClearTaskSearchData([]);
  };

  const handleTimeTypeChange = ({ value, label, additionalData }) => {
    const extID = additionalData.extID ?? "";

    setEditedItem({
      ...editedItem,
      timeItemTypeId: value,
      timeItemTypeText: label,
      timeItemTypeExtId: extID,
    });
  };

  const validateBillableChange = () => {
    if (editedItem.departmentId) {
      Alert.alert("Error", t("time_allocated_to_department"));
      return false;
    }
    if (!editedItem.taskId) {
      Alert.alert("Error", t("select_task_first"));
      return false;
    }
    if (!taskBillable && !editedItem.billable) {
      Alert.alert("Error", t("selected_task_not_billable"));
      return false;
    }

    return true;
  };

  const handleBillableChange = (value) => {
    const isAllowed = validateBillableChange();
    if (isAllowed) {
      setEditedItem({ ...editedItem, billable: value });
    }
  };

  useEffect(() => {
    setEditedItem((prevItem) => ({
      ...prevItem,
      productive: prevItem.billable,
      billableTime: prevItem.billable ? prevItem.actualTime : 0,
    }));
  }, [editedItem.billable, editedItem.actualTime]);

  const isBillableDisabled =
    defaultAsHomeDefault === "*" ||
    isParentLocked ||
    // Disable if the client is explicitly listed in overrides and has forceDisableSwitch set to true
    clientOverrides[parseInt(APP.LOGIN_USER_CLIENT)]?.forceDisableSwitch ===
      true;

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
            ? t("timesheet_edit_item")
            : t("timesheet_create_item")}
        </Text>
        <ScrollView contentContainerStyle={styles.modalContent}>
          {defaultAsHomeDefault !== "*" && (
            <View style={styles.modalInputContainer}>
              <CustomRemotePicker
                queryParams={{
                  queryFields: customerQueryParams,
                  commonQueryParams: commonQueryParams,
                }}
                pickerLabel={t("customer")}
                initialAdditionalLabel={editedItem.customerExtId}
                initialItemLabel={editedItem.customerText}
                initialItemValue={editedItem.customerId}
                labelItemField={"Customer-name:text"}
                valueItemField={"Customer-id"}
                additionalFields={[{ extID: "Customer-extID" }]}
                searchFields={["Customer-name-text", "Customer-extID"]}
                multiline={true}
                onValueChange={handleCustomerChange}
                disabled={isParentLocked || defaultAsHomeDefault === "*"}
                clearSearchData={clearCustomerSearchData}
              />
            </View>
          )}
          {defaultAsHomeDefault !== "*" && (
            <View style={styles.modalInputContainer}>
              <CustomRemotePicker
                queryParams={{
                  queryFields: projectQueryParams,
                  commonQueryParams: commonQueryParams,
                }}
                pickerLabel={t("project")}
                initialAdditionalLabel={editedItem.projectExtId}
                initialItemLabel={editedItem.projectText}
                initialItemValue={editedItem.projectId}
                labelItemField={"ProjectWBS-text:text"}
                valueItemField={"ProjectWBS-id"}
                additionalFields={[
                  {
                    extID: "ProjectWBS-extID",
                  },
                  { projectCustomerId: "ProjectWBS-customerID" },
                  {
                    projectCustomerExtId:
                      "ProjectWBS-customerID:Customer-extID",
                  },
                  {
                    projectCustomerText:
                      "ProjectWBS-customerID:Customer-name-text",
                  },
                ]}
                searchFields={["ProjectWBS-text-text", "ProjectWBS-extID"]}
                multiline={true}
                onValueChange={handleProjectChange}
                disabled={isParentLocked}
                clearSearchData={clearProjectSearchData}
              />
            </View>
          )}
          {defaultAsHomeDefault !== "*" && (
            <View style={styles.modalInputContainer}>
              <CustomRemotePicker
                queryParams={{
                  queryFields: taskQueryParams,
                  commonQueryParams: commonQueryParams,
                }}
                pickerLabel={t("task")}
                initialAdditionalLabel={editedItem.taskExtId}
                initialItemLabel={editedItem.taskText}
                initialItemValue={editedItem.taskId}
                labelItemField={"Task-text:text"}
                valueItemField={"Task-id"}
                additionalFields={[
                  { extID: "Task-extID" },
                  { taskBillable: "Task-billable" },
                  { taskResources: "Task-resources" },
                  { taskTimeItemTypes: "Task-timeItemTypes" },
                  {
                    taskTimeItemTypeId: "Task-timeItemTypes[0]:TimeItemType-id",
                  },
                  {
                    taskTimeItemTypeText:
                      "Task-timeItemTypes[0]:TimeItemType-name",
                  },
                  {
                    taskTimeItemTypeNonEditable: "Task-timeItemTypeNonEditable",
                  },
                  { taskQuantityAllowed: "Task-type:TaskType-quantityAllowed" },
                  { taskUnitTime: "Task-quantities-unitTime" },
                  { taskPlannedQuantity: "Task-quantities-plannedQuantity" },
                  { taskActualQuantity: "Task-quantities-actualQuantity" },
                  {
                    taskPlannedQuantityUnitDecimals:
                      "Task-quantities-plannedQuantity-unit:Unit-decimals",
                  },
                  {
                    taskActualQuantityUnitDecimals:
                      "Task-quantities-actualQuantity-unit:Unit-decimals",
                  },
                  {
                    taskPlannedQuantityUnitName:
                      "Task-quantities-plannedQuantity-unit:Unit-name",
                  },
                  {
                    taskActualQuantityUnitName:
                      "Task-quantities-actualQuantity-unit:Unit-name",
                  },
                  { taskCustomerId: "Task-customerID" },
                  { taskCustomerExtId: "Task-customerID:Customer-extID" },
                  { taskCustomerText: "Task-customerID:Customer-name-text" },
                  { taskProjectWBSId: "Task-projectWbsID" },
                  { taskProjectWBSExtId: "Task-projectWbsID:ProjectWBS-extID" },
                  {
                    taskProjectWBSText:
                      "Task-projectWbsID:ProjectWBS-text-text",
                  },
                ]}
                searchFields={["Task-text-text", "Task-extID"]}
                multiline={true}
                onValueChange={handleTaskChange}
                disabled={isParentLocked}
                clearSearchData={clearTaskSearchData}
              />
            </View>
          )}
          {(defaultAsHomeDefault === "*" || defaultAsHomeDefault === ".") && (
            <View style={styles.modalInputContainer}>
              <CustomRemotePicker
                queryParams={{
                  queryFields: busUnitQueryParams,
                  commonQueryParams: commonQueryParams,
                }}
                pickerLabel={t("department")}
                initialAdditionalLabel={editedItem.departmentExtId}
                initialItemLabel={editedItem.departmentText}
                initialItemValue={editedItem.departmentId}
                labelItemField={"BusUnit-name:text"}
                valueItemField={"BusUnit-id"}
                additionalFields={[{ extID: "BusUnit-extID" }]}
                searchFields={["BusUnit-name-text", "BusUnit-extID"]}
                multiline={true}
                onValueChange={handleDepartmentChange}
                disabled={isParentLocked}
                clearSearchData={clearDepartmentSearchData}
              />
            </View>
          )}
          <View style={styles.modalInputContainer}>
            <Text style={styles.modalInputLabel}>{t("remark")}</Text>
            <CustomTextInput
              value={remarkText}
              onChangeText={handleRemarkChange}
              placeholder={`${t("placeholder_remark")}...`}
              multiline={true}
              editable={!isParentLocked}
            />
          </View>
          {!initialTaskLoading && overtimeAllowed && (
            <View style={styles.modalInputContainer}>
              <CustomRemotePicker
                queryParams={{
                  queryFields: timeTypeQueryParams,
                  commonQueryParams: commonQueryParams,
                }}
                pickerLabel={t("time_type")}
                initialAdditionalLabel={editedItem.timeItemTypeExtId}
                initialItemLabel={
                  editedItem.timeItemTypeText || t("standard_timesheet")
                }
                initialItemValue={editedItem.timeItemTypeId}
                labelItemField={"TimeItemType-name"}
                valueItemField={"TimeItemType-id"}
                additionalFields={[
                  {
                    extID: "TimeItemType-extID",
                  },
                ]}
                searchFields={["TimeItemType-name", "TimeItemType-extID"]}
                multiline={true}
                onValueChange={handleTimeTypeChange}
                disabled={
                  isParentLocked ||
                  taskTimeItemTypeNonEditable ||
                  taskTimeItemTypes.length > 0
                }
              />
            </View>
          )}
          <View style={styles.rowContainer}>
            {defaultAsHomeDefault !== "*" && (
              <View>
                <Text style={styles.modalInputLabel}>{t("billable")}</Text>
                <Switch
                  trackColor={{ false: "#d3d3d3", true: "#81b0ff" }}
                  thumbColor={
                    isBillableDisabled
                      ? "#bcbcbc" // Greyed out when disabled
                      : editedItem.billable
                      ? "#ffffff"
                      : "#a0a0a0"
                  }
                  ios_backgroundColor="#d3d3d3"
                  value={editedItem.billable}
                  onValueChange={handleBillableChange}
                  disabled={isBillableDisabled}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              {initialTaskLoading ? (
                <ActivityIndicator size="small" color="#0000ff" />
              ) : (
                <>
                  {!isQuantityAllowedTask && (
                    <View
                      style={[styles.modalInputContainer, styles.flexContainer]}
                    >
                      <Text style={styles.modalInputLabel}>{t("time")}</Text>
                      <View style={styles.hoursContainer}>
                        <CustomTextInput
                          value={timeValue}
                          placeholder={"0"}
                          onChangeText={handleTimeValueChange}
                          showClearButton={false}
                          keyboardType="numeric"
                          containerStyle={styles.hourInput}
                          editable={!isParentLocked}
                        />
                        <CustomPicker
                          items={timeUnitOptions}
                          initialValue={timeUnit}
                          onFilter={handleTimeUnitChange}
                          hideSearchInput={true}
                          containerStyle={styles.unitPickerContainer}
                          disabled={isParentLocked}
                        />
                      </View>
                    </View>
                  )}
                  {isQuantityAllowedTask && (
                    <View
                      style={[styles.modalInputContainer, styles.flexContainer]}
                    >
                      <Text style={[styles.modalInputLabel]}>
                        {t("quantity")}
                      </Text>
                      <View style={styles.quantityContainer}>
                        <CustomTextInput
                          value={quantityValue}
                          placeholder={"0"}
                          onChangeText={handleQuantityValueChange}
                          showClearButton={false}
                          keyboardType="numeric"
                          containerStyle={styles.hourInput}
                          editable={!isParentLocked}
                        />
                        <View style={styles.quantityUnitContainer}>
                          <Text numberOfLines={1} ellipsizeMode="tail">
                            {t("unit_label")}: {quantityUnitName}
                          </Text>
                          {quantityToTimeUnit > 0 && (
                            <Text numberOfLines={1} ellipsizeMode="tail">
                              {t("unit_time")}: {quantityToTimeUnit / 3600000} h
                            </Text>
                          )}
                          {quantityValue &&
                            parseFloat(quantityValue) !== NaN &&
                            quantityToTimeUnit > 0 && (
                              <Text numberOfLines={1} ellipsizeMode="tail">
                                {t("equiv_time")}:{" "}
                                {(parseFloat(quantityValue) *
                                  quantityToTimeUnit) /
                                  3600000}{" "}
                                h
                              </Text>
                            )}
                        </View>
                      </View>
                      <Text
                        style={styles.smallText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {"*"}
                        {t("allowed_decimal_places", {
                          unit: quantityUnitName,
                          decimalPlaces: decimalsAllowedInUnit,
                        })}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
          <Text style={styles.note}>{`${t("note")}:`}</Text>
          {defaultAsHomeDefault === "*" && (
            <Text style={styles.note}>{`\u2022 ${t(
              "timesheet_type_department_only"
            )}`}</Text>
          )}
          {defaultAsHomeDefault !== "*" && (
            <View>
              <Text style={styles.note}>{`\u2022 ${t(
                "note_timesheet_item_project"
              )}`}</Text>
              <Text style={styles.note}>{`\u2022 ${t(
                "note_timesheet_item_task"
              )}`}</Text>
              {defaultAsHomeDefault === "." && (
                <Text style={styles.note}>{`\u2022 ${t(
                  "only_one_task_or_department_allowed"
                )}`}</Text>
              )}
            </View>
          )}
          <Text style={styles.note}>{`\u2022 ${t(
            "billable_status_note"
          )}`}</Text>
          <Text style={styles.note}>{`\u2022 ${t(
            "remark_language_note"
          )}`}</Text>
        </ScrollView>
        <View style={styles.modalButtonsContainer}>
          <Button
            title={t("confirm")}
            onPress={handleConfirm}
            disabled={isParentLocked}
          />
          <Button onPress={handleCancel} title={t("cancel")} />
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
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: "4%",
    textAlign: "center",
  },
  modalInputContainer: {
    marginBottom: "5%",
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
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: "4%",
  },
  rowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: "2%",
  },
  hoursContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    width: "80%",
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    width: "80%",
  },
  flexContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  hourInput: {
    flex: 1,
    borderWidth: 0,
  },
  unitPickerContainer: {
    flex: 3,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#f0f0f0",
    borderWidth: 0,
    borderTopStartRadius: 0,
    borderBottomStartRadius: 0,
    marginBottom: 0,
  },
  modalButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 20,
  },
  quantityUnitContainer: {
    flex: 3,
    justifyContent: "center",
    alignSelf: "stretch",
    backgroundColor: "#f0f0f0",
    borderTopStartRadius: 0,
    borderTopEndRadius: 8,
    borderBottomStartRadius: 0,
    borderBottomEndRadius: 8,
    paddingLeft: "4%",
  },
  note: {
    fontSize: 12,
    color: "#00f",
    marginTop: 5,
  },
  smallText: {
    fontSize: 12,
  },
});

export default TimesheetDetailItemEditor;
