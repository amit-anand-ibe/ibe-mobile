import {
  API_ENDPOINTS,
  APP,
  INTSTATUS,
  PAGE_SIZE,
  TEST_MODE,
} from "../constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAndCacheResource, fetchData } from "./APIUtils";
import updateFields from "./UpdateUtils";
import fieldServiceReviewOverrides from "../config/fieldServiceReviewOverrides";

const FIELD_ENGINEER_ACCESS = "fieldservices";
const FIELD_ENGINEER_ADMIN_ACCESS = "fieldservicesadmin";
const FIELD_ENGINEER_ROLES = [
  FIELD_ENGINEER_ACCESS,
  FIELD_ENGINEER_ADMIN_ACCESS,
];

const getUpdateFieldsErrorMessage = (updateResponse = {}) => {
  const rawResponse = updateResponse?.response || updateResponse;
  const responseMessages = rawResponse?.messages || [];
  const detailMessages =
    rawResponse?.details?.flatMap((detail) => detail.messages || []) ||
    updateResponse?.details?.flatMap((detail) => detail.messages || []) ||
    [];
  return [...responseMessages, ...detailMessages]
    .filter((message) => message.message_type === "error")
    .map((message) => message.message_text)
    .filter(Boolean)
    .join(" | ");
};

const hasUpdateFieldsError = (updateResponse = {}) =>
  !updateResponse?.success ||
  Number(
    updateResponse?.summary?.error_count ||
      updateResponse?.response?.summary?.error_count ||
      0
  ) > 0 ||
  !!getUpdateFieldsErrorMessage(updateResponse);

const TASK_FIELDS = [
  "Task-id",
  "Task-extID",
  "Task-text",
  "Task-type",
  "Task-text:text",
  "Task-text-text",
  "Task-remark:text",
  "Task-customerID",
  "Task-customerID:Customer-extID",
  "Task-customerID:Customer-name-text",
  "Task-customerID:Customer-addressText",
  "Task-customerID:Customer-address",
  "Task-customerID:Customer-address-officePhone",
  "Task-customerID:Customer-address-locationID",
  "Task-customerID:Customer-address-locationID:Location-extID",
  "Task-customerID:Customer-address-locationID:Location-text-text",
  "Task-customerID:Customer-address-locationID:Location-address",
  "Task-customerID:Customer-primaryContact",
  "Task-customerID:Customer-primaryContact:Person-name-knownAs",
  "Task-customerID:Customer-primaryContact:Person-name-fullName",
  "Task-customerID:Customer-primaryContact:Person-jobTitle",
  "Task-customerID:Customer-primaryContact:Person-preferredEmail",
  "Task-customerID:Customer-primaryContact:Person-mobilePhone",
  "Task-customerID:Customer-primaryContact:Person-comms",
  "Task-projectWbsID",
  "Task-projectWbsID:ProjectWBS-extID",
  "Task-projectWbsID:ProjectWBS-text-text",
  "Task-projectWbsID:ProjectWBS-links",
  "Task-responsible",
  "Task-assigned",
  "Task-percentComplete",
  "Task-priority",
  "Task-priority:Priority-text",
  "Task-extStatus-recipient",
  "Task-extStatus-recipientList",
  "Task-dates-plannedStart",
  "Task-dates-plannedLateFinish",
  "Task-dates-plannedEarlyFinish",
  "Task-dates-plannedFinish",
  "Task-dates-actualStart",
  "Task-dates-actualFinish",
  "Task-createdOn",
  "Task-changedOn",
  "Task-resources",
  "Task-intStatus",
];

const TASK_DASHBOARD_FIELDS = [
  "Task-id",
  "Task-extID",
  "Task-text",
  "Task-type",
  "Task-text:text",
  "Task-text-text",
  "Task-customerID",
  "Task-customerID:Customer-extID",
  "Task-customerID:Customer-name-text",
  "Task-customerID:Customer-addressText",
  "Task-customerID:Customer-address",
  "Task-customerID:Customer-address-officePhone",
  "Task-customerID:Customer-address-locationID",
  "Task-customerID:Customer-address-locationID:Location-extID",
  "Task-customerID:Customer-address-locationID:Location-text-text",
  "Task-customerID:Customer-address-locationID:Location-address",
  "Task-customerID:Customer-primaryContact",
  "Task-customerID:Customer-primaryContact:Person-name-knownAs",
  "Task-customerID:Customer-primaryContact:Person-name-fullName",
  "Task-customerID:Customer-primaryContact:Person-jobTitle",
  "Task-customerID:Customer-primaryContact:Person-preferredEmail",
  "Task-customerID:Customer-primaryContact:Person-mobilePhone",
  "Task-projectWbsID",
  "Task-projectWbsID:ProjectWBS-extID",
  "Task-projectWbsID:ProjectWBS-text-text",
  "Task-projectWbsID:ProjectWBS-links",
  "Task-responsible",
  "Task-assigned",
  "Task-percentComplete",
  "Task-priority",
  "Task-priority:Priority-text",
  "Task-extStatus-recipient",
  "Task-extStatus-recipientList",
  "Task-dates-plannedLateFinish",
  "Task-dates-plannedEarlyFinish",
  "Task-dates-actualStart",
  "Task-dates-actualFinish",
  "Task-changedOn",
  "Task-intStatus",
];

const FIELD_ENGINEER_WORKFLOW_STORAGE_KEY = "fieldEngineerAssignmentWorkflow";
const FIELD_ENGINEER_EXECUTION_STORAGE_KEY = "fieldEngineerAssignmentExecution";
const FIELD_SERVICE_EXECUTION_OBJECT = "FieldServiceExecution";
const FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT = "FieldServiceChecklistTemplate";
const FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT = "FieldServiceReviewTemplate";
const FIELD_SERVICE_POLICY_OBJECT = "FieldServicePolicy";
let fieldServiceChecklistTemplateCache = null;
let fieldServiceReviewTemplateCache = null;
let fieldServicePolicyCache = null;
const fieldServiceListEntryCache = {};

const FIELD_SERVICE_EXECUTION_FIELDS = [
  "FieldServiceExecution-id",
  "FieldServiceExecution-taskID",
  "FieldServiceExecution-taskExtID",
  "FieldServiceExecution-currentStatus",
  "FieldServiceExecution-statusHistory",
  "FieldServiceExecution-checklist",
  "FieldServiceExecution-workPhotos",
  "FieldServiceExecution-reviewAcknowledgement",
  "FieldServiceExecution-signOff",
  "FieldServiceExecution-signOffHistory",
  "FieldServiceExecution-completedOn",
  "FieldServiceExecution-completedBy",
  "FieldServiceExecution-validationSnapshotJson",
];

const FIELD_SERVICE_CHECKLIST_TEMPLATE_FIELDS = [
  "FieldServiceChecklistTemplate-id",
  "FieldServiceChecklistTemplate-extID",
  "FieldServiceChecklistTemplate-name",
  "FieldServiceChecklistTemplate-description",
  "FieldServiceChecklistTemplate-taskType",
  "FieldServiceChecklistTemplate-customerID",
  "FieldServiceChecklistTemplate-customerID:Customer-extID",
  "FieldServiceChecklistTemplate-customerID:Customer-name-text",
  "FieldServiceChecklistTemplate-projectID",
  "FieldServiceChecklistTemplate-projectID:ProjectWBS-extID",
  "FieldServiceChecklistTemplate-projectID:ProjectWBS-text-text",
  "FieldServiceChecklistTemplate-effectiveFrom",
  "FieldServiceChecklistTemplate-effectiveTo",
  "FieldServiceChecklistTemplate-defaultTemplate",
  "FieldServiceChecklistTemplate-items",
];

const FIELD_SERVICE_REVIEW_TEMPLATE_FIELDS = [
  "FieldServiceReviewTemplate-id",
  "FieldServiceReviewTemplate-extID",
  "FieldServiceReviewTemplate-name",
  "FieldServiceReviewTemplate-description",
  "FieldServiceReviewTemplate-taskType",
  "FieldServiceReviewTemplate-customerID",
  "FieldServiceReviewTemplate-customerID:Customer-extID",
  "FieldServiceReviewTemplate-customerID:Customer-name-text",
  "FieldServiceReviewTemplate-projectID",
  "FieldServiceReviewTemplate-projectID:ProjectWBS-extID",
  "FieldServiceReviewTemplate-projectID:ProjectWBS-text-text",
  "FieldServiceReviewTemplate-effectiveFrom",
  "FieldServiceReviewTemplate-effectiveTo",
  "FieldServiceReviewTemplate-defaultTemplate",
  "FieldServiceReviewTemplate-items",
];

const FIELD_SERVICE_POLICY_FIELDS = [
  "FieldServicePolicy-id",
  "FieldServicePolicy-extID",
  "FieldServicePolicy-name",
  "FieldServicePolicy-taskType",
  "FieldServicePolicy-customerID",
  "FieldServicePolicy-customerID:Customer-extID",
  "FieldServicePolicy-customerID:Customer-name-text",
  "FieldServicePolicy-projectID",
  "FieldServicePolicy-projectID:ProjectWBS-extID",
  "FieldServicePolicy-projectID:ProjectWBS-text-text",
  "FieldServicePolicy-effectiveFrom",
  "FieldServicePolicy-effectiveTo",
  "FieldServicePolicy-defaultPolicy",
  "FieldServicePolicy-slaAtRiskHours",
  "FieldServicePolicy-requiredWorkPhotoCount",
  "FieldServicePolicy-checklistRequired",
  "FieldServicePolicy-customerSignOffRequired",
  "FieldServicePolicy-allowSignOffSkip",
  "FieldServicePolicy-customerReviewRequired",
  "FieldServicePolicy-checklistTemplateID",
  "FieldServicePolicy-checklistTemplateID:FieldServiceChecklistTemplate-name",
  "FieldServicePolicy-reviewTemplateID",
  "FieldServicePolicy-reviewTemplateID:FieldServiceReviewTemplate-name",
  "FieldServicePolicy-skipReasonListID",
  "FieldServicePolicy-blockedReasonListID",
  "FieldServicePolicy-taskChangedSince",
];

const DEFAULT_FIELD_SERVICE_POLICY = {
  slaAtRiskHours: 4,
  requiredWorkPhotoCount: 1,
  checklistRequired: true,
  customerSignOffRequired: true,
  allowSignOffSkip: true,
  customerReviewRequired: true,
  checklistTemplateID: "",
  reviewTemplateID: "",
  skipReasonListID: "",
  blockedReasonListID: "",
  taskChangedSince: "",
};

const DEFAULT_SIGN_OFF_SKIP_REASONS = [
  "Customer not present",
  "Remote site",
  "Customer declined signature",
  "Other",
];

const DEFAULT_BLOCKED_REASONS = [
  "Customer not available",
  "Missing parts or tools",
  "Site access issue",
  "Safety issue",
  "Other",
];

const WORKFLOW_STATUS = {
  ASSIGNED: "Assigned",
  EN_ROUTE: "En Route",
  ARRIVED_ONSITE: "Arrived Onsite",
  WORK_STARTED: "Work Started",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
};

const ACTIVE_WORKFLOW_STATUSES = [
  WORKFLOW_STATUS.ASSIGNED,
  WORKFLOW_STATUS.EN_ROUTE,
  WORKFLOW_STATUS.ARRIVED_ONSITE,
  WORKFLOW_STATUS.WORK_STARTED,
  WORKFLOW_STATUS.BLOCKED,
];

const IN_PROGRESS_WORKFLOW_STATUSES = [
  WORKFLOW_STATUS.EN_ROUTE,
  WORKFLOW_STATUS.ARRIVED_ONSITE,
  WORKFLOW_STATUS.WORK_STARTED,
  WORKFLOW_STATUS.BLOCKED,
];

const STATUS_TRANSITIONS = {
  [WORKFLOW_STATUS.ASSIGNED]: [
    WORKFLOW_STATUS.EN_ROUTE,
    WORKFLOW_STATUS.BLOCKED,
  ],
  [WORKFLOW_STATUS.EN_ROUTE]: [
    WORKFLOW_STATUS.ARRIVED_ONSITE,
    WORKFLOW_STATUS.BLOCKED,
  ],
  [WORKFLOW_STATUS.ARRIVED_ONSITE]: [
    WORKFLOW_STATUS.WORK_STARTED,
    WORKFLOW_STATUS.BLOCKED,
  ],
  [WORKFLOW_STATUS.WORK_STARTED]: [
    WORKFLOW_STATUS.COMPLETED,
    WORKFLOW_STATUS.BLOCKED,
  ],
  [WORKFLOW_STATUS.BLOCKED]: [WORKFLOW_STATUS.WORK_STARTED],
  [WORKFLOW_STATUS.COMPLETED]: [],
};

const getValue = (item, keys, fallback = "") => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
};

const getAddressDisplayValue = (value = "") => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  return [
    value.building,
    value.floor,
    value.mailStop,
    value.street,
    value.townCity,
    value.stateRegion,
    value.postZip,
    value.country,
  ]
    .filter(Boolean)
    .join(", ");
};

const getDisplayValue = (value, fallback = "") => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => getDisplayValue(item))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    const addressValue = getAddressDisplayValue(value);

    if (addressValue) {
      return addressValue;
    }

    const directValue =
      value.text ||
      value.name ||
      value.knownAs ||
      value.fullName ||
      value.extID ||
      value.extId ||
      value.id ||
      value.locationID;

    if (directValue) {
      return getDisplayValue(directValue, fallback);
    }

    return addressValue || fallback;
  }

  return String(value);
};

const isRawMongoId = (value) =>
  /^[a-f\d]{24}$/i.test(String(value || "").trim());

const decodeHtmlEntities = (value) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, String.fromCharCode(34))
    .replace(/&#39;/gi, String.fromCharCode(39))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f\d]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    );

const stripHtml = (value) =>
  decodeHtmlEntities(String(value || ""))
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const getUserFacingDisplayValue = (value, fallback = "") => {
  const displayValue = stripHtml(getDisplayValue(value));

  if (!displayValue || isRawMongoId(displayValue)) {
    return fallback;
  }

  return displayValue;
};

const isTechnicalListEntryValue = (value = "") => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return true;
  }

  return /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(normalizedValue);
};

const getGeoCoordinates = (value) => {
  if (Array.isArray(value) && value.length >= 2) {
    const longitude = Number(value[0]);
    const latitude = Number(value[1]);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  if (value && typeof value === "object") {
    const latitude = Number(value.latitude || value.lat);
    const longitude = Number(value.longitude || value.lng || value.lon);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
};

const getAddressCoordinates = (address) =>
  address && typeof address === "object"
    ? getGeoCoordinates(address.geoLoc)
    : null;

const getCoordinateQuery = (coordinates) =>
  coordinates ? `${coordinates.latitude},${coordinates.longitude}` : "";

const toBooleanValue = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
  }

  return false;
};

const flattenValues = (value) => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenValues);
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, nestedValue]) => [
      key,
      ...flattenValues(nestedValue),
    ]);
  }

  return [String(value)];
};

const normalizeRoleText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ");

const getNormalizedAccessRoleValues = (authenticationResult = {}) =>
  getAuthenticationAccessValues(authenticationResult).flatMap((value) => {
    const normalizedValue = normalizeRoleText(value);
    return [normalizedValue, normalizedValue.replace(/\s+/g, "")];
  });

const getAuthenticationAccessValues = (authenticationResult = {}) => {
  const userRecord = Array.isArray(authenticationResult.User)
    ? authenticationResult.User[0] || {}
    : authenticationResult.User || {};

  return [
    authenticationResult.accessRoles,
    authenticationResult["User-accessRoles"],
    userRecord.accessRoles,
    userRecord["User-accessRoles"],
  ].flatMap(flattenValues);
};

const hasFieldEngineerRole = (authenticationResult = {}) => {
  const values = getNormalizedAccessRoleValues(authenticationResult);

  return values.some((value) => FIELD_ENGINEER_ROLES.includes(value));
};

const hasFieldEngineerAdminRole = (authenticationResult = {}) => {
  const values = new Set(getNormalizedAccessRoleValues(authenticationResult));

  return values.has(FIELD_ENGINEER_ADMIN_ACCESS);
};

const hasValue = (value) =>
  value !== undefined && value !== null && value !== "";

const getTaskStatus = (task = {}) => {
  const percentComplete = Number(task["Task-percentComplete"] || 0);
  const actualStart = task["Task-dates-actualStart"];
  const actualFinish = task["Task-dates-actualFinish"];
  const completed = hasValue(actualFinish) || percentComplete >= 100;
  const inProgress =
    hasValue(actualStart) && !hasValue(actualFinish) && percentComplete > 0;
  const assigned =
    !hasValue(actualStart) && !hasValue(actualFinish) && percentComplete === 0;

  if (completed) {
    return "Completed";
  }

  if (inProgress) {
    return "In Progress";
  }

  if (assigned) {
    return "Assigned";
  }

  return "Unknown";
};

const getAssignmentStorageId = (task = {}) => task.id || task.extId || "";

const DEFAULT_EXECUTION_STATE = {
  currentStatus: "",
  statusHistory: [],
  photos: [],
  checklist: [],
  reviewAcknowledgement: null,
  signOff: null,
  signOffHistory: [],
};

const readWorkflowStore = async () => {
  const storedValue = await AsyncStorage.getItem(
    FIELD_ENGINEER_WORKFLOW_STORAGE_KEY
  );

  if (!storedValue) {
    return {};
  }

  try {
    return JSON.parse(storedValue) || {};
  } catch (error) {
    console.error("Error parsing field engineer workflow store:", error);
    return {};
  }
};

const writeWorkflowStore = async (store) =>
  AsyncStorage.setItem(
    FIELD_ENGINEER_WORKFLOW_STORAGE_KEY,
    JSON.stringify(store)
  );

const readExecutionStore = async () => {
  const storedValue = await AsyncStorage.getItem(
    FIELD_ENGINEER_EXECUTION_STORAGE_KEY
  );

  if (!storedValue) {
    return {};
  }

  try {
    return JSON.parse(storedValue) || {};
  } catch (error) {
    console.error("Error parsing field engineer execution store:", error);
    return {};
  }
};

const writeExecutionStore = async (store) =>
  AsyncStorage.setItem(
    FIELD_ENGINEER_EXECUTION_STORAGE_KEY,
    JSON.stringify(store)
  );

const normalizeTemplateChecklistItem = (item, index) => {
  if (!item) {
    return null;
  }

  const itemId = item.itemID || item.id || `template-checklist-${index}`;
  const label = getUserFacingDisplayValue(item.label || item.name || "");

  if (!label) {
    return null;
  }

  return {
    id: itemId,
    itemID: itemId,
    label,
    helpText: getUserFacingDisplayValue(item.helpText || item.description || ""),
    required: toBooleanValue(item.required),
    completed: false,
    sequence: Number.isFinite(Number(item.sequence))
      ? Number(item.sequence)
      : index,
  };
};

const toBackendChecklistItem = (item = {}, index = 0) => {
  const itemID = item.itemID || item.id || `checklist-${index + 1}`;
  const backendItem = {
    itemID,
    label: item.label || "",
    helpText: item.helpText || "",
    required: toBooleanValue(item.required),
    completed: toBooleanValue(item.completed),
    sequence: Number.isFinite(Number(item.sequence))
      ? Number(item.sequence)
      : index + 1,
    completedOn: item.completedOn || "",
    completedBy: item.completedBy || "",
  };

  if (item.subID !== undefined && item.subID !== null && item.subID !== "") {
    backendItem.subID = item.subID;
  }

  return backendItem;
};

const toBackendStatusHistoryItem = (entry = {}) => {
  const backendEntry = {
    previousStatus: entry.previousStatus || "",
    newStatus: entry.newStatus || "",
    timestamp: entry.timestamp || "",
    location: entry.location || null,
    recordedBy: entry.recordedBy || "",
    reason: entry.reason || "",
  };

  if (entry.subID !== undefined && entry.subID !== null && entry.subID !== "") {
    backendEntry.subID = entry.subID;
  }

  return backendEntry;
};

const toBackendWorkPhotoItem = (photo = {}) => {
  const backendPhoto = {
    resourceID: photo.resourceID || photo.attachmentID || "",
    attachmentID: photo.attachmentID || "",
    timestamp: photo.timestamp || new Date().toISOString(),
    location: photo.location || null,
    uploadedBy: photo.uploadedBy || "",
    fileName: photo.fileName || "",
  };

  if (photo.subID !== undefined && photo.subID !== null && photo.subID !== "") {
    backendPhoto.subID = photo.subID;
  }

  return backendPhoto;
};

const toBackendSignOffHistoryItem = (entry = {}) => {
  const backendEntry = {
    eventType: entry.eventType || entry.eventKey || "",
    timestamp: entry.timestamp || "",
    recordedBy: entry.recordedBy || entry.engineerUserId || "",
    customerName: entry.customerName || "",
    reason: entry.reason || "",
  };

  if (entry.subID !== undefined && entry.subID !== null && entry.subID !== "") {
    backendEntry.subID = entry.subID;
  }

  return backendEntry;
};

const getChecklistItemKey = (item = {}) => item.itemID || item.id || "";

const getPhotoItemKey = (photo = {}) =>
  photo.resourceID || photo.attachmentID || photo.id || "";

const getHistoryItemKey = (entry = {}) =>
  [
    entry.previousStatus || "",
    entry.newStatus || "",
    entry.timestamp || "",
    entry.recordedBy || entry.engineerUserId || "",
    entry.reason || "",
  ].join("|");

const getSignOffHistoryItemKey = (entry = {}) =>
  [
    entry.eventType || entry.eventKey || "",
    entry.timestamp || "",
    entry.recordedBy || entry.engineerUserId || "",
    entry.customerName || "",
    entry.reason || "",
  ].join("|");

const dedupeByKey = (items = [], getKey) => {
  const keyedItems = new Map();
  const unkeyedItems = [];

  items.forEach((item) => {
    const key = getKey(item);

    if (!key) {
      unkeyedItems.push(item);
      return;
    }

    keyedItems.set(key, item);
  });

  return [...keyedItems.values(), ...unkeyedItems];
};

const applyExistingSubIDs = (items = [], existingItems = [], getKey) => {
  const existingByKey = new Map();

  existingItems.forEach((item) => {
    const key = getKey(item);

    if (key && item.subID !== undefined && item.subID !== null && item.subID !== "") {
      existingByKey.set(key, item.subID);
    }
  });

  return items.map((item) => {
    if (item.subID !== undefined && item.subID !== null && item.subID !== "") {
      return item;
    }

    const existingSubID = existingByKey.get(getKey(item));

    return existingSubID !== undefined ? { ...item, subID: existingSubID } : item;
  });
};

const isTemplateEffective = (template = {}) => {
  const now = new Date();
  const effectiveFrom = template.effectiveFrom
    ? new Date(template.effectiveFrom)
    : null;
  const effectiveTo = template.effectiveTo ? new Date(template.effectiveTo) : null;

  if (effectiveFrom && !Number.isNaN(effectiveFrom.getTime()) && effectiveFrom > now) {
    return false;
  }

  if (effectiveTo && !Number.isNaN(effectiveTo.getTime()) && effectiveTo < now) {
    return false;
  }

  return true;
};

const getTemplateMatchScore = (template = {}, task = {}) => {
  const taskRaw = task.raw || task;
  const taskType = getUserFacingDisplayValue(
    task.type || taskRaw["Task-type"] || taskRaw.type
  );
  const customerId =
    task.customerId || taskRaw["Task-customerID"] || taskRaw.customerID || "";
  const projectId =
    task.projectId ||
    taskRaw["Task-projectWbsID"] ||
    taskRaw["Task-projectID"] ||
    taskRaw.projectWbsID ||
    taskRaw.projectID ||
    "";
  let score = 0;

  if (template.customerID && template.customerID !== customerId) {
    return 0;
  }

  if (template.projectID && template.projectID !== projectId) {
    return 0;
  }

  if (
    template.taskType &&
    (!taskType || template.taskType.toLowerCase() !== taskType.toLowerCase())
  ) {
    return 0;
  }

  if (template.customerID) {
    score += 40;
  }

  if (template.projectID) {
    score += 30;
  }

  if (template.taskType) {
    score += 20;
  }

  if (template.defaultTemplate) {
    score += 10;
  }

  if (!template.customerID && !template.projectID && !template.taskType) {
    score += 5;
  }

  return score;
};

const mapChecklistTemplate = (template = {}) => ({
  id:
    template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-id`] ||
    template.id ||
    "",
  extID:
    template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-extID`] ||
    template.extID ||
    "",
  name:
    template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-name`] ||
    template.name ||
    "",
  description:
    template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-description`] ||
    template.description ||
    "",
  taskType:
    template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-taskType`] ||
    template.taskType ||
    "",
  customerID:
    template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-customerID`] ||
    template.customerID ||
    "",
  customerLabel:
    template[
      `${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-customerID:Customer-name-text`
    ] ||
    template.customerLabel ||
    "",
  customerExtID:
    template[
      `${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-customerID:Customer-extID`
    ] ||
    template.customerExtID ||
    "",
  projectID:
    template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-projectID`] ||
    template.projectID ||
    "",
  projectLabel:
    template[
      `${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-projectID:ProjectWBS-text-text`
    ] ||
    template.projectLabel ||
    "",
  projectExtID:
    template[
      `${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-projectID:ProjectWBS-extID`
    ] ||
    template.projectExtID ||
    "",
  effectiveFrom:
    template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-effectiveFrom`] ||
    template.effectiveFrom ||
    "",
  effectiveTo:
    template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-effectiveTo`] ||
    template.effectiveTo ||
    "",
  defaultTemplate: toBooleanValue(
    template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-defaultTemplate`] ||
      template.defaultTemplate
  ),
  items:
    (
      template[`${FIELD_SERVICE_CHECKLIST_TEMPLATE_OBJECT}-items`] ||
      template.items ||
      []
    ).filter((item) => item.intStatus !== INTSTATUS.DELETED),
});

const mapReviewTemplate = (template = {}) => ({
  id:
    template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-id`] ||
    template.id ||
    "",
  extID:
    template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-extID`] ||
    template.extID ||
    "",
  name:
    template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-name`] ||
    template.name ||
    "",
  description:
    template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-description`] ||
    template.description ||
    "",
  taskType:
    template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-taskType`] ||
    template.taskType ||
    "",
  customerID:
    template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-customerID`] ||
    template.customerID ||
    "",
  customerLabel:
    template[
      `${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-customerID:Customer-name-text`
    ] ||
    template.customerLabel ||
    "",
  customerExtID:
    template[
      `${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-customerID:Customer-extID`
    ] ||
    template.customerExtID ||
    "",
  projectID:
    template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-projectID`] ||
    template.projectID ||
    "",
  projectLabel:
    template[
      `${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-projectID:ProjectWBS-text-text`
    ] ||
    template.projectLabel ||
    "",
  projectExtID:
    template[
      `${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-projectID:ProjectWBS-extID`
    ] ||
    template.projectExtID ||
    "",
  effectiveFrom:
    template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-effectiveFrom`] ||
    template.effectiveFrom ||
    "",
  effectiveTo:
    template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-effectiveTo`] ||
    template.effectiveTo ||
    "",
  defaultTemplate: toBooleanValue(
    template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-defaultTemplate`] ||
      template.defaultTemplate
  ),
  items:
    (
      template[`${FIELD_SERVICE_REVIEW_TEMPLATE_OBJECT}-items`] ||
      template.items ||
      []
    ).filter((item) => item.intStatus !== INTSTATUS.DELETED),
});

const getNumberOrDefault = (value, fallback) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const mapFieldServicePolicy = (policy = {}) => ({
  id: policy[`${FIELD_SERVICE_POLICY_OBJECT}-id`] || policy.id || "",
  extID: policy[`${FIELD_SERVICE_POLICY_OBJECT}-extID`] || policy.extID || "",
  name: policy[`${FIELD_SERVICE_POLICY_OBJECT}-name`] || policy.name || "",
  taskType:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-taskType`] || policy.taskType || "",
  customerID:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-customerID`] ||
    policy.customerID ||
    "",
  customerLabel:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-customerID:Customer-name-text`] ||
    policy.customerLabel ||
    "",
  customerExtID:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-customerID:Customer-extID`] ||
    policy.customerExtID ||
    "",
  projectID:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-projectID`] || policy.projectID || "",
  projectLabel:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-projectID:ProjectWBS-text-text`] ||
    policy.projectLabel ||
    "",
  projectExtID:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-projectID:ProjectWBS-extID`] ||
    policy.projectExtID ||
    "",
  effectiveFrom:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-effectiveFrom`] ||
    policy.effectiveFrom ||
    "",
  effectiveTo:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-effectiveTo`] ||
    policy.effectiveTo ||
    "",
  defaultPolicy: toBooleanValue(
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-defaultPolicy`] ||
      policy.defaultPolicy
  ),
  defaultTemplate: toBooleanValue(
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-defaultPolicy`] ||
      policy.defaultPolicy ||
      policy.defaultTemplate
  ),
  slaAtRiskHours: getNumberOrDefault(
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-slaAtRiskHours`] ||
      policy.slaAtRiskHours,
    DEFAULT_FIELD_SERVICE_POLICY.slaAtRiskHours
  ),
  requiredWorkPhotoCount: getNumberOrDefault(
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-requiredWorkPhotoCount`] ||
      policy.requiredWorkPhotoCount,
    DEFAULT_FIELD_SERVICE_POLICY.requiredWorkPhotoCount
  ),
  checklistRequired: toBooleanValue(
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-checklistRequired`] ??
      policy.checklistRequired ??
      DEFAULT_FIELD_SERVICE_POLICY.checklistRequired
  ),
  customerSignOffRequired: toBooleanValue(
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-customerSignOffRequired`] ??
      policy.customerSignOffRequired ??
      DEFAULT_FIELD_SERVICE_POLICY.customerSignOffRequired
  ),
  allowSignOffSkip: toBooleanValue(
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-allowSignOffSkip`] ??
      policy.allowSignOffSkip ??
      DEFAULT_FIELD_SERVICE_POLICY.allowSignOffSkip
  ),
  customerReviewRequired: toBooleanValue(
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-customerReviewRequired`] ??
      policy.customerReviewRequired ??
      DEFAULT_FIELD_SERVICE_POLICY.customerReviewRequired
  ),
  checklistTemplateID:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-checklistTemplateID`] ||
    policy.checklistTemplateID ||
    "",
  checklistTemplateLabel:
    policy[
      `${FIELD_SERVICE_POLICY_OBJECT}-checklistTemplateID:FieldServiceChecklistTemplate-name`
    ] ||
    policy.checklistTemplateLabel ||
    "",
  reviewTemplateID:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-reviewTemplateID`] ||
    policy.reviewTemplateID ||
    "",
  reviewTemplateLabel:
    policy[
      `${FIELD_SERVICE_POLICY_OBJECT}-reviewTemplateID:FieldServiceReviewTemplate-name`
    ] ||
    policy.reviewTemplateLabel ||
    "",
  skipReasonListID:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-skipReasonListID`] ||
    policy.skipReasonListID ||
    "",
  blockedReasonListID:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-blockedReasonListID`] ||
    policy.blockedReasonListID ||
    "",
  taskChangedSince:
    policy[`${FIELD_SERVICE_POLICY_OBJECT}-taskChangedSince`] ||
    policy.taskChangedSince ||
    "",
});

const fetchFieldServiceChecklistTemplates = async ({
  forceRefresh = false,
} = {}) => {
  if (fieldServiceChecklistTemplateCache && !forceRefresh) {
    return fieldServiceChecklistTemplateCache;
  }

  try {
    const queryFields = {
      fields: FIELD_SERVICE_CHECKLIST_TEMPLATE_FIELDS,
    };

    const formData = new URLSearchParams({
      userID: APP.LOGIN_USER_ID,
      client: parseInt(APP.LOGIN_USER_CLIENT, 10),
      language: APP.LOGIN_USER_LANGUAGE,
      query: JSON.stringify(queryFields),
      testMode: TEST_MODE,
      intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      page: 1,
      limit: 50,
      start: 0,
    });

    const response = await fetchData(
      API_ENDPOINTS.QUERY,
      "POST",
      { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      formData.toString()
    );

    fieldServiceChecklistTemplateCache = Array.isArray(response?.data)
      ? response.data.map(mapChecklistTemplate).filter(isTemplateEffective)
      : [];

    return fieldServiceChecklistTemplateCache;
  } catch (error) {
    console.error("Error fetching field service checklist templates:", error);
    fieldServiceChecklistTemplateCache = [];
    return fieldServiceChecklistTemplateCache;
  }
};

const fetchFieldServiceListEntries = async (listExtID = "") => {
  const trimmedListExtID = String(listExtID || "").trim();

  if (!trimmedListExtID) {
    return [];
  }

  if (fieldServiceListEntryCache[trimmedListExtID]) {
    return fieldServiceListEntryCache[trimmedListExtID];
  }

  try {
    const queryFields = {
      fields: ["Lists-extID", "Lists-listEntries"],
      where: [
        {
          fieldName: "Lists-extID",
          operator: "=",
          value: trimmedListExtID,
        },
      ],
    };

    const formData = new URLSearchParams({
      userID: APP.LOGIN_USER_ID,
      client: parseInt(APP.LOGIN_USER_CLIENT, 10),
      language: APP.LOGIN_USER_LANGUAGE,
      query: JSON.stringify(queryFields),
      testMode: TEST_MODE,
      intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      page: 1,
      limit: 1,
      start: 0,
    });

    const response = await fetchData(
      API_ENDPOINTS.QUERY,
      "POST",
      { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      formData.toString()
    );

    const entries = response?.data?.[0]?.["Lists-listEntries"] || [];
    const normalizedEntries = entries
      .filter((entry) => entry?.intStatus !== INTSTATUS.DELETED)
      .map((entry) => {
        const entryName = getUserFacingDisplayValue(entry.entryName || "");
        const entryID = getUserFacingDisplayValue(entry.entryID || "");

        return entryName || (isTechnicalListEntryValue(entryID) ? "" : entryID);
      })
      .filter(Boolean);

    fieldServiceListEntryCache[trimmedListExtID] = normalizedEntries;
    return normalizedEntries;
  } catch (error) {
    console.error("Error fetching field service list entries:", error);
    return [];
  }
};

const saveFieldServiceChecklistTemplate = async (template = {}) => {
  const normalizedItems = (template.items || [])
    .map((item, index) => {
      const normalizedItem = {
        itemID: item.itemID || item.id || `item-${index + 1}`,
        label: item.label || "",
        required: toBooleanValue(item.required),
        sequence: getNumberOrDefault(item.sequence, index + 1),
        helpText: item.helpText || "",
      };

      if (item.subID !== undefined && item.subID !== null && item.subID !== "") {
        normalizedItem.subID = item.subID;
      }

      return normalizedItem;
    })
    .filter((item) => item.label.trim());
  const currentSubIds = new Set(
    normalizedItems
      .filter((item) => item.subID !== undefined && item.subID !== null)
      .map((item) => String(item.subID))
  );
  const deletedItems = (template.originalItems || [])
    .filter(
      (item) =>
        item.subID !== undefined &&
        item.subID !== null &&
        item.subID !== "" &&
        !currentSubIds.has(String(item.subID))
    )
    .map((item) => ({
      itemID: item.itemID || item.id || "",
      label: item.label || "",
      required: toBooleanValue(item.required),
      sequence: getNumberOrDefault(item.sequence, 0),
      helpText: item.helpText || "",
      subID: item.subID,
      intStatus: INTSTATUS.DELETED,
    }));

  const formData = {
    data: {
      "FieldServiceChecklistTemplate-id": template.id || "",
      "FieldServiceChecklistTemplate-client": parseInt(APP.LOGIN_USER_CLIENT, 10),
      "FieldServiceChecklistTemplate-component": "platform",
      "FieldServiceChecklistTemplate-extID": template.extID || "",
      "FieldServiceChecklistTemplate-name": template.name || "",
      "FieldServiceChecklistTemplate-description": template.description || "",
      "FieldServiceChecklistTemplate-taskType": template.taskType || "",
      "FieldServiceChecklistTemplate-customerID": template.customerID || "",
      "FieldServiceChecklistTemplate-projectID": template.projectID || "",
      "FieldServiceChecklistTemplate-effectiveFrom":
        template.effectiveFrom || null,
      "FieldServiceChecklistTemplate-effectiveTo": template.effectiveTo || null,
      "FieldServiceChecklistTemplate-defaultTemplate": toBooleanValue(
        template.defaultTemplate
      ),
      "FieldServiceChecklistTemplate-items": [...normalizedItems, ...deletedItems],
    },
  };

  const updateResponse = await updateFields(formData, {
    userID: APP.LOGIN_USER_ID,
    client: APP.LOGIN_USER_CLIENT,
    language: APP.LOGIN_USER_LANGUAGE,
    testMode: TEST_MODE,
    component: "platform",
    doNotReplaceAnyList: false,
  });

  if (hasUpdateFieldsError(updateResponse)) {
    throw new Error(
      getUpdateFieldsErrorMessage(updateResponse) ||
        "Unable to save field service checklist template."
    );
  }

  fieldServiceChecklistTemplateCache = null;
  return updateResponse;
};

const deleteFieldServiceChecklistTemplate = async (template = {}) => {
  if (!template.id) {
    throw new Error("Checklist template id is required for delete.");
  }

  const formData = {
    data: {
      "FieldServiceChecklistTemplate-id": template.id,
      "FieldServiceChecklistTemplate-client": parseInt(APP.LOGIN_USER_CLIENT, 10),
      "FieldServiceChecklistTemplate-component": "platform",
      "FieldServiceChecklistTemplate-extID": template.extID || "",
      "FieldServiceChecklistTemplate-intStatus": INTSTATUS.DELETED,
    },
  };

  const updateResponse = await updateFields(formData, {
    userID: APP.LOGIN_USER_ID,
    client: APP.LOGIN_USER_CLIENT,
    language: APP.LOGIN_USER_LANGUAGE,
    testMode: TEST_MODE,
    component: "platform",
  });

  if (hasUpdateFieldsError(updateResponse)) {
    throw new Error(
      getUpdateFieldsErrorMessage(updateResponse) ||
        "Unable to delete field service checklist template."
    );
  }

  fieldServiceChecklistTemplateCache = null;
  return updateResponse;
};

const saveFieldServiceReviewTemplate = async (template = {}) => {
  const normalizedItems = (template.items || [])
    .map((item, index) => {
      const normalizedItem = {
        itemID: item.itemID || item.id || `item-${index + 1}`,
        title: item.title || "",
        contentType: item.contentType || "document",
        sourcePath: Array.isArray(item.sourcePath || item.sourcePaths)
          ? (item.sourcePath || item.sourcePaths).join("\n")
          : item.sourcePath || item.sourcePaths || "",
        required: toBooleanValue(item.required),
        sequence: getNumberOrDefault(item.sequence, index + 1),
        htmlContent: item.htmlContent || item.content || "",
        resourceID: item.resourceID || item.resourceId || "",
        url: item.url || "",
      };

      if (item.subID !== undefined && item.subID !== null && item.subID !== "") {
        normalizedItem.subID = item.subID;
      }

      return normalizedItem;
    })
    .filter((item) => item.title.trim());
  const currentSubIds = new Set(
    normalizedItems
      .filter((item) => item.subID !== undefined && item.subID !== null)
      .map((item) => String(item.subID))
  );
  const deletedItems = (template.originalItems || [])
    .filter(
      (item) =>
        item.subID !== undefined &&
        item.subID !== null &&
        item.subID !== "" &&
        !currentSubIds.has(String(item.subID))
    )
    .map((item) => ({
      itemID: item.itemID || item.id || "",
      title: item.title || "",
      contentType: item.contentType || "document",
      sourcePath: Array.isArray(item.sourcePath || item.sourcePaths)
        ? (item.sourcePath || item.sourcePaths).join("\n")
        : item.sourcePath || item.sourcePaths || "",
      required: toBooleanValue(item.required),
      sequence: getNumberOrDefault(item.sequence, 0),
      htmlContent: item.htmlContent || item.content || "",
      resourceID: item.resourceID || item.resourceId || "",
      url: item.url || "",
      subID: item.subID,
      intStatus: INTSTATUS.DELETED,
    }));

  const formData = {
    data: {
      "FieldServiceReviewTemplate-id": template.id || "",
      "FieldServiceReviewTemplate-client": parseInt(APP.LOGIN_USER_CLIENT, 10),
      "FieldServiceReviewTemplate-component": "platform",
      "FieldServiceReviewTemplate-extID": template.extID || "",
      "FieldServiceReviewTemplate-name": template.name || "",
      "FieldServiceReviewTemplate-description": template.description || "",
      "FieldServiceReviewTemplate-taskType": template.taskType || "",
      "FieldServiceReviewTemplate-customerID": template.customerID || "",
      "FieldServiceReviewTemplate-projectID": template.projectID || "",
      "FieldServiceReviewTemplate-effectiveFrom": template.effectiveFrom || null,
      "FieldServiceReviewTemplate-effectiveTo": template.effectiveTo || null,
      "FieldServiceReviewTemplate-defaultTemplate": toBooleanValue(
        template.defaultTemplate
      ),
      "FieldServiceReviewTemplate-items": [...normalizedItems, ...deletedItems],
    },
  };

  const updateResponse = await updateFields(formData, {
    userID: APP.LOGIN_USER_ID,
    client: APP.LOGIN_USER_CLIENT,
    language: APP.LOGIN_USER_LANGUAGE,
    testMode: TEST_MODE,
    component: "platform",
    doNotReplaceAnyList: false,
  });

  if (hasUpdateFieldsError(updateResponse)) {
    throw new Error(
      getUpdateFieldsErrorMessage(updateResponse) ||
        "Unable to save field service review template."
    );
  }

  fieldServiceReviewTemplateCache = null;
  return updateResponse;
};

const deleteFieldServiceReviewTemplate = async (template = {}) => {
  if (!template.id) {
    throw new Error("Review template id is required for delete.");
  }

  const formData = {
    data: {
      "FieldServiceReviewTemplate-id": template.id,
      "FieldServiceReviewTemplate-client": parseInt(APP.LOGIN_USER_CLIENT, 10),
      "FieldServiceReviewTemplate-component": "platform",
      "FieldServiceReviewTemplate-extID": template.extID || "",
      "FieldServiceReviewTemplate-intStatus": INTSTATUS.DELETED,
    },
  };

  const updateResponse = await updateFields(formData, {
    userID: APP.LOGIN_USER_ID,
    client: APP.LOGIN_USER_CLIENT,
    language: APP.LOGIN_USER_LANGUAGE,
    testMode: TEST_MODE,
    component: "platform",
  });

  if (hasUpdateFieldsError(updateResponse)) {
    throw new Error(
      getUpdateFieldsErrorMessage(updateResponse) ||
        "Unable to delete field service review template."
    );
  }

  fieldServiceReviewTemplateCache = null;
  return updateResponse;
};

const fetchFieldServicePolicies = async ({ forceRefresh = false } = {}) => {
  if (fieldServicePolicyCache && !forceRefresh) {
    return fieldServicePolicyCache;
  }

  try {
    const queryFields = {
      fields: FIELD_SERVICE_POLICY_FIELDS,
    };

    const formData = new URLSearchParams({
      userID: APP.LOGIN_USER_ID,
      client: parseInt(APP.LOGIN_USER_CLIENT, 10),
      language: APP.LOGIN_USER_LANGUAGE,
      query: JSON.stringify(queryFields),
      testMode: TEST_MODE,
      intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      page: 1,
      limit: 50,
      start: 0,
    });

    const response = await fetchData(
      API_ENDPOINTS.QUERY,
      "POST",
      { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      formData.toString()
    );

    fieldServicePolicyCache = Array.isArray(response?.data)
      ? response.data.map(mapFieldServicePolicy).filter(isTemplateEffective)
      : [];

    return fieldServicePolicyCache;
  } catch (error) {
    console.error("Error fetching field service policies:", error);
    fieldServicePolicyCache = [];
    return fieldServicePolicyCache;
  }
};

const saveFieldServicePolicy = async (policy = {}) => {
  const formData = {
    data: {
      "FieldServicePolicy-id": policy.id || "",
      "FieldServicePolicy-client": parseInt(APP.LOGIN_USER_CLIENT, 10),
      "FieldServicePolicy-component": "platform",
      "FieldServicePolicy-extID": policy.extID || "",
      "FieldServicePolicy-name": policy.name || "",
      "FieldServicePolicy-taskType": policy.taskType || "",
      "FieldServicePolicy-customerID": policy.customerID || "",
      "FieldServicePolicy-projectID": policy.projectID || "",
      "FieldServicePolicy-effectiveFrom": policy.effectiveFrom || null,
      "FieldServicePolicy-effectiveTo": policy.effectiveTo || null,
      "FieldServicePolicy-defaultPolicy": toBooleanValue(policy.defaultPolicy),
      "FieldServicePolicy-slaAtRiskHours": getNumberOrDefault(
        policy.slaAtRiskHours,
        DEFAULT_FIELD_SERVICE_POLICY.slaAtRiskHours
      ),
      "FieldServicePolicy-requiredWorkPhotoCount": getNumberOrDefault(
        policy.requiredWorkPhotoCount,
        DEFAULT_FIELD_SERVICE_POLICY.requiredWorkPhotoCount
      ),
      "FieldServicePolicy-checklistRequired": toBooleanValue(
        policy.checklistRequired
      ),
      "FieldServicePolicy-customerSignOffRequired": toBooleanValue(
        policy.customerSignOffRequired
      ),
      "FieldServicePolicy-allowSignOffSkip": toBooleanValue(
        policy.allowSignOffSkip
      ),
      "FieldServicePolicy-customerReviewRequired": toBooleanValue(
        policy.customerReviewRequired
      ),
      "FieldServicePolicy-checklistTemplateID": policy.checklistTemplateID || "",
      "FieldServicePolicy-reviewTemplateID": policy.reviewTemplateID || "",
      "FieldServicePolicy-skipReasonListID": policy.skipReasonListID || "",
      "FieldServicePolicy-blockedReasonListID":
        policy.blockedReasonListID || "",
      "FieldServicePolicy-taskChangedSince": policy.taskChangedSince || null,
    },
  };

  const updateResponse = await updateFields(formData, {
    userID: APP.LOGIN_USER_ID,
    client: APP.LOGIN_USER_CLIENT,
    language: APP.LOGIN_USER_LANGUAGE,
    testMode: TEST_MODE,
    component: "platform",
    doNotReplaceAnyList: true,
  });

  if (hasUpdateFieldsError(updateResponse)) {
    throw new Error(
      getUpdateFieldsErrorMessage(updateResponse) ||
        "Unable to save field service policy."
    );
  }

  fieldServicePolicyCache = null;
  return updateResponse;
};

const deleteFieldServicePolicy = async (policy = {}) => {
  if (!policy.id) {
    throw new Error("Policy id is required for delete.");
  }

  const formData = {
    data: {
      "FieldServicePolicy-id": policy.id,
      "FieldServicePolicy-client": parseInt(APP.LOGIN_USER_CLIENT, 10),
      "FieldServicePolicy-component": "platform",
      "FieldServicePolicy-extID": policy.extID || "",
      "FieldServicePolicy-intStatus": INTSTATUS.DELETED,
    },
  };

  const updateResponse = await updateFields(formData, {
    userID: APP.LOGIN_USER_ID,
    client: APP.LOGIN_USER_CLIENT,
    language: APP.LOGIN_USER_LANGUAGE,
    testMode: TEST_MODE,
    component: "platform",
  });

  if (hasUpdateFieldsError(updateResponse)) {
    throw new Error(
      getUpdateFieldsErrorMessage(updateResponse) ||
        "Unable to delete field service policy."
    );
  }

  fieldServicePolicyCache = null;
  return updateResponse;
};

const deleteFieldServiceAttachment = async (attachmentId = "") => {
  if (!attachmentId) {
    return null;
  }

  const updateResponse = await updateFields(
    {
      data: {
        "Attachment-id": attachmentId,
        "Attachment-intStatus": INTSTATUS.DELETED,
      },
    },
    {
      userID: APP.LOGIN_USER_ID,
      client: APP.LOGIN_USER_CLIENT,
      language: APP.LOGIN_USER_LANGUAGE,
      testMode: TEST_MODE,
      component: "platform",
      doNotReplaceAnyList: true,
    }
  );

  if (hasUpdateFieldsError(updateResponse)) {
    throw new Error(
      getUpdateFieldsErrorMessage(updateResponse) ||
        "Unable to delete field service attachment."
    );
  }

  return updateResponse;
};

const fetchAttachmentResourceInfo = async (attachmentId = "") => {
  if (!attachmentId) {
    return {};
  }

  try {
    const queryFields = {
      fields: [
        "Attachment-id",
        "Attachment-original",
        "Attachment-thumbnail",
        "Attachment-sourceFile",
        "Attachment-mIMEtype",
      ],
      where: [
        {
          fieldName: "Attachment-id",
          operator: "=",
          value: attachmentId,
        },
      ],
    };

    const formData = new URLSearchParams({
      userID: APP.LOGIN_USER_ID,
      client: parseInt(APP.LOGIN_USER_CLIENT, 10),
      language: APP.LOGIN_USER_LANGUAGE,
      query: JSON.stringify(queryFields),
      testMode: TEST_MODE,
      intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      page: 1,
      limit: 1,
      start: 0,
    });

    const response = await fetchData(
      API_ENDPOINTS.QUERY,
      "POST",
      { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      formData.toString()
    );

    const attachment = Array.isArray(response?.data) ? response.data[0] : null;

    return attachment
      ? {
          id: attachment["Attachment-id"] || attachment.id || attachmentId,
          original:
            attachment["Attachment-original"] || attachment.original || "",
          thumbnail:
            attachment["Attachment-thumbnail"] || attachment.thumbnail || "",
          fileName:
            attachment["Attachment-sourceFile"] || attachment.sourceFile || "",
          mimeType: attachment["Attachment-mIMEtype"] || attachment.mIMEtype || "",
        }
      : {};
  } catch (error) {
    console.error("Error fetching attachment resource info:", error);
    return {};
  }
};

const getFieldServicePolicy = async (task = {}) => {
  const policies = await fetchFieldServicePolicies();
  const selectedPolicy = policies
    .map((policy) => ({
      policy,
      score: getTemplateMatchScore(policy, task),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.policy;

  return {
    ...DEFAULT_FIELD_SERVICE_POLICY,
    ...(selectedPolicy || {}),
  };
};

const fetchFieldServiceChecklistTemplateItems = async (task = {}) => {
  const templates = await fetchFieldServiceChecklistTemplates();

  if (!templates.length) {
    return [];
  }

  const selectedTemplate = templates
    .map((template) => ({
      template,
      score: getTemplateMatchScore(template, task),
    }))
    .filter(({ template, score }) => score > 0 && template.items?.length > 0)
    .sort((a, b) => b.score - a.score)[0]?.template;

  return selectedTemplate
    ? selectedTemplate.items
        .map((item, index) => normalizeTemplateChecklistItem(item, index))
        .filter(Boolean)
        .sort((a, b) => a.sequence - b.sequence)
    : [];
};

const fetchFieldServiceReviewTemplates = async ({ forceRefresh = false } = {}) => {
  if (fieldServiceReviewTemplateCache && !forceRefresh) {
    return fieldServiceReviewTemplateCache;
  }

  try {
    const queryFields = {
      fields: FIELD_SERVICE_REVIEW_TEMPLATE_FIELDS,
    };

    const formData = new URLSearchParams({
      userID: APP.LOGIN_USER_ID,
      client: parseInt(APP.LOGIN_USER_CLIENT, 10),
      language: APP.LOGIN_USER_LANGUAGE,
      query: JSON.stringify(queryFields),
      testMode: TEST_MODE,
      intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      page: 1,
      limit: 50,
      start: 0,
    });

    const response = await fetchData(
      API_ENDPOINTS.QUERY,
      "POST",
      { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      formData.toString()
    );

    fieldServiceReviewTemplateCache = Array.isArray(response?.data)
      ? response.data.map(mapReviewTemplate).filter(isTemplateEffective)
      : [];

    return fieldServiceReviewTemplateCache;
  } catch (error) {
    console.error("Error fetching field service review templates:", error);
    fieldServiceReviewTemplateCache = [];
    return fieldServiceReviewTemplateCache;
  }
};

const normalizeSourcePathEntries = (sourcePath) => {
  const sourcePaths = Array.isArray(sourcePath)
    ? sourcePath
    : String(sourcePath || "")
        .split(/\r?\n|;/)
        .map((path) => path.trim());

  return sourcePaths
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf("|");

      if (separatorIndex === -1) {
        return { title: "", path: entry.trim() };
      }

      return {
        title: entry.slice(0, separatorIndex).trim(),
        path: entry.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((entry) => entry.path);
};

const getValueByDotPath = (source, path) => {
  if (!source || !path) {
    return undefined;
  }

  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((currentValue, segment) => {
      if (currentValue === undefined || currentValue === null) {
        return undefined;
      }

      if (Array.isArray(currentValue)) {
        const index = Number(segment);
        return Number.isInteger(index) ? currentValue[index] : undefined;
      }

      return currentValue[segment];
    }, source);
};

const getTaskValueBySourcePath = (task = {}, sourcePath = "") => {
  const raw = task.raw || task;
  const path = String(sourcePath || "").trim();

  if (!path) {
    return undefined;
  }

  if (raw[path] !== undefined) {
    return raw[path];
  }

  if (task[path] !== undefined) {
    return task[path];
  }

  const matchingRawKey = Object.keys(raw).find((key) => path.startsWith(`${key}.`));

  if (matchingRawKey) {
    return getValueByDotPath(
      raw[matchingRawKey],
      path.slice(matchingRawKey.length + 1)
    );
  }

  return getValueByDotPath(raw, path) ?? getValueByDotPath(task, path);
};

const getReviewValueByPath = (task = {}, relatedObjects = {}, sourcePath = "") => {
  const path = String(sourcePath || "").trim();

  if (!path) {
    return undefined;
  }

  if (path.startsWith("related.")) {
    const [, relatedName, ...relatedPathSegments] = path.split(".");
    const relatedObject = relatedObjects?.[relatedName];
    const relatedPath = relatedPathSegments.join(".");

    return getTaskValueBySourcePath(relatedObject || {}, relatedPath);
  }

  return getTaskValueBySourcePath(task, path);
};

const getFirstReviewValueByPaths = (task = {}, relatedObjects = {}, paths = []) => {
  const pathList = Array.isArray(paths) ? paths : [paths];

  for (const path of pathList) {
    const value = getReviewValueByPath(task, relatedObjects, path);

    if (
      getUserFacingDisplayValue(value) ||
      (typeof value === "string" && value.trim()) ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      (Array.isArray(value) && value.length > 0) ||
      (value && typeof value === "object")
    ) {
      return value;
    }
  }

  return undefined;
};

const normalizeDynamicReviewValue = (templateItem, sourceEntry, value, index) => {
  const baseTitle = sourceEntry.title || templateItem.title || templateItem.label;

  if (Array.isArray(value)) {
    return value
      .map((item, itemIndex) =>
        normalizeDynamicReviewValue(
          templateItem,
          sourceEntry,
          item,
          `${index}-${itemIndex}`
        )
      )
      .flat()
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    return [
      normalizeReviewItem(
        {
          ...templateItem,
          ...value,
          title: value.title || value.label || baseTitle,
          id:
            value.id ||
            value.itemID ||
            value.resourceID ||
            value.resourceId ||
            `${templateItem.itemID || templateItem.id || "review"}-${index}`,
          resourceId:
            value.resourceID ||
            value.resourceId ||
            value.attachmentId ||
            value.fileId ||
            templateItem.resourceID ||
            templateItem.resourceId,
          content: value.htmlContent || value.content || value.html,
          url: value.url || value.uri,
        },
        index
      ),
    ].filter(Boolean);
  }

  const displayValue = getUserFacingDisplayValue(value);

  if (!displayValue) {
    return [];
  }

  const looksLikeUrl = /^https?:\/\//i.test(displayValue);
  const looksLikeResourceId = /^[0-9a-f]{24}$/i.test(displayValue);

  return [
    normalizeReviewItem(
      {
        ...templateItem,
        id: `${templateItem.itemID || templateItem.id || "review"}-${index}`,
        title: baseTitle,
        contentType:
          templateItem.contentType ||
          (looksLikeUrl || looksLikeResourceId ? "document" : "rich text"),
        resourceId: looksLikeResourceId ? displayValue : templateItem.resourceID,
        url: looksLikeUrl ? displayValue : templateItem.url,
        content:
          looksLikeUrl || looksLikeResourceId
            ? templateItem.htmlContent || templateItem.content
            : displayValue,
      },
      index
    ),
  ].filter(Boolean);
};

const resolveReviewTemplateItem = (item = {}, task = {}, index = 0) => {
  const sourceEntries = normalizeSourcePathEntries(
    item.sourcePath || item.sourcePaths
  );

  if (!sourceEntries.length) {
    return [
      normalizeReviewItem(
        {
          ...item,
          id: item.itemID || item.id,
          content: item.htmlContent || item.content,
          resourceId: item.resourceID || item.resourceId,
        },
        index
      ),
    ].filter(Boolean);
  }

  return sourceEntries.flatMap((sourceEntry, sourceIndex) => {
    const value = getTaskValueBySourcePath(task, sourceEntry.path);

    return normalizeDynamicReviewValue(
      item,
      sourceEntry,
      value,
      `${index}-${sourceIndex}`
    );
  });
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatReviewFieldValue = (field = {}, value = "") => {
  const label = field.label || field.title || field.path || "";
  const displayValue = field.preserveHtml
    ? getDisplayValue(value)
    : getUserFacingDisplayValue(value);

  if (!displayValue) {
    return "";
  }

  if (field.preserveHtml) {
    return `<section><h3>${escapeHtml(label)}</h3>${displayValue}</section>`;
  }

  return `<p><strong>${escapeHtml(label)}</strong>: ${escapeHtml(displayValue)}</p>`;
};

const humanizeCustomFieldLabel = (key = "") =>
  String(key || "")
    .replace(/^cf_/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatCustomFieldMapValues = (
  customFieldsMap = {},
  { excludeKeys = [] } = {}
) => {
  if (!customFieldsMap || typeof customFieldsMap !== "object") {
    return [];
  }

  const excludedKeys = new Set(
    excludeKeys.map((key) => String(key || "").toLowerCase())
  );

  return Object.entries(customFieldsMap)
    .filter(([key, value]) => {
      if (excludedKeys.has(String(key || "").toLowerCase())) {
        return false;
      }

      return !!getDisplayValue(value);
    })
    .map(([key, value]) =>
      formatReviewFieldValue(
        {
          label: humanizeCustomFieldLabel(key),
          preserveHtml: /<[^>]+>/.test(String(value || "")),
        },
        value
      )
    )
    .filter(Boolean);
};

const getLinkedReviewObjectId = (task = {}, relatedObjects = {}, source = {}) => {
  if (source.type !== "linkedObject") {
    return getDisplayValue(
      getFirstReviewValueByPaths(task, relatedObjects, source.paths || source.path)
    );
  }

  const links = getFirstReviewValueByPaths(
    task,
    relatedObjects,
    source.paths || source.path
  );
  const link = Array.isArray(links)
    ? links.find(
        (item) =>
          String(item?.busObjCat || "").toLowerCase() ===
            String(source.busObjCat || "").toLowerCase() &&
          Number(item?.intStatus || 0) === INTSTATUS.ACTIVE
      ) ||
      links.find(
        (item) =>
          String(item?.busObjCat || "").toLowerCase() ===
          String(source.busObjCat || "").toLowerCase()
      )
    : null;

  return getDisplayValue(link?.[source.idField || "id"] || link?.id);
};

const fetchReviewRelatedObject = async (
  config = {},
  task = {},
  relatedObjects = {}
) => {
  const objectId = getLinkedReviewObjectId(
    task,
    relatedObjects,
    config.source || {}
  );

  if (!objectId || !config.busObjCat) {
    if (config.busObjCat) {
      console.log(
        `Field service review: no related ${config.busObjCat} id found.`
      );
    }
    return null;
  }

  try {
    const queryFields = {
      fields: config.fields || [`${config.busObjCat}-id`],
      where: [
        {
          fieldName: `${config.busObjCat}-id`,
          operator: "=",
          value: objectId,
        },
      ],
    };

    const formData = new URLSearchParams({
      userID: APP.LOGIN_USER_ID,
      client: parseInt(APP.LOGIN_USER_CLIENT, 10),
      language: APP.LOGIN_USER_LANGUAGE,
      query: JSON.stringify(queryFields),
      testMode: TEST_MODE,
      intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      page: 1,
      limit: 1,
      start: 0,
    });

    const response = await fetchData(
      API_ENDPOINTS.QUERY,
      "POST",
      { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      formData.toString()
    );

    const relatedObject = Array.isArray(response?.data)
      ? response.data[0] || null
      : null;

    if (!relatedObject) {
      console.log(
        `Field service review: ${config.busObjCat} ${objectId} was not returned.`
      );
    }

    return relatedObject;
  } catch (error) {
    console.error("Error fetching field service review related object:", error);
    return null;
  }
};

const fetchReviewRelatedObjects = async (clientConfig = {}, task = {}) => {
  const entries = Object.entries(clientConfig.relatedObjects || {});

  if (!entries.length) {
    return {};
  }

  const result = {};

  for (const [name, config] of entries) {
    const value = await fetchReviewRelatedObject(config, task, result);

    if (value) {
      result[name] = value;
    }
  }

  return result;
};

const resolveConfiguredReviewOverrideItem = (
  item = {},
  task = {},
  relatedObjects = {},
  index = 0
) => {
  if (Array.isArray(item.fields) && item.fields.length > 0) {
    const customFieldMapConfigs = item.includeCustomFieldMaps || [];
    const customFieldMapContent =
      item.customFieldMapMode === "firstAvailable"
        ? customFieldMapConfigs
            .map((customFieldConfig) =>
              formatCustomFieldMapValues(
                getReviewValueByPath(
                  task,
                  relatedObjects,
                  customFieldConfig.path
                ),
                customFieldConfig
              )
            )
            .find((values) => values.length > 0) || []
        : customFieldMapConfigs
            .flatMap((customFieldConfig) =>
              formatCustomFieldMapValues(
                getReviewValueByPath(
                  task,
                  relatedObjects,
                  customFieldConfig.path
                ),
                customFieldConfig
              )
            )
            .filter(Boolean);
    const explicitFieldContent = item.fields
      .map((field) =>
        formatReviewFieldValue(
          field,
          getFirstReviewValueByPaths(
            task,
            relatedObjects,
            field.paths || field.path
          )
        )
      )
      .filter(Boolean);
    const content = [...customFieldMapContent, ...explicitFieldContent].join("");

    if (!content) {
      return null;
    }

    return normalizeReviewItem(
      {
        ...item,
        id: item.id || `client-review-${index}`,
        contentType: item.contentType || "rich text",
        content,
      },
      index
    );
  }

  if (item.resourcePath || item.resourcePaths) {
    const resourceId = getDisplayValue(
      getFirstReviewValueByPaths(
        task,
        relatedObjects,
        item.resourcePaths || item.resourcePath
      )
    );

    if (!resourceId) {
      return null;
    }

    return normalizeReviewItem(
      {
        ...item,
        id: item.id || `${item.resourcePath}-${index}`,
        contentType: item.contentType || "document",
        resourceId,
      },
      index
    );
  }

  if (item.sourcePath) {
    const value = getReviewValueByPath(task, relatedObjects, item.sourcePath);
    return normalizeDynamicReviewValue(
      item,
      { title: item.title || "", path: item.sourcePath },
      value,
      `client-${index}`
    )[0];
  }

  return normalizeReviewItem(item, index);
};

const resolveClientReviewOverrideItems = async (task = {}) => {
  const clientConfig =
    fieldServiceReviewOverrides.users?.[String(APP.LOGIN_USER_ID)] ||
    fieldServiceReviewOverrides.persons?.[String(APP.LOGIN_USER_PERSON_ID)] ||
    fieldServiceReviewOverrides.clients?.[String(APP.LOGIN_USER_CLIENT)] ||
    fieldServiceReviewOverrides[String(APP.LOGIN_USER_CLIENT)] ||
    fieldServiceReviewOverrides[APP.LOGIN_USER_CLIENT];

  if (!clientConfig?.reviewItems?.length) {
    return [];
  }

  const relatedObjects = await fetchReviewRelatedObjects(clientConfig, task);

  return clientConfig.reviewItems
    .map((item, index) =>
      resolveConfiguredReviewOverrideItem(item, task, relatedObjects, index)
    )
    .filter(Boolean);
};

const fetchFieldServiceReviewItems = async (task = {}) => {
  const templates = await fetchFieldServiceReviewTemplates();

  const selectedTemplate = templates
    .map((template) => ({
      template,
      score: getTemplateMatchScore(template, task),
    }))
    .filter(({ template, score }) => score > 0 && template.items?.length > 0)
    .sort((a, b) => b.score - a.score)[0]?.template;

  const templateItems = selectedTemplate
    ? selectedTemplate.items
        .flatMap((item, index) => resolveReviewTemplateItem(item, task, index))
        .filter(Boolean)
        .sort((a, b) => {
          const aSequence = Number(a.raw?.sequence);
          const bSequence = Number(b.raw?.sequence);

          if (Number.isFinite(aSequence) && Number.isFinite(bSequence)) {
            return aSequence - bSequence;
          }

          return 0;
        })
    : [];

  return dedupeReviewItems([
    ...templateItems,
    ...(await resolveClientReviewOverrideItems(task)),
  ]);
};

const fetchFieldEngineerChecklistItems = async (task = {}) => {
  try {
    return await fetchFieldServiceChecklistTemplateItems(task);
  } catch (error) {
    console.error("Error fetching field service checklist template:", error);
    return [];
  }
};

const fromBackendGeoLoc = (location) => {
  if (!location) {
    return null;
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const getExecutionRecordValue = (record = {}, fieldName, fallback = null) => {
  const prefixedFieldName = `${FIELD_SERVICE_EXECUTION_OBJECT}-${fieldName}`;
  const value = record[prefixedFieldName] ?? record[fieldName];

  return value === undefined || value === null ? fallback : value;
};

const mapBackendChecklistItem = (item = {}) => ({
  id: item.itemID || item.id || "",
  itemID: item.itemID || item.id || "",
  subID: item.subID,
  label: item.label || "",
  helpText: item.helpText || "",
  required: toBooleanValue(item.required),
  completed: toBooleanValue(item.completed),
  completedOn: item.completedOn || "",
  completedBy: item.completedBy || "",
});

const mapBackendPhoto = (photo = {}) => ({
  id: photo.resourceID || photo.attachmentID || photo.id || `${Date.now()}`,
  subID: photo.subID,
  uri: photo.uri || "",
  resourceID: photo.resourceID || "",
  attachmentID: photo.attachmentID || "",
  timestamp: photo.timestamp || "",
  location: fromBackendGeoLoc(photo.location),
  uploadedBy: photo.uploadedBy || "",
  fileName: photo.fileName || "",
});

const mapBackendSignOff = (signOff = null) =>
  signOff
    ? {
        type: signOff.type || "",
        customerName: signOff.customerName || "",
        signatureResourceID: signOff.signatureResourceID || "",
        signatureAttachmentID: signOff.signatureAttachmentID || "",
        signatureUri: signOff.signatureUri || "",
        reason: signOff.skipReason || signOff.reason || "",
        timestamp: signOff.timestamp || "",
        engineerUserId: signOff.collectedBy || signOff.engineerUserId || "",
        engineerUserName: signOff.engineerUserName || "",
        signaturePaths: signOff.signaturePaths || [],
        signatureImage: signOff.signatureImage || "",
      }
    : null;

const mapBackendExecutionRecord = (record = {}) => ({
  id: getExecutionRecordValue(record, "id", ""),
  taskID: getExecutionRecordValue(record, "taskID", ""),
  taskExtID: getExecutionRecordValue(record, "taskExtID", ""),
  currentStatus: getExecutionRecordValue(record, "currentStatus", ""),
  statusHistory: dedupeByKey(
    (getExecutionRecordValue(record, "statusHistory", []) || [])
      .map((entry) => ({
        subID: entry.subID,
        previousStatus: entry.previousStatus || "",
        newStatus: entry.newStatus || "",
        timestamp: entry.timestamp || "",
        location: fromBackendGeoLoc(entry.location),
        recordedBy: entry.recordedBy || "",
        recordedByName: entry.recordedByName || "",
        reason: entry.reason || "",
      }))
      .filter((entry) => entry.newStatus || entry.timestamp),
    getHistoryItemKey
  ),
  checklist: dedupeByKey(
    (getExecutionRecordValue(record, "checklist", []) || [])
      .map(mapBackendChecklistItem)
      .filter((item) => item.id || item.label),
    getChecklistItemKey
  ),
  photos: dedupeByKey(
    (getExecutionRecordValue(record, "workPhotos", []) || [])
      .map(mapBackendPhoto)
      .filter((photo) => photo.resourceID || photo.attachmentID || photo.uri),
    getPhotoItemKey
  ),
  reviewAcknowledgement:
    getExecutionRecordValue(record, "reviewAcknowledgement", null) || null,
  signOff: mapBackendSignOff(getExecutionRecordValue(record, "signOff", null)),
  signOffHistory: dedupeByKey(
    (getExecutionRecordValue(record, "signOffHistory", []) || []).map(
      (entry) => ({
        ...entry,
        eventType: entry.eventType || entry.eventKey || "",
        eventKey: entry.eventKey || entry.eventType || "",
        recordedBy: entry.recordedBy || entry.engineerUserId || "",
        engineerUserId: entry.engineerUserId || entry.recordedBy || "",
      })
    ),
    getSignOffHistoryItemKey
  ),
  completedOn: getExecutionRecordValue(record, "completedOn", ""),
  completedBy: getExecutionRecordValue(record, "completedBy", ""),
  validationSnapshotJson: getExecutionRecordValue(
    record,
    "validationSnapshotJson",
    ""
  ),
});

const hydrateResourceUri = async (resourceId) => {
  if (!resourceId) {
    return "";
  }

  try {
    return (await fetchAndCacheResource(resourceId)) || "";
  } catch (error) {
    console.error("Error hydrating field service resource:", error);
    return "";
  }
};

const hydratePhotoResource = async (photo = {}) => {
  const attachmentId = photo.attachmentID || photo.attachmentId || "";
  let resourceId =
    photo.resourceID && photo.resourceID !== attachmentId ? photo.resourceID : "";

  if (!resourceId && attachmentId) {
    const attachmentInfo = await fetchAttachmentResourceInfo(attachmentId);
    resourceId = attachmentInfo.original || "";

    if (resourceId) {
      const uri = await hydrateResourceUri(resourceId);

      if (uri) {
        return {
          ...photo,
          uri,
          resourceID: resourceId,
          thumbnailID: attachmentInfo.thumbnail || photo.thumbnailID || "",
          fileName: photo.fileName || attachmentInfo.fileName || "",
        };
      }
    }
  }

  if (resourceId) {
    const uri = await hydrateResourceUri(resourceId);

    if (uri) {
      return { ...photo, uri, resourceID: resourceId };
    }
  }

  if (attachmentId) {
    const uri = await hydrateResourceUri(attachmentId);

    if (uri) {
      return { ...photo, uri };
    }
  }

  return { ...photo, resourceUnavailable: true };
};

const hydrateExecutionAssets = async (executionState = {}) => {
  const photos = await Promise.all(
    (executionState.photos || []).map(async (photo) => {
      if (photo.uri) {
        return photo;
      }

      return hydratePhotoResource(photo);
    })
  );

  const signOff = executionState.signOff;

  if (
    signOff?.type === "signed" &&
    !signOff.signatureUri &&
    (signOff.signatureResourceID || signOff.signatureAttachmentID)
  ) {
    const signatureUri = await hydrateResourceUri(
      signOff.signatureResourceID || signOff.signatureAttachmentID
    );

    return {
      ...executionState,
      photos,
      signOff: signatureUri ? { ...signOff, signatureUri } : signOff,
    };
  }

  return {
    ...executionState,
    photos,
  };
};

const getLocalExecutionState = async (task = {}) => {
  const assignmentId = getAssignmentStorageId(task);

  if (!assignmentId) {
    return DEFAULT_EXECUTION_STATE;
  }

  const executionStore = await readExecutionStore();
  const workflowStore = await readWorkflowStore();
  const storedState = executionStore[assignmentId] || {};
  const workflowState = workflowStore[assignmentId] || {};
  const checklist =
    storedState.checklist?.length > 0
      ? storedState.checklist
      : await fetchFieldEngineerChecklistItems(task);

  return {
    currentStatus: storedState.currentStatus || workflowState.status || "",
    statusHistory: storedState.statusHistory || workflowState.history || [],
    photos: storedState.photos || [],
    checklist,
    reviewAcknowledgement: storedState.reviewAcknowledgement || null,
    signOff: storedState.signOff || null,
    signOffHistory: storedState.signOffHistory || [],
  };
};

const fetchFieldServiceExecutionRecord = async (task = {}) => {
  if (!task.id) {
    return null;
  }

  try {
    const queryFields = {
      fields: FIELD_SERVICE_EXECUTION_FIELDS,
      where: [
        {
          fieldName: "FieldServiceExecution-taskID",
          operator: "=",
          value: task.id,
        },
      ],
    };

    const formData = new URLSearchParams({
      userID: APP.LOGIN_USER_ID,
      client: parseInt(APP.LOGIN_USER_CLIENT, 10),
      language: APP.LOGIN_USER_LANGUAGE,
      query: JSON.stringify(queryFields),
      testMode: TEST_MODE,
      intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      page: 1,
      limit: 1,
      start: 0,
    });

    const response = await fetchData(
      API_ENDPOINTS.QUERY,
      "POST",
      { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      formData.toString()
    );

    return Array.isArray(response?.data) ? response.data[0] || null : null;
  } catch (error) {
    console.error("Error fetching field service execution:", error);
    return null;
  }
};

const saveLocalExecutionState = async (task = {}, executionState = {}) => {
  const assignmentId = getAssignmentStorageId(task);

  if (!assignmentId) {
    throw new Error("Assignment id is required to save execution state.");
  }

  const executionStore = await readExecutionStore();
  const nextState = {
    currentStatus: executionState.currentStatus || "",
    statusHistory: executionState.statusHistory || [],
    photos: executionState.photos || [],
    checklist: executionState.checklist || [],
    reviewAcknowledgement: executionState.reviewAcknowledgement || null,
    signOff: executionState.signOff || null,
    signOffHistory: executionState.signOffHistory || [],
  };

  executionStore[assignmentId] = nextState;
  await writeExecutionStore(executionStore);

  return nextState;
};

const saveFieldServiceExecutionRecord = async ({
  task = {},
  executionState = {},
  workflowState = null,
  existingRecord = null,
  validationSnapshotJson = "",
} = {}) => {
  if (!task.id) {
    return null;
  }

  const existingExecution =
    existingRecord || (await fetchFieldServiceExecutionRecord(task));
  const existingMappedExecution = existingExecution
    ? mapBackendExecutionRecord(existingExecution)
    : {};
  const currentStatus =
    workflowState?.status ||
    executionState.currentStatus ||
    existingMappedExecution.currentStatus ||
    normalizeWorkflowStatus(task.status);
  const statusHistory =
    workflowState?.history ||
    executionState.statusHistory ||
    existingMappedExecution.statusHistory ||
    [];
  const completedOn =
    currentStatus === WORKFLOW_STATUS.COMPLETED
      ? statusHistory.find(
          (entry) => entry.newStatus === WORKFLOW_STATUS.COMPLETED
        )?.timestamp ||
        existingMappedExecution.completedOn ||
        new Date().toISOString()
      : existingMappedExecution.completedOn || null;
  const completedBy =
    currentStatus === WORKFLOW_STATUS.COMPLETED
      ? APP.LOGIN_USER_PERSON_ID || existingMappedExecution.completedBy || ""
      : existingMappedExecution.completedBy || "";
  const statusHistoryItems = applyExistingSubIDs(
    dedupeByKey(statusHistory, getHistoryItemKey),
    existingMappedExecution.statusHistory || [],
    getHistoryItemKey
  );
  const checklistItems = applyExistingSubIDs(
    dedupeByKey(
      executionState.checklist ||
        existingMappedExecution.checklist ||
        [],
      getChecklistItemKey
    ),
    existingMappedExecution.checklist || [],
    getChecklistItemKey
  );
  const workPhotoItems = applyExistingSubIDs(
    dedupeByKey(
      executionState.photos ||
        existingMappedExecution.photos ||
        [],
      getPhotoItemKey
    ),
    existingMappedExecution.photos || [],
    getPhotoItemKey
  );
  const signOffHistoryItems = applyExistingSubIDs(
    dedupeByKey(
      executionState.signOffHistory ||
        existingMappedExecution.signOffHistory ||
        [],
      getSignOffHistoryItemKey
    ),
    existingMappedExecution.signOffHistory || [],
    getSignOffHistoryItemKey
  );

  const executionData = {
    "FieldServiceExecution-taskID": task.id,
    "FieldServiceExecution-currentStatus": currentStatus,
    "FieldServiceExecution-statusHistory": statusHistoryItems.map(
      toBackendStatusHistoryItem
    ),
    "FieldServiceExecution-checklist": checklistItems.map(toBackendChecklistItem),
    "FieldServiceExecution-workPhotos": workPhotoItems.map(toBackendWorkPhotoItem),
    "FieldServiceExecution-reviewAcknowledgement":
      executionState.reviewAcknowledgement ||
      existingMappedExecution.reviewAcknowledgement ||
      null,
    "FieldServiceExecution-signOff":
      executionState.signOff || existingMappedExecution.signOff || null,
    "FieldServiceExecution-signOffHistory": signOffHistoryItems.map(
      toBackendSignOffHistoryItem
    ),
  };

  if (existingMappedExecution.id) {
    executionData["FieldServiceExecution-id"] = existingMappedExecution.id;
  }

  if (task.extId) {
    executionData["FieldServiceExecution-taskExtID"] = task.extId;
  }

  if (completedOn) {
    executionData["FieldServiceExecution-completedOn"] = completedOn;
  }

  if (completedBy) {
    executionData["FieldServiceExecution-completedBy"] = completedBy;
  }

  const snapshot =
    validationSnapshotJson || existingMappedExecution.validationSnapshotJson;

  if (snapshot) {
    executionData["FieldServiceExecution-validationSnapshotJson"] = snapshot;
  }

  const formData = {
    data: executionData,
  };

  const queryStringParams = {
    userID: APP.LOGIN_USER_ID,
    client: APP.LOGIN_USER_CLIENT,
    language: APP.LOGIN_USER_LANGUAGE,
    testMode: TEST_MODE,
    component: "platform",
    doNotReplaceAnyList: false,
  };

  const updateResponse = await updateFields(formData, queryStringParams);

  if (hasUpdateFieldsError(updateResponse)) {
    throw new Error(
      getUpdateFieldsErrorMessage(updateResponse) ||
        "Unable to save field service execution."
    );
  }

  return updateResponse;
};

const buildCompletionValidationSnapshot = ({
  task = {},
  executionState = {},
  workflowState = null,
  timestamp = "",
} = {}) => {
  const checklist = executionState.checklist || [];
  const requiredChecklist = checklist.filter((item) => item.required);
  const completedRequiredChecklist = requiredChecklist.filter(
    (item) => item.completed
  );
  const photos = executionState.photos || [];
  const reviewAcknowledged = !!executionState.reviewAcknowledgement;
  const signOff = executionState.signOff || null;

  return JSON.stringify({
    taskID: task.id || "",
    taskExtID: task.extId || "",
    completedAt: timestamp || new Date().toISOString(),
    completedBy: APP.LOGIN_USER_PERSON_ID || APP.LOGIN_USER_ID || "",
    status: workflowState?.status || WORKFLOW_STATUS.COMPLETED,
    requiredChecklistTotal: requiredChecklist.length,
    requiredChecklistCompleted: completedRequiredChecklist.length,
    workPhotoCount: photos.length,
    workPhotoAttachmentIds: photos
      .map((photo) => photo.attachmentID || photo.attachmentId || "")
      .filter(Boolean),
    reviewAcknowledged,
    signOffType: signOff?.type || "",
    signOffTimestamp: signOff?.timestamp || "",
    signatureAttachmentID: signOff?.signatureAttachmentID || "",
  });
};

const saveTaskExecutionFields = async ({
  task = {},
  newStatus = "",
  timestamp = "",
} = {}) => {
  if (!task.id) {
    return null;
  }

  const updateData = {
    "Task-id": task.id,
  };

  if (newStatus === WORKFLOW_STATUS.WORK_STARTED && !task.actualStart) {
    updateData["Task-dates-actualStart"] = timestamp;
    updateData["Task-percentComplete"] =
      Number(task.percentComplete || 0) > 0 ? task.percentComplete : 1;
  }

  if (newStatus === WORKFLOW_STATUS.COMPLETED) {
    updateData["Task-dates-actualFinish"] = timestamp;
    updateData["Task-percentComplete"] = 100;

    if (!task.actualStart) {
      updateData["Task-dates-actualStart"] = timestamp;
    }
  }

  if (Object.keys(updateData).length <= 1) {
    return null;
  }

  const updateResponse = await updateFields(
    { data: updateData },
    {
      userID: APP.LOGIN_USER_ID,
      client: APP.LOGIN_USER_CLIENT,
      language: APP.LOGIN_USER_LANGUAGE,
      testMode: TEST_MODE,
      component: "platform",
      doNotReplaceAnyList: true,
    }
  );

  if (hasUpdateFieldsError(updateResponse)) {
    throw new Error(
      getUpdateFieldsErrorMessage(updateResponse) ||
        "Unable to update assignment execution fields."
    );
  }

  return updateResponse;
};

const normalizeReviewItem = (item, index) => {
  if (!item) {
    return null;
  }

  const title = getUserFacingDisplayValue(
    item.title ||
      item.label ||
      item.name ||
      item.description ||
      item.documentTitle ||
      item.value
  );

  if (!title) {
    return null;
  }

  const contentType = getUserFacingDisplayValue(
    item.contentType ||
      item.documentType ||
      item.docType ||
      item.type ||
      item.mimeType ||
      "document"
  );

  return {
    id:
      getUserFacingDisplayValue(
        item.id || item.extId || item.extID || item.documentId || ""
      ) || `review-${index}`,
    title,
    contentType,
    required:
      toBooleanValue(item.required) ||
      toBooleanValue(item.mandatory) ||
      toBooleanValue(item.isRequired),
    content: item.content || item.html || item.richText || item.text || "",
    url: item.url || item.uri || item.fileUrl || item.documentUrl || "",
    resourceId:
      item.resourceId ||
      item.attachmentId ||
      item.fileId ||
      item.binaryResourceId ||
      "",
    raw: item,
  };
};

const dedupeReviewItems = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = [
      item.id || "",
      item.title || "",
      item.resourceId || "",
      item.url || "",
      item.content || "",
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const normalizeReviewItems = (task = {}) => {
  const rawReviewItems =
    task.customerReviewItems ||
    task.reviewItems ||
    task.raw?.["Task-customerReviewItems"] ||
    task.raw?.["Task-reviewItems"] ||
    task.raw?.["Task-customerReview"] ||
    task.raw?.["Task-projectCustomerReviewItems"] ||
    task.raw?.["Task-projectWbsID:ProjectWBS-customerReviewItems"] ||
    task.raw?.["Task-projectWbsID:ProjectWBS-reviewItems"] ||
    [];
  const items = Array.isArray(rawReviewItems) ? rawReviewItems : [];

  return dedupeReviewItems(items.map(normalizeReviewItem).filter(Boolean));
};

const getPreferredComm = (person = {}, types = []) => {
  const comms = Array.isArray(person.comms) ? person.comms : [];
  const normalizedTypes = types.map((type) => type.toLowerCase());
  const matchingComms = comms.filter((comm) =>
    normalizedTypes.includes(String(comm.type || "").toLowerCase())
  );
  const preferredComm =
    matchingComms.find((comm) => comm.preferred) || matchingComms[0];

  return getUserFacingDisplayValue(preferredComm?.addressOrNumber);
};

const getCustomerPrimaryContact = (customer = {}) => {
  const primaryContact = customer.primaryContact;

  if (primaryContact && typeof primaryContact === "object") {
    return primaryContact;
  }

  const partnerRoleContact = customer.busPartnerRoles?.find(
    (role) =>
      role.contact &&
      ["project lead", "client main contact"].includes(
        String(role.role || "").toLowerCase()
      )
  )?.contact;

  return typeof partnerRoleContact === "object" ? partnerRoleContact : {};
};

const getCustomerInfo = (task = {}) => {
  const customer = getValue(task, ["Task-customerID"]);
  const customerRecord =
    customer && typeof customer === "object" && !Array.isArray(customer)
      ? customer
      : {};
  const primaryContact = getCustomerPrimaryContact(customerRecord);
  const customerAddressRecord =
    getValue(task, ["Task-customerID:Customer-address"]) ||
    customerRecord.address ||
    {};
  const locationAddressRecord = getValue(task, [
    "Task-customerID:Customer-address-locationID:Location-address",
  ]);
  const customerName = getUserFacingDisplayValue(
    getValue(task, [
      "Task-customerID:Customer-name-text",
      "Task-customerID:Customer-extID",
    ]) ||
      customerRecord.name ||
      customerRecord.extID
  );
  const customerAddress =
    getUserFacingDisplayValue(
      getValue(task, ["Task-customerID:Customer-addressText"]) ||
        customerRecord.addressText ||
        customerAddressRecord
    ) || getUserFacingDisplayValue(locationAddressRecord);
  const customerLocationId = getUserFacingDisplayValue(
    getValue(task, ["Task-customerID:Customer-address-locationID"]) ||
      customerAddressRecord.locationID
  );
  const locationDisplayName = getUserFacingDisplayValue(
    getValue(task, [
      "Task-customerID:Customer-address-locationID:Location-extID",
      "Task-customerID:Customer-address-locationID:Location-text-text",
    ])
  );
  const customerAddressCoordinates = getAddressCoordinates(
    customerAddressRecord
  );
  const locationCoordinates = getAddressCoordinates(locationAddressRecord);
  const customerCoordinates = customerAddressCoordinates || locationCoordinates;
  const locationAddress = getUserFacingDisplayValue(locationAddressRecord);
  const navigationLocation =
    getCoordinateQuery(customerAddressCoordinates) ||
    getCoordinateQuery(locationCoordinates) ||
    locationAddress ||
    locationDisplayName ||
    customerAddress;
  const primaryContactName = getUserFacingDisplayValue(
    getValue(task, [
      "Task-customerID:Customer-primaryContact:Person-name-knownAs",
      "Task-customerID:Customer-primaryContact:Person-name-fullName",
    ]) ||
      primaryContact.name?.knownAs ||
      primaryContact.name?.fullName ||
      primaryContact.knownAs ||
      primaryContact.fullName
  );
  const primaryContactJobTitle = getUserFacingDisplayValue(
    getValue(task, [
      "Task-customerID:Customer-primaryContact:Person-jobTitle",
    ]) || primaryContact.jobTitle
  );
  const primaryContactEmail = getUserFacingDisplayValue(
    getValue(task, [
      "Task-customerID:Customer-primaryContact:Person-preferredEmail",
    ]) ||
      primaryContact.preferredEmail ||
      getPreferredComm(primaryContact, ["email"])
  );
  const primaryContactPhone = getUserFacingDisplayValue(
    getValue(task, [
      "Task-customerID:Customer-primaryContact:Person-mobilePhone",
      "Task-customerID:Customer-address-officePhone",
    ]) ||
      primaryContact.mobilePhone ||
      customerRecord.address?.officePhone ||
      getPreferredComm(primaryContact, ["mobile", "phone", "work"])
  );

  return {
    name: customerName,
    address: customerAddress,
    coordinates: customerCoordinates,
    locationId: customerLocationId,
    navigationLocation,
    primaryContactName,
    primaryContactJobTitle,
    primaryContactEmail,
    primaryContactPhone,
  };
};

const getAssignmentExecutionState = async (task = {}) => {
  const assignmentId = getAssignmentStorageId(task);

  if (!assignmentId) {
    return DEFAULT_EXECUTION_STATE;
  }

  const backendRecord = await fetchFieldServiceExecutionRecord(task);

  if (backendRecord) {
    const backendExecution = mapBackendExecutionRecord(backendRecord);
    const localExecution = await getLocalExecutionState(task);
    const checklist =
      backendExecution.checklist?.length > 0
        ? backendExecution.checklist
        : localExecution.checklist?.length > 0
          ? localExecution.checklist
        : await fetchFieldEngineerChecklistItems(task);
    const nextState = await hydrateExecutionAssets({
      currentStatus:
        backendExecution.currentStatus || localExecution.currentStatus || "",
      statusHistory:
        backendExecution.statusHistory?.length > 0
          ? backendExecution.statusHistory
          : localExecution.statusHistory || [],
      photos:
        backendExecution.photos?.length > 0
          ? backendExecution.photos
          : localExecution.photos || [],
      checklist,
      reviewAcknowledgement:
        backendExecution.reviewAcknowledgement ||
        localExecution.reviewAcknowledgement ||
        null,
      signOff: backendExecution.signOff || localExecution.signOff || null,
      signOffHistory:
        backendExecution.signOffHistory?.length > 0
          ? backendExecution.signOffHistory
          : localExecution.signOffHistory || [],
    });

    await saveLocalExecutionState(task, nextState);
    return nextState;
  }

  return getLocalExecutionState(task);
};

const saveAssignmentExecutionState = async (task = {}, executionState = {}) => {
  const assignmentId = getAssignmentStorageId(task);

  if (!assignmentId) {
    throw new Error("Assignment id is required to save execution state.");
  }

  const nextState = {
    currentStatus: executionState.currentStatus || "",
    statusHistory: executionState.statusHistory || [],
    photos: executionState.photos || [],
    checklist: executionState.checklist || [],
    reviewAcknowledgement: executionState.reviewAcknowledgement || null,
    signOff: executionState.signOff || null,
    signOffHistory: executionState.signOffHistory || [],
  };

  await saveLocalExecutionState(task, nextState);

  try {
    await saveFieldServiceExecutionRecord({
      task,
      executionState: nextState,
    });
  } catch (error) {
    console.error("Error saving field service execution to backend:", error);
  }

  return nextState;
};

const applyWorkflowState = (task, workflowState) => {
  if (!workflowState) {
    return task;
  }

  const statusHistory = workflowState.history || [];
  const workStartedEntry = statusHistory.find(
    (entry) => entry.newStatus === WORKFLOW_STATUS.WORK_STARTED
  );
  const completedEntry = statusHistory.find(
    (entry) => entry.newStatus === WORKFLOW_STATUS.COMPLETED
  );

  return {
    ...task,
    status: workflowState.status || task.status,
    statusHistory,
    actualStart: task.actualStart || workStartedEntry?.timestamp || "",
    actualFinish: task.actualFinish || completedEntry?.timestamp || "",
    percentComplete: completedEntry
      ? 100
      : workStartedEntry && Number(task.percentComplete || 0) <= 0
        ? 1
        : task.percentComplete,
  };
};

const enrichTasksWithWorkflowState = async (tasks) => {
  const workflowStore = await readWorkflowStore();

  return tasks.map((task) =>
    applyWorkflowState(task, workflowStore[getAssignmentStorageId(task)])
  );
};

const normalizeWorkflowStatus = (status) => {
  if (status === "In Progress") {
    return WORKFLOW_STATUS.WORK_STARTED;
  }

  if (!status || status === "Unknown") {
    return WORKFLOW_STATUS.ASSIGNED;
  }

  return status;
};

const getValidStatusTransitions = (status) =>
  STATUS_TRANSITIONS[normalizeWorkflowStatus(status)] ||
  STATUS_TRANSITIONS[WORKFLOW_STATUS.ASSIGNED];

const saveAssignmentStatusTransition = async ({
  task,
  newStatus,
  timestamp,
  location,
  reason,
  recordedByName,
}) => {
  const assignmentId = getAssignmentStorageId(task);

  if (!assignmentId) {
    throw new Error("Assignment id is required to save status transition.");
  }

  const workflowStore = await readWorkflowStore();
  const backendRecord = await fetchFieldServiceExecutionRecord(task);
  const backendExecution = backendRecord
    ? mapBackendExecutionRecord(backendRecord)
    : null;
  const localWorkflowState = workflowStore[assignmentId];
  const existingState = backendExecution?.currentStatus
    ? {
        status: backendExecution.currentStatus,
        history:
          backendExecution.statusHistory?.length > 0
            ? backendExecution.statusHistory
            : localWorkflowState?.history || [],
      }
    : localWorkflowState || {
        status: task.status || WORKFLOW_STATUS.ASSIGNED,
        history: [],
      };
  const previousStatus = normalizeWorkflowStatus(
    existingState.status || task.status || ""
  );
  const historyEntry = {
    previousStatus,
    newStatus,
    timestamp,
    location,
    recordedBy: APP.LOGIN_USER_PERSON_ID || APP.LOGIN_USER_ID || "",
    recordedByName: recordedByName || "",
    reason: reason || "",
  };
  const nextState = {
    status: newStatus,
    history: [...(existingState.history || []), historyEntry],
  };

  try {
    const executionState = await getAssignmentExecutionState(task);
    const nextExecutionState = {
      ...executionState,
      currentStatus: nextState.status,
      statusHistory: nextState.history,
    };
    const validationSnapshotJson =
      newStatus === WORKFLOW_STATUS.COMPLETED
        ? buildCompletionValidationSnapshot({
            task,
            executionState: nextExecutionState,
            workflowState: nextState,
            timestamp,
          })
        : "";

    await saveFieldServiceExecutionRecord({
      task,
      executionState: nextExecutionState,
      workflowState: nextState,
      existingRecord: backendRecord,
      validationSnapshotJson,
    });

    await saveTaskExecutionFields({
      task,
      newStatus,
      timestamp,
    });
  } catch (error) {
    console.error("Error saving field service status to backend:", error);

    if (newStatus === WORKFLOW_STATUS.COMPLETED) {
      throw error;
    }
  }

  workflowStore[assignmentId] = nextState;
  await writeWorkflowStore(workflowStore);

  return applyWorkflowState(task, nextState);
};

const normalizePriority = (priority) => {
  const rawPriority = getUserFacingDisplayValue(priority).trim();
  const numericPriority = Number(rawPriority);

  if (!Number.isNaN(numericPriority) && rawPriority !== "") {
    if (numericPriority <= 1) return "High";
    if (numericPriority === 2) return "Medium";
    return "Low";
  }

  return rawPriority;
};

const getTaskSummary = (task = {}) => {
  const customerInfo = getCustomerInfo(task);

  return {
    id: getValue(task, ["Task-id"]),
    extId: getUserFacingDisplayValue(getValue(task, ["Task-extID"])),
    title: getUserFacingDisplayValue(
      getValue(task, ["Task-text:text", "Task-text-text", "Task-text"]),
      "Untitled task"
    ),
    description: getUserFacingDisplayValue(
      getValue(task, [
        "Task-remark:text",
        "Task-description:text",
        "Task-description",
      ])
    ),
    customer: customerInfo.name,
    customerAddress: customerInfo.address,
    customerCoordinates: customerInfo.coordinates,
    customerLocationId: customerInfo.locationId,
    customerNavigationLocation: customerInfo.navigationLocation,
    customerPrimaryContactName: customerInfo.primaryContactName,
    customerPrimaryContactJobTitle: customerInfo.primaryContactJobTitle,
    customerPrimaryContactEmail: customerInfo.primaryContactEmail,
    customerPrimaryContactPhone: customerInfo.primaryContactPhone,
    projectId: getValue(task, ["Task-projectWbsID", "Task-projectID"]),
    project: getUserFacingDisplayValue(
      getValue(task, [
        "Task-projectWbsID:ProjectWBS-text-text",
        "Task-projectWbsID:ProjectWBS-extID",
      ])
    ),
    slaDeadline: getValue(task, [
      "Task-slaDeadline",
      "Task-SLADeadline",
      "Task-dates-plannedLateFinish",
      "Task-dates-plannedEarlyFinish",
    ]),
    createdOn: getValue(task, ["Task-createdOn"]),
    changedOn: getValue(task, ["Task-changedOn"]),
    priority: normalizePriority(
      getValue(task, ["Task-priority:Priority-text", "Task-priority"])
    ),
    percentComplete: getValue(task, ["Task-percentComplete"]),
    status: getTaskStatus(task),
    actualFinish: getValue(task, ["Task-dates-actualFinish"]),
    actualStart: getValue(task, ["Task-dates-actualStart"]),
    plannedStart: getValue(task, ["Task-dates-plannedStart"]),
    contactName: customerInfo.primaryContactName,
    contactPhone: customerInfo.primaryContactPhone,
    contactEmail: customerInfo.primaryContactEmail,
    customerReviewItems: normalizeReviewItems(task),
    raw: task,
  };
};

const matchesStatusFilter = (task, status = "All") => {
  switch (status) {
    case "Assigned":
      return task.status === "Assigned";
    case "In Progress":
      return ["In Progress", ...IN_PROGRESS_WORKFLOW_STATUSES].includes(
        task.status
      );
    case "Blocked":
      return task.status === WORKFLOW_STATUS.BLOCKED;
    case "Completed":
      return task.status === "Completed";
    case "All":
    default:
      return [
        ...ACTIVE_WORKFLOW_STATUSES,
        "In Progress",
        WORKFLOW_STATUS.COMPLETED,
      ].includes(task.status);
  }
};

const fetchFieldEngineerTasks = async ({
  page = 1,
  limit = PAGE_SIZE,
  status = "All",
  sortBy = "Target Completion Date",
  fieldSet = "detail",
  taskChangedSince = "",
} = {}) => {
  const loggedInPersonId = APP.LOGIN_USER_PERSON_ID;
  const loggedInPersonIds = [loggedInPersonId];
  const queryFields = {
    fields: fieldSet === "dashboard" ? TASK_DASHBOARD_FIELDS : TASK_FIELDS,
    or: [
      {
        fieldName: "Task-responsible",
        operator: "=",
        value: loggedInPersonId,
      },
      {
        fieldName: "Task-assigned",
        operator: "in",
        value: loggedInPersonIds,
      },
      {
        fieldName: "Task-extStatus-recipient",
        operator: "=",
        value: loggedInPersonId,
      },
      {
        fieldName: "Task-extStatus-recipientList",
        operator: "in",
        value: loggedInPersonIds,
      },
    ],
  };

  if (taskChangedSince) {
    queryFields.where = [
      {
        fieldName: "Task-changedOn",
        operator: ">=",
        value: taskChangedSince,
      },
    ];
  }

  const sortMap = {
    "Target Completion Date": [
      { property: "Task-dates-plannedLateFinish", direction: "ASC" },
      { property: "Task-dates-plannedEarlyFinish", direction: "ASC" },
    ],
    SLA: [
      { property: "Task-dates-plannedLateFinish", direction: "ASC" },
      { property: "Task-dates-plannedEarlyFinish", direction: "ASC" },
    ],
    Priority: [{ property: "Task-priority", direction: "ASC" }],
    "Recently Updated": [{ property: "Task-changedOn", direction: "DESC" }],
    "Created Date": [{ property: "Task-createdOn", direction: "DESC" }],
  };

  const formData = new URLSearchParams({
    userID: APP.LOGIN_USER_ID,
    client: parseInt(APP.LOGIN_USER_CLIENT),
    language: APP.LOGIN_USER_LANGUAGE,
    query: JSON.stringify(queryFields),
    testMode: TEST_MODE,
    intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
    page,
    limit,
    start: (page - 1) * limit,
    sort: JSON.stringify(sortMap[sortBy] || sortMap["Target Completion Date"]),
  });

  const response = await fetchData(
    API_ENDPOINTS.QUERY,
    "POST",
    {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    formData.toString()
  );

  const tasks = Array.isArray(response?.data)
    ? await enrichTasksWithWorkflowState(response.data.map(getTaskSummary))
    : [];

  const filteredTasks = tasks.filter((task) =>
    matchesStatusFilter(task, status)
  );

  return {
    data: filteredTasks,
    totalCount: filteredTasks.length,
  };
};

export {
  ACTIVE_WORKFLOW_STATUSES,
  DEFAULT_BLOCKED_REASONS,
  FIELD_ENGINEER_ROLES,
  DEFAULT_SIGN_OFF_SKIP_REASONS,
  WORKFLOW_STATUS,
  fetchFieldEngineerChecklistItems,
  fetchAttachmentResourceInfo,
  fetchFieldServiceChecklistTemplates,
  fetchFieldServiceListEntries,
  fetchFieldServicePolicies,
  fetchFieldServiceReviewItems,
  fetchFieldServiceReviewTemplates,
  fetchFieldEngineerTasks,
  getFieldServicePolicy,
  getAssignmentExecutionState,
  getValidStatusTransitions,
  getTaskSummary,
  hasFieldEngineerRole,
  hasFieldEngineerAdminRole,
  applyWorkflowState,
  deleteFieldServiceAttachment,
  deleteFieldServiceChecklistTemplate,
  deleteFieldServicePolicy,
  deleteFieldServiceReviewTemplate,
  saveAssignmentExecutionState,
  saveAssignmentStatusTransition,
  saveFieldServiceChecklistTemplate,
  saveFieldServicePolicy,
  saveFieldServiceReviewTemplate,
};
