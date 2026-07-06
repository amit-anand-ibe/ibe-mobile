import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Checkbox from "expo-checkbox";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { format, isValid } from "date-fns";
import { useTranslation } from "react-i18next";
import { WebView } from "react-native-webview";
import Svg, { Path } from "react-native-svg";

import { APP } from "../constants";
import CustomBackButton from "../components/CustomBackButton";
import PreviewDialog from "../components/dialogs/PreviewDialog";
import { fetchAndCacheResource, uploadBinaryResource } from "../utils/APIUtils";
import { convertToDateFNSFormat } from "../utils/FormatUtils";
import { screenDimension } from "../utils/ScreenUtils";
import { showToast } from "../utils/MessageUtils";
import { LoggedInUserInfoContext } from "../../context/LoggedInUserInfoContext";
import {
  DEFAULT_BLOCKED_REASONS,
  DEFAULT_SIGN_OFF_SKIP_REASONS,
  getAssignmentExecutionState,
  fetchFieldServiceReviewItems,
  fetchFieldServiceListEntries,
  fetchAttachmentResourceInfo,
  getFieldServicePolicy,
  getValidStatusTransitions,
  saveAssignmentExecutionState,
  saveAssignmentStatusTransition,
  applyWorkflowState,
  deleteFieldServiceAttachment,
  WORKFLOW_STATUS,
} from "../utils/FieldEngineerUtils";

const DEFAULT_FIELD_SERVICE_POLICY = {
  slaAtRiskHours: 4,
  requiredWorkPhotoCount: 1,
  checklistRequired: true,
  customerSignOffRequired: true,
  allowSignOffSkip: true,
  customerReviewRequired: true,
};

const DetailRow = ({ label, value, iconName, actionIconName, onPress }) => {
  if (!value) {
    return null;
  }

  return (
    <View style={styles.detailRow}>
      <View style={styles.detailContentRow}>
        {iconName && (
          <Ionicons
            name={iconName}
            size={16}
            color="#4b5563"
            style={styles.detailIcon}
          />
        )}
        <View style={styles.detailTextContainer}>
          <Text style={styles.detailLabel}>{label}</Text>
          <Text style={styles.detailValue}>{value}</Text>
        </View>
        {actionIconName && onPress && (
          <TouchableOpacity
            style={styles.detailActionButton}
            onPress={onPress}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Ionicons
              name={actionIconName}
              size={18}
              color="#005eb8"
              style={styles.detailActionIcon}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const GuidanceNote = ({ text, variant = "info" }) => {
  if (!text) {
    return null;
  }

  const isWarning = variant === "warning";

  return (
    <View
      style={[styles.guidanceNote, isWarning && styles.guidanceNoteWarning]}
    >
      <Ionicons
        name={isWarning ? "alert-circle-outline" : "information-circle-outline"}
        size={16}
        color={isWarning ? "#9f1239" : "#4b5563"}
      />
      <Text
        style={[
          styles.guidanceNoteText,
          isWarning && styles.guidanceNoteWarningText,
        ]}
      >
        {text}
      </Text>
    </View>
  );
};

const ActionButton = ({ icon, label, onPress, disabled = false }) => (
  <TouchableOpacity
    style={[
      styles.actionButton,
      !disabled && styles.tappableCard,
      disabled && styles.actionButtonDisabled,
    ]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.78}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    {icon}
    <Text style={[styles.actionButtonText, disabled && styles.disabledText]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const openUrl = async (url, errorMessage) => {
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.error("Error opening field engineer action URL:", error);
    showToast(errorMessage, "error");
  }
};

const getPhoneDialValue = (value = "") => {
  const trimmedValue = String(value).trim();

  if (!trimmedValue) {
    return "";
  }

  const dialValue = trimmedValue.replace(/[^\d+]/g, "");
  const digitCount = dialValue.replace(/\D/g, "").length;

  return digitCount >= 3 ? dialValue : "";
};

const getEmailAddress = (value = "") => {
  const emailAddress = String(value).trim();

  if (!emailAddress) {
    return "";
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress) ? emailAddress : "";
};

const getDeadlineDate = (task) => {
  const parsedDate = new Date(task.slaDeadline);
  return isValid(parsedDate) ? parsedDate : null;
};

const formatDateTime = (value) => {
  const parsedDate = new Date(value);
  if (!value || !isValid(parsedDate)) {
    return "";
  }

  return format(
    parsedDate,
    `${convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)} HH:mm`
  );
};

const isCompleted = (task) =>
  String(task.status || "")
    .toLowerCase()
    .includes("complete");

const getSlaState = (task, atRiskHours = 4) => {
  const deadline = getDeadlineDate(task);
  if (!deadline) {
    return "";
  }

  if (isCompleted(task)) {
    return "onTrack";
  }

  const now = new Date();
  const atRiskWindow = new Date(
    now.getTime() + Number(atRiskHours || 4) * 60 * 60 * 1000
  );

  if (deadline < now) {
    return "breached";
  }

  if (deadline <= atRiskWindow) {
    return "atRisk";
  }

  return "onTrack";
};

const getStatusStyle = (status) => {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus.includes("complete")) {
    return styles.statusCompleted;
  }

  if (normalizedStatus.includes("blocked")) {
    return styles.statusBlocked;
  }

  if (normalizedStatus.includes("progress")) {
    return styles.statusProgress;
  }

  if (
    normalizedStatus.includes("route") ||
    normalizedStatus.includes("arrived") ||
    normalizedStatus.includes("started")
  ) {
    return styles.statusProgress;
  }

  return styles.statusAssigned;
};

const formatDuration = (milliseconds, t) => {
  const absoluteMilliseconds = Math.abs(milliseconds);
  const totalMinutes = Math.max(1, Math.ceil(absoluteMilliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) {
    parts.push(t("field_engineer_duration_days", { count: days }));
  }

  if (hours) {
    parts.push(t("field_engineer_duration_hours", { count: hours }));
  }

  if (!days && minutes) {
    parts.push(t("field_engineer_duration_minutes", { count: minutes }));
  }

  return parts.join(" ");
};

const getSlaTimeText = (deadline, t) => {
  if (!deadline) {
    return "";
  }

  const difference = deadline.getTime() - new Date().getTime();
  const duration = formatDuration(difference, t);

  return difference < 0
    ? t("field_engineer_time_breached", { duration })
    : t("field_engineer_time_remaining", { duration });
};

const getTimelineStepState = (task, stepIndex) => {
  const normalizedStatus = String(task.status || "").toLowerCase();
  const statusIndexMap = {
    assigned: 0,
    "en route": 1,
    "arrived onsite": 2,
    "work started": 3,
    "in progress": 3,
    blocked: 3,
    completed: 4,
  };
  const currentIndex = statusIndexMap[normalizedStatus] ?? 0;

  if (normalizedStatus.includes("complete")) {
    return "completed";
  }

  if (stepIndex < currentIndex) {
    return "completed";
  }

  return stepIndex === currentIndex ? "current" : "pending";
};

const isActiveAssignmentStatus = (status) =>
  [
    WORKFLOW_STATUS.ASSIGNED,
    WORKFLOW_STATUS.EN_ROUTE,
    WORKFLOW_STATUS.ARRIVED_ONSITE,
    WORKFLOW_STATUS.WORK_STARTED,
    WORKFLOW_STATUS.BLOCKED,
    "In Progress",
  ].includes(status);

const sanitizeFileNamePart = (value) =>
  String(value || "assignment")
    .replace(/[^a-z0-9-]/gi, "")
    .slice(0, 32) || "assignment";

const getSignaturePathData = (points = []) =>
  points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

const buildSignatureSvg = (paths = []) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">${paths
    .map(
      (points) =>
        `<path d="${getSignaturePathData(points)}" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join("")}</svg>`;

const hasSignatureInk = (paths = []) =>
  paths.some((path) => Array.isArray(path) && path.length > 1);

const formatCoordinate = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toFixed(6) : "";
};

const getLocationHistoryText = (location = {}) => {
  if (!location) {
    return "";
  }

  const readableLocation =
    location.label ||
    location.name ||
    location.address ||
    location.displayName ||
    location.text;

  if (readableLocation) {
    return readableLocation;
  }

  const latitude = formatCoordinate(location.latitude);
  const longitude = formatCoordinate(location.longitude);

  return latitude && longitude ? `${latitude}, ${longitude}` : "";
};

const getPersonDisplayName = (person = {}) => {
  if (typeof person.name === "string") {
    return person.knownAs || person.name || person.fullName || "";
  }

  return (
    person.knownAs ||
    person.fullName ||
    person.name?.knownAs ||
    person.name?.fullName ||
    [person.name?.firstName, person.name?.lastName].filter(Boolean).join(" ")
  );
};

const FieldEngineerTaskDetail = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { loggedInUserInfo = {} } = useContext(LoggedInUserInfoContext);
  const [task, setTask] = useState(route?.params?.task || {});
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [statusValidationMessage, setStatusValidationMessage] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [executionState, setExecutionState] = useState({
    photos: [],
    checklist: [],
    reviewAcknowledgement: null,
    signOff: null,
    signOffHistory: [],
  });
  const [fieldServicePolicy, setFieldServicePolicy] = useState(
    DEFAULT_FIELD_SERVICE_POLICY
  );
  const [skipReasonOptions, setSkipReasonOptions] = useState(
    DEFAULT_SIGN_OFF_SKIP_REASONS
  );
  const [blockedReasonOptions, setBlockedReasonOptions] = useState(
    DEFAULT_BLOCKED_REASONS
  );
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [signOffVisible, setSignOffVisible] = useState(false);
  const [signOffMode, setSignOffMode] = useState("signature");
  const [reviewModalItem, setReviewModalItem] = useState(null);
  const [reviewDocumentMessage, setReviewDocumentMessage] = useState("");
  const [isReviewPreviewVisible, setIsReviewPreviewVisible] = useState(false);
  const [reviewPreviewUri, setReviewPreviewUri] = useState(null);
  const [reviewPreviewType, setReviewPreviewType] = useState(null);
  const [reviewPreviewTitle, setReviewPreviewTitle] = useState("");
  const [reviewPreviewName, setReviewPreviewName] = useState("");
  const [reviewPreviewMimeType, setReviewPreviewMimeType] = useState("");
  const [viewedReviewItemIds, setViewedReviewItemIds] = useState([]);
  const [customerSignOffName, setCustomerSignOffName] = useState("");
  const [signaturePaths, setSignaturePaths] = useState([]);
  const [skipReason, setSkipReason] = useState("");
  const [signOffValidationMessage, setSignOffValidationMessage] = useState("");
  const signaturePathsRef = useRef([]);
  const deadline = getDeadlineDate(task);
  const targetCompletion = formatDateTime(task.slaDeadline);
  const actualStart = formatDateTime(task.actualStart);
  const actualFinish = formatDateTime(task.actualFinish);
  const slaState = getSlaState(task, fieldServicePolicy.slaAtRiskHours);
  const slaTimeText = getSlaTimeText(deadline, t);
  const timelineSteps = [
    t("field_engineer_timeline_assigned"),
    t("field_engineer_timeline_en_route"),
    t("field_engineer_timeline_arrived_onsite"),
    t("field_engineer_timeline_work_started"),
    t("field_engineer_timeline_completed"),
  ];
  const validTransitions = useMemo(
    () => getValidStatusTransitions(task.status || WORKFLOW_STATUS.ASSIGNED),
    [task.status]
  );
  const slaLabel =
    slaState === "breached"
      ? t("field_engineer_sla_breached")
      : slaState === "atRisk"
        ? t("field_engineer_sla_at_risk")
        : t("field_engineer_sla_on_track");
  const checklistCompletedCount = executionState.checklist.filter(
    (item) => item.completed
  ).length;
  const checklistTotalCount = executionState.checklist.length;
  const requiredChecklistItems = executionState.checklist.filter(
    (item) => item.required
  );
  const incompleteRequiredCount = requiredChecklistItems.filter(
    (item) => !item.completed
  ).length;
  const checklistRequired = !!fieldServicePolicy.checklistRequired;
  const hasChecklistItems = checklistTotalCount > 0;
  const checklistConfigurationMissing = checklistRequired && !hasChecklistItems;
  const showChecklistSection = hasChecklistItems || checklistRequired;
  const requiredWorkPhotoCount = Math.max(
    Number(fieldServicePolicy.requiredWorkPhotoCount || 0),
    0
  );
  const workPhotosRequired = requiredWorkPhotoCount > 0;
  const isChecklistComplete =
    !checklistRequired || (hasChecklistItems && incompleteRequiredCount === 0);
  const hasRequiredWorkPhotos =
    executionState.photos.length >= requiredWorkPhotoCount;
  const completionPrerequisitesMet =
    hasRequiredWorkPhotos && isChecklistComplete;
  const canCaptureWorkPhoto = isChecklistComplete;
  const signOffRequired = !!fieldServicePolicy.customerSignOffRequired;
  const showSignOffSection = signOffRequired || !!executionState.signOff;
  const signOff = executionState.signOff;
  const isExecutionEvidenceLocked =
    !!signOff ||
    task.status === WORKFLOW_STATUS.COMPLETED ||
    executionState.currentStatus === WORKFLOW_STATUS.COMPLETED;
  const reviewItems = task.customerReviewItems || [];
  const reviewRequired = !!fieldServicePolicy.customerReviewRequired;
  const reviewConfigurationMissing = reviewRequired && reviewItems.length === 0;
  const hasRequiredReviewItems = reviewRequired && reviewItems.length > 0;
  const requiredReviewItems = reviewItems.filter((item) => item.required);
  const unviewedRequiredReviewItems = requiredReviewItems.filter(
    (item) => !viewedReviewItemIds.includes(item.id)
  );
  const reviewAcknowledgement = executionState.reviewAcknowledgement;
  const reviewPrerequisitesMet =
    !reviewRequired ||
    (!reviewConfigurationMissing &&
      (!hasRequiredReviewItems || !!reviewAcknowledgement));
  const canCollectSignOff =
    showSignOffSection &&
    completionPrerequisitesMet &&
    reviewPrerequisitesMet &&
    (task.status === WORKFLOW_STATUS.WORK_STARTED ||
      task.status === "In Progress" ||
      validTransitions.includes(WORKFLOW_STATUS.COMPLETED));
  const signOffActionLabel = signOff
    ? t("field_engineer_update_signoff")
    : t("field_engineer_collect_signoff");
  const signOffPrerequisiteMessages = [
    checklistConfigurationMissing
      ? t("field_engineer_checklist_required_missing")
      : checklistRequired && incompleteRequiredCount > 0
        ? t("field_engineer_completion_checklist_required", {
            count: incompleteRequiredCount,
          })
        : "",
    workPhotosRequired && !hasRequiredWorkPhotos
      ? t("field_engineer_completion_photo_required")
      : "",
    reviewConfigurationMissing
      ? t("field_engineer_review_configuration_missing")
      : hasRequiredReviewItems && !reviewAcknowledgement
        ? t("field_engineer_completion_review_required")
        : "",
  ].filter(Boolean);

  const headerLeft = useCallback(
    () => (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton navigation={navigation} t={t} />
        <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
          {task.extId || t("field_engineer_task_detail")}
        </Text>
      </View>
    ),
    [navigation, t, task.extId]
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft,
    });
  }, [headerLeft, navigation]);

  const signaturePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const point = {
            x: Math.round(event.nativeEvent.locationX),
            y: Math.round(event.nativeEvent.locationY),
          };

          signaturePathsRef.current = [...signaturePathsRef.current, [point]];
          setSignaturePaths(signaturePathsRef.current);
          setSignOffValidationMessage("");
        },
        onPanResponderMove: (event) => {
          const paths = signaturePathsRef.current;
          const currentPath = paths[paths.length - 1];

          if (!currentPath) {
            return;
          }

          const point = {
            x: Math.round(event.nativeEvent.locationX),
            y: Math.round(event.nativeEvent.locationY),
          };
          const previousPoint = currentPath[currentPath.length - 1];
          const movement =
            Math.abs(point.x - previousPoint.x) +
            Math.abs(point.y - previousPoint.y);

          if (movement < 2) {
            return;
          }

          const nextPaths = [...paths.slice(0, -1), [...currentPath, point]];

          signaturePathsRef.current = nextPaths;
          setSignaturePaths(nextPaths);
        },
      }),
    []
  );

  useEffect(() => {
    let isMounted = true;

    const loadExecutionState = async () => {
      try {
        const [state, policy] = await Promise.all([
          getAssignmentExecutionState(task),
          getFieldServicePolicy(task),
        ]);
        const [
          reviewItemsForTask,
          configuredSkipReasons,
          configuredBlockedReasons,
        ] = await Promise.all([
          fetchFieldServiceReviewItems(task),
          fetchFieldServiceListEntries(policy.skipReasonListID),
          fetchFieldServiceListEntries(policy.blockedReasonListID),
        ]);

        if (isMounted) {
          setExecutionState(state);
          setFieldServicePolicy(policy);
          setSkipReasonOptions(
            configuredSkipReasons.length
              ? configuredSkipReasons
              : DEFAULT_SIGN_OFF_SKIP_REASONS
          );
          setBlockedReasonOptions(
            configuredBlockedReasons.length
              ? configuredBlockedReasons
              : DEFAULT_BLOCKED_REASONS
          );
          setTask((currentTask) => {
            const taskWithExecutionStatus =
              state.currentStatus || state.statusHistory?.length
                ? applyWorkflowState(currentTask, {
                    status: state.currentStatus,
                    history: state.statusHistory || [],
                  })
                : currentTask;

            return reviewItemsForTask.length > 0
              ? {
                  ...taskWithExecutionStatus,
                  customerReviewItems: reviewItemsForTask,
                }
              : taskWithExecutionStatus;
          });
        }
      } catch (error) {
        console.error("Error loading assignment execution state:", error);
      }
    };

    loadExecutionState();

    return () => {
      isMounted = false;
    };
  }, [task.id, task.extId]);

  const captureCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        showToast(t("field_engineer_location_capture_unavailable"), "warning");
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
    } catch (error) {
      console.error("Error capturing assignment status location:", error);
      showToast(t("field_engineer_location_capture_unavailable"), "warning");
      return null;
    }
  };

  const capturePhotoLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        return null;
      }

      const lastKnownLocation = await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000,
        requiredAccuracy: 200,
      });

      if (lastKnownLocation?.coords) {
        return {
          latitude: lastKnownLocation.coords.latitude,
          longitude: lastKnownLocation.coords.longitude,
        };
      }

      const currentLocation = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);

      return currentLocation?.coords
        ? {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          }
        : null;
    } catch (error) {
      console.error("Error capturing assignment photo location:", error);
      return null;
    }
  };

  const persistExecutionState = async (nextState) => {
    const savedState = await saveAssignmentExecutionState(task, nextState);
    setExecutionState(savedState);
    return savedState;
  };

  const validateCompletion = () => {
    const messages = [];

    if (!isActiveAssignmentStatus(task.status)) {
      messages.push(t("field_engineer_completion_active_status_required"));
    }

    if (executionState.photos.length < requiredWorkPhotoCount) {
      messages.push(t("field_engineer_completion_photo_required"));
    }

    if (checklistConfigurationMissing) {
      messages.push(t("field_engineer_checklist_required_missing"));
    } else if (checklistRequired && incompleteRequiredCount > 0) {
      messages.push(
        t("field_engineer_completion_checklist_required", {
          count: incompleteRequiredCount,
        })
      );
    }

    if (reviewConfigurationMissing) {
      messages.push(t("field_engineer_review_configuration_missing"));
    } else if (
      hasRequiredReviewItems &&
      !executionState.reviewAcknowledgement
    ) {
      messages.push(t("field_engineer_completion_review_required"));
    }

    if (signOffRequired && !executionState.signOff) {
      messages.push(t("field_engineer_completion_signoff_required"));
    }

    return messages;
  };

  const resetSignOffForm = () => {
    setCustomerSignOffName("");
    setSkipReason("");
    setSignOffMode("signature");
    setSignOffValidationMessage("");
    signaturePathsRef.current = [];
    setSignaturePaths([]);
  };

  const openSignOff = () => {
    resetSignOffForm();
    if (executionState.signOff?.type === "skipped") {
      setSignOffMode("skip");
      setSkipReason(executionState.signOff.reason || "");
    } else {
      setSignOffMode("signature");
      setCustomerSignOffName(executionState.signOff?.customerName || "");
      signaturePathsRef.current = executionState.signOff?.signaturePaths || [];
      setSignaturePaths(executionState.signOff?.signaturePaths || []);
    }
    if (!fieldServicePolicy.allowSignOffSkip) {
      setSignOffMode("signature");
    }
    setSignOffVisible(true);
  };

  const closeSignOff = () => {
    setSignOffVisible(false);
    resetSignOffForm();
  };

  const clearSignature = () => {
    signaturePathsRef.current = [];
    setSignaturePaths([]);
  };

  const openReviewItem = (item) => {
    setReviewDocumentMessage("");

    if (!item?.id) {
      setReviewModalItem(item);
      return;
    }

    setViewedReviewItemIds((currentIds) =>
      currentIds.includes(item.id) ? currentIds : [...currentIds, item.id]
    );

    if (!item.content && (item.url || item.resourceId)) {
      openReviewDocument(item);
      return;
    }

    setReviewModalItem(item);
  };

  const getCollectorId = () =>
    APP.LOGIN_USER_PERSON_ID || APP.LOGIN_USER_ID || APP.LOGIN_USER || "";

  const getCollectorName = () => getPersonDisplayName(loggedInUserInfo);

  const uploadSignatureResource = async (paths, timestamp) => {
    const assignmentId = sanitizeFileNamePart(task.id || task.extId);
    const fileName = `field-service-signature-${assignmentId}-${Date.now()}.svg`;
    const signatureUri = `${FileSystem.documentDirectory}${fileName}`;
    const signatureSvg = buildSignatureSvg(paths);

    await FileSystem.writeAsStringAsync(signatureUri, signatureSvg);

    const uploadedSignature = await uploadBinaryResource(
      signatureUri,
      false,
      {
        type: "image/svg+xml",
        name: fileName,
        ocrCheck: "image/svg+xml",
      },
      {
        client: APP.LOGIN_USER_CLIENT,
        user: APP.LOGIN_USER_ID,
      }
    );

    if (!uploadedSignature?.attachmentId) {
      throw new Error(
        "Customer signature upload did not return an attachment id"
      );
    }

    const signatureAttachmentInfo = await fetchAttachmentResourceInfo(
      uploadedSignature.attachmentId
    );

    return {
      signatureImage: signatureSvg,
      signatureUri,
      signatureFileName: fileName,
      signatureResourceID:
        signatureAttachmentInfo.original ||
        uploadedSignature.resourceId ||
        uploadedSignature.attachmentId,
      signatureAttachmentID: uploadedSignature.attachmentId,
      signatureThumbnailID:
        signatureAttachmentInfo.thumbnail ||
        uploadedSignature.thumbId ||
        uploadedSignature.thumbID ||
        "",
      signatureTimestamp: timestamp,
    };
  };

  const getHistoryCollectorName = (entry = {}) => {
    if (entry.engineerUserName) {
      return entry.engineerUserName;
    }

    const collectorId = getCollectorId();
    if (collectorId && entry.engineerUserId === collectorId) {
      return getCollectorName();
    }

    return "";
  };

  const getStatusHistoryRecordedByName = (entry = {}) => {
    if (entry.recordedByName || entry.userName || entry.recordedByDisplayName) {
      return (
        entry.recordedByName || entry.userName || entry.recordedByDisplayName
      );
    }

    const collectorId = getCollectorId();
    if (collectorId && entry.recordedBy === collectorId) {
      return getCollectorName();
    }

    return "";
  };

  const createReviewAcknowledgement = () => {
    if (executionState.reviewAcknowledgement) {
      return executionState.reviewAcknowledgement;
    }

    const timestamp = new Date().toISOString();
    return {
      acknowledged: true,
      text: t("field_engineer_customer_acknowledgement_text"),
      timestamp,
      assignmentId: task.id || task.extId || "",
      engineerUserId: getCollectorId(),
      engineerUserName: getCollectorName(),
      requiredReviewItemIds: reviewItems
        .filter((item) => item.required)
        .map((item) => item.id),
    };
  };

  const recordReviewAcknowledgement = () => {
    if (executionState.reviewAcknowledgement) {
      return;
    }

    if (reviewConfigurationMissing) {
      showToast(t("field_engineer_review_configuration_missing"), "warning");
      return;
    }

    if (unviewedRequiredReviewItems.length > 0) {
      showToast(
        t("field_engineer_review_view_required_items", {
          count: unviewedRequiredReviewItems.length,
        }),
        "warning"
      );
      return;
    }

    Alert.alert(
      t("field_engineer_confirm_review_ack_title"),
      t("field_engineer_confirm_review_ack_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          onPress: async () => {
            try {
              const acknowledgement = createReviewAcknowledgement();

              await persistExecutionState({
                ...executionState,
                reviewAcknowledgement: acknowledgement,
              });
              showToast(t("field_engineer_review_acknowledgement_saved"));
            } catch (error) {
              console.error(
                "Error saving customer review acknowledgement:",
                error
              );
              showToast(
                t("field_engineer_review_acknowledgement_save_failed"),
                "error"
              );
            }
          },
        },
      ]
    );
  };

  const validateReviewAcknowledgementForSignOff = () => {
    if (reviewConfigurationMissing) {
      setSignOffValidationMessage(
        t("field_engineer_review_configuration_missing")
      );
      return false;
    }

    if (hasRequiredReviewItems && !executionState.reviewAcknowledgement) {
      setSignOffValidationMessage(
        t("field_engineer_review_acknowledgement_required")
      );
      return false;
    }

    return true;
  };

  const saveSignatureSignOff = async () => {
    const customerName = customerSignOffName.trim();

    if (!validateReviewAcknowledgementForSignOff()) {
      return;
    }

    if (!customerName) {
      setSignOffValidationMessage(t("field_engineer_customer_name_required"));
      return;
    }

    if (!hasSignatureInk(signaturePaths)) {
      setSignOffValidationMessage(t("field_engineer_signature_required"));
      return;
    }

    Alert.alert(
      t("field_engineer_confirm_signoff_title"),
      t("field_engineer_confirm_signoff_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          onPress: async () => {
            try {
              const timestamp = new Date().toISOString();
              const uploadedSignature = await uploadSignatureResource(
                signaturePaths,
                timestamp
              );
              const signOffData = {
                type: "signed",
                customerName,
                ...uploadedSignature,
                signaturePaths,
                timestamp,
                assignmentId: task.id || task.extId || "",
                engineerUserId: getCollectorId(),
                engineerUserName: getCollectorName(),
              };

              await persistExecutionState({
                ...executionState,
                signOff: signOffData,
                signOffHistory: [
                  ...(executionState.signOffHistory || []),
                  {
                    eventKey: "field_engineer_signature_collected",
                    timestamp,
                    engineerUserId: signOffData.engineerUserId,
                    engineerUserName: signOffData.engineerUserName,
                    customerName,
                  },
                ],
              });
              closeSignOff();
              showToast(t("field_engineer_signoff_saved"));
            } catch (error) {
              console.error("Error saving customer sign-off:", error);
              showToast(t("field_engineer_signoff_save_failed"), "error");
            }
          },
        },
      ]
    );
  };

  const saveSkippedSignOff = async () => {
    const reason = skipReason.trim();

    if (!validateReviewAcknowledgementForSignOff()) {
      return;
    }

    if (!reason) {
      setSignOffValidationMessage(t("field_engineer_skip_reason_required"));
      return;
    }

    Alert.alert(
      t("field_engineer_confirm_skip_signoff_title"),
      t("field_engineer_confirm_skip_signoff_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          onPress: async () => {
            try {
              const timestamp = new Date().toISOString();
              const signOffData = {
                type: "skipped",
                reason,
                timestamp,
                assignmentId: task.id || task.extId || "",
                engineerUserId: getCollectorId(),
                engineerUserName: getCollectorName(),
              };

              await persistExecutionState({
                ...executionState,
                signOff: signOffData,
                signOffHistory: [
                  ...(executionState.signOffHistory || []),
                  {
                    eventKey: "field_engineer_signature_skipped",
                    timestamp,
                    engineerUserId: signOffData.engineerUserId,
                    engineerUserName: signOffData.engineerUserName,
                    reason,
                  },
                ],
              });
              closeSignOff();
              showToast(t("field_engineer_signoff_saved"));
            } catch (error) {
              console.error("Error saving skipped customer sign-off:", error);
              showToast(t("field_engineer_signoff_save_failed"), "error");
            }
          },
        },
      ]
    );
  };

  const captureWorkPhoto = async () => {
    if (isExecutionEvidenceLocked) {
      showToast(t("field_engineer_execution_evidence_locked"), "warning");
      return;
    }

    if (!canCaptureWorkPhoto) {
      showToast(t("field_engineer_photo_checklist_required"), "warning");
      return;
    }

    setIsCapturingPhoto(true);

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        showToast(t("field_engineer_camera_permission_required"), "warning");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.75,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setPendingPhoto(result.assets[0]);
    } catch (error) {
      console.error("Error capturing assignment work photo:", error);
      showToast(t("field_engineer_photo_capture_failed"), "error");
    } finally {
      setIsCapturingPhoto(false);
    }
  };

  const savePendingPhoto = async () => {
    if (!pendingPhoto?.uri || isSavingPhoto) {
      return;
    }

    setIsSavingPhoto(true);

    try {
      const photoToSave = pendingPhoto;
      const timestamp = new Date().toISOString();
      const assignmentId = sanitizeFileNamePart(task.id || task.extId);
      const fileName = `field-service-${assignmentId}-${Date.now()}.jpg`;
      const targetUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({
        from: photoToSave.uri,
        to: targetUri,
      });

      const location = await capturePhotoLocation();
      const uploadedPhoto = await uploadBinaryResource(
        targetUri,
        false,
        {
          type: "image/jpeg",
          name: fileName,
          tHeight: 175,
          tWidth: 250,
          ocrCheck: "image/jpeg",
        },
        {
          client: APP.LOGIN_USER_CLIENT,
          user: APP.LOGIN_USER_ID,
        }
      );

      if (!uploadedPhoto?.attachmentId) {
        throw new Error("Work photo upload did not return an attachment id");
      }

      const photoAttachmentInfo = await fetchAttachmentResourceInfo(
        uploadedPhoto.attachmentId
      );

      await persistExecutionState({
        ...executionState,
        photos: [
          ...executionState.photos,
          {
            id: `${Date.now()}`,
            uri: targetUri,
            resourceID:
              photoAttachmentInfo.original ||
              uploadedPhoto.resourceId ||
              uploadedPhoto.attachmentId,
            attachmentID: uploadedPhoto.attachmentId,
            thumbnailID:
              photoAttachmentInfo.thumbnail ||
              uploadedPhoto.thumbId ||
              uploadedPhoto.thumbID ||
              "",
            fileName,
            timestamp,
            location,
            assignmentId: task.id || task.extId || "",
            uploadedBy: getCollectorId(),
          },
        ],
      });
      setPendingPhoto(null);
      showToast(t("field_engineer_photo_saved"));
    } catch (error) {
      console.error("Error saving assignment work photo:", error);
      showToast(t("field_engineer_photo_save_failed"), "error");
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const deleteWorkPhoto = async (photo) => {
    if (isExecutionEvidenceLocked) {
      showToast(t("field_engineer_execution_evidence_locked"), "warning");
      return;
    }

    try {
      const attachmentId = photo.attachmentID || photo.attachmentId || "";

      if (attachmentId) {
        await deleteFieldServiceAttachment(attachmentId);
      }

      if (photo.uri) {
        await FileSystem.deleteAsync(photo.uri, { idempotent: true });
      }

      await persistExecutionState({
        ...executionState,
        photos: executionState.photos.filter((item) => item.id !== photo.id),
      });
      showToast(t("field_engineer_photo_deleted"));
    } catch (error) {
      console.error("Error deleting assignment work photo:", error);
      showToast(t("field_engineer_photo_delete_failed"), "error");
    }
  };

  const confirmDeletePhoto = (photo) => {
    Alert.alert(
      t("confirm_deletion_title"),
      t("field_engineer_delete_photo_confirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () => deleteWorkPhoto(photo),
        },
      ]
    );
  };

  const toggleChecklistItem = async (itemId) => {
    if (isExecutionEvidenceLocked) {
      showToast(t("field_engineer_execution_evidence_locked"), "warning");
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const completedBy = getCollectorId();

      await persistExecutionState({
        ...executionState,
        checklist: executionState.checklist.map((item) =>
          item.id === itemId
            ? {
                ...item,
                completed: !item.completed,
                completedOn: item.completed ? "" : timestamp,
                completedBy: item.completed ? "" : completedBy,
              }
            : item
        ),
      });
    } catch (error) {
      console.error("Error updating assignment checklist:", error);
      showToast(t("field_engineer_checklist_update_failed"), "error");
    }
  };

  const updateAssignmentStatus = async (newStatus, reason = "") => {
    setIsUpdatingStatus(true);

    try {
      const timestamp = new Date().toISOString();
      const location = await captureCurrentLocation();
      const updatedTask = await saveAssignmentStatusTransition({
        task,
        newStatus,
        timestamp,
        location,
        reason,
        recordedByName: getCollectorName(),
      });

      setTask(updatedTask);
      setExecutionState((currentState) => ({
        ...currentState,
        currentStatus: updatedTask.status || newStatus,
        statusHistory:
          updatedTask.statusHistory || currentState.statusHistory || [],
      }));
      setStatusSheetVisible(false);
      setSelectedStatus("");
      setBlockedReason("");
      setStatusValidationMessage("");
      showToast(t("field_engineer_status_updated"));
    } catch (error) {
      console.error("Error updating assignment status:", error);
      showToast(
        t(
          newStatus === WORKFLOW_STATUS.COMPLETED
            ? "field_engineer_completion_update_failed"
            : "field_engineer_status_update_failed"
        ),
        "error"
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const confirmStatusUpdate = (newStatus, reason = "") => {
    Alert.alert(
      t("field_engineer_confirm_status_title"),
      t("field_engineer_confirm_status_message", {
        fromStatus: task.status,
        toStatus: newStatus,
      }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          onPress: () => updateAssignmentStatus(newStatus, reason),
        },
      ]
    );
  };

  const handleStatusSelection = (newStatus) => {
    setSelectedStatus(newStatus);
    setStatusValidationMessage("");

    if (newStatus === WORKFLOW_STATUS.BLOCKED) {
      return;
    }

    if (newStatus === WORKFLOW_STATUS.COMPLETED) {
      const validationMessages = validateCompletion();

      if (validationMessages.length > 0) {
        Alert.alert(
          t("field_engineer_completion_blocked_title"),
          validationMessages.map((message) => `• ${message}`).join("\n")
        );
        return;
      }
    }

    confirmStatusUpdate(newStatus);
  };

  const handleBlockedSubmit = () => {
    const reason = blockedReason.trim();

    if (!reason) {
      setStatusValidationMessage(t("field_engineer_block_reason_required"));
      return;
    }

    confirmStatusUpdate(WORKFLOW_STATUS.BLOCKED, reason);
  };

  const customerPhone = task.customerPrimaryContactPhone || task.contactPhone;
  const customerPhoneDialValue = getPhoneDialValue(customerPhone);
  const customerEmail = task.customerPrimaryContactEmail || task.contactEmail;
  const customerEmailAddress = getEmailAddress(customerEmail);

  const openPhone = () =>
    openUrl(
      `tel:${customerPhoneDialValue}`,
      t("field_engineer_action_unavailable")
    );

  const openEmail = () =>
    openUrl(
      `mailto:${customerEmailAddress}`,
      t("field_engineer_action_unavailable")
    );

  const openNavigation = () => {
    const encodedLocation = encodeURIComponent(
      task.customerAddress || task.customerNavigationLocation || ""
    );
    const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`;

    return Linking.openURL(navigationUrl).catch((error) => {
      console.error("Error opening assignment navigation:", error);
      showToast(t("field_engineer_action_unavailable"), "error");
    });
  };

  const openCustomerAddress = () => {
    const encodedLocation = encodeURIComponent(
      task.customerAddress || task.customerNavigationLocation || ""
    );
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;

    return Linking.openURL(mapUrl).catch((error) => {
      console.error("Error opening customer address:", error);
      showToast(t("field_engineer_action_unavailable"), "error");
    });
  };

  const getReviewPreviewType = (mimeType = "", item = {}) => {
    const normalizedMimeType = String(mimeType || "").toLowerCase();
    const normalizedContentType = String(item?.contentType || "").toLowerCase();

    if (normalizedMimeType.startsWith("image/")) {
      return "image";
    }

    if (normalizedMimeType.startsWith("video/")) {
      return "video";
    }

    if (
      normalizedMimeType === "application/pdf" ||
      normalizedContentType.includes("pdf") ||
      normalizedContentType.includes("document")
    ) {
      return "pdf";
    }

    return "";
  };

  const previewReviewDocument = (
    fileUri,
    item = {},
    mimeType = "",
    fileName = ""
  ) => {
    if (!fileUri) {
      setReviewDocumentMessage(t("field_engineer_review_open_unavailable"));
      return;
    }

    let previewType = getReviewPreviewType(mimeType, item);
    if (!previewType) {
      previewType = "unsupported";
    }

    setReviewPreviewUri(fileUri);
    setReviewPreviewType(previewType);
    setReviewPreviewTitle(
      item?.title || t("field_engineer_open_review_document")
    );
    setReviewPreviewName(
      fileName || item?.title || t("field_engineer_open_review_document")
    );
    setReviewPreviewMimeType(mimeType || item?.mimeType || "");
    setIsReviewPreviewVisible(true);
  };

  const closeReviewPreview = () => {
    setIsReviewPreviewVisible(false);
    setReviewPreviewUri(null);
    setReviewPreviewType(null);
    setReviewPreviewTitle("");
    setReviewPreviewName("");
    setReviewPreviewMimeType("");
  };

  const openReviewDocument = async (item) => {
    setReviewDocumentMessage("");

    try {
      if (item.url) {
        await openUrl(item.url, t("field_engineer_review_open_unavailable"));
        return;
      }

      if (item.resourceId) {
        const attachmentInfo = await fetchAttachmentResourceInfo(
          item.resourceId
        );

        if (attachmentInfo?.original) {
          const originalCachedPath = await fetchAndCacheResource(
            attachmentInfo.original
          );

          if (originalCachedPath) {
            previewReviewDocument(
              originalCachedPath,
              item,
              attachmentInfo.mimeType,
              attachmentInfo.fileName || item?.title
            );
            return;
          }
        }

        let cachedPath = "";

        try {
          cachedPath = await fetchAndCacheResource(item.resourceId);
        } catch (error) {
          console.error("Error opening review item resource:", error);
        }

        if (cachedPath) {
          previewReviewDocument(cachedPath, item, item.mimeType, item?.title);
          return;
        }
      }

      setReviewDocumentMessage(t("field_engineer_review_open_unavailable"));
    } catch (error) {
      console.error("Error opening customer review document:", error);
      setReviewDocumentMessage(t("field_engineer_review_open_unavailable"));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={30}
              color="#005eb8"
            />
          </View>
          <View style={styles.heroTextContainer}>
            <Text style={styles.title}>
              {task.title || "Untitled assignment"}
            </Text>
            <View style={styles.badgeRow}>
              {!!task.status && (
                <View style={[styles.statusPill, getStatusStyle(task.status)]}>
                  <Text style={styles.statusPillText}>{task.status}</Text>
                </View>
              )}
              {!!task.priority && (
                <View style={styles.priorityPill}>
                  <Text style={styles.priorityText}>{task.priority}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <ActionButton
            label={t("field_engineer_call_customer")}
            disabled={!customerPhoneDialValue}
            onPress={openPhone}
            icon={<Ionicons name="call-outline" size={20} color="#005eb8" />}
          />
          <ActionButton
            label={t("field_engineer_email_customer")}
            disabled={!customerEmailAddress}
            onPress={openEmail}
            icon={<Ionicons name="mail-outline" size={20} color="#005eb8" />}
          />
          <ActionButton
            label={t("field_engineer_navigate_customer_address")}
            disabled={!task.customerAddress && !task.customerNavigationLocation}
            onPress={openNavigation}
            icon={
              <Ionicons name="navigate-outline" size={20} color="#005eb8" />
            }
          />
        </View>

        {validTransitions.length > 0 && (
          <TouchableOpacity
            style={styles.updateStatusButton}
            onPress={() => setStatusSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t("field_engineer_update_status")}
          >
            <Ionicons name="git-branch-outline" size={20} color="#fff" />
            <Text style={styles.updateStatusButtonText}>
              {t("field_engineer_update_status")}
            </Text>
          </TouchableOpacity>
        )}

        {(!!slaState || !!targetCompletion || !!slaTimeText) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("field_engineer_sla_summary")}
            </Text>
            {!!slaState && (
              <View style={styles.slaSummaryRow}>
                <Text style={styles.detailLabel}>
                  {t("field_engineer_sla_status")}
                </Text>
                <View style={[styles.slaChip, styles[`${slaState}Chip`]]}>
                  <Text style={[styles.slaChipText, styles[`${slaState}Text`]]}>
                    {slaLabel}
                  </Text>
                </View>
              </View>
            )}
            <DetailRow
              label={t("field_engineer_target_completion")}
              value={targetCompletion}
            />
            <DetailRow
              label={t("field_engineer_sla_time")}
              value={slaTimeText}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("field_engineer_customer_information")}
          </Text>
          <DetailRow
            label={t("field_engineer_customer_name")}
            value={task.customer}
          />
          <DetailRow
            label={t("field_engineer_customer_address")}
            value={task.customerAddress}
            actionIconName="map-outline"
            onPress={
              task.customerAddress || task.customerNavigationLocation
                ? openCustomerAddress
                : undefined
            }
          />
          <DetailRow
            label={t("field_engineer_primary_contact_name")}
            value={task.customerPrimaryContactName || task.contactName}
          />
          <DetailRow
            label={t("field_engineer_primary_contact_job_title")}
            value={task.customerPrimaryContactJobTitle}
          />
          <DetailRow
            label={t("field_engineer_primary_contact_phone")}
            value={customerPhone}
          />
          <DetailRow
            label={t("field_engineer_primary_contact_email")}
            value={customerEmail}
          />
        </View>

        {(reviewItems.length > 0 || reviewRequired) && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleNoMargin}>
                {t("field_engineer_customer_review")}
              </Text>
              <View
                style={[
                  styles.signOffStatusPill,
                  reviewAcknowledgement
                    ? styles.signOffSignedPill
                    : hasRequiredReviewItems
                      ? styles.signOffMissingPill
                      : styles.signOffOptionalPill,
                ]}
              >
                <Text
                  style={[
                    styles.signOffStatusText,
                    reviewAcknowledgement
                      ? styles.signOffSignedText
                      : hasRequiredReviewItems
                        ? styles.signOffMissingText
                        : styles.signOffOptionalText,
                  ]}
                >
                  {reviewAcknowledgement
                    ? t("field_engineer_review_acknowledged")
                    : hasRequiredReviewItems
                      ? t("field_engineer_required")
                      : t("field_engineer_optional")}
                </Text>
              </View>
            </View>
            <GuidanceNote text={t("field_engineer_customer_review_help")} />
            {reviewConfigurationMissing && (
              <GuidanceNote
                text={t("field_engineer_review_configuration_missing")}
                variant="warning"
              />
            )}
            {!reviewConfigurationMissing &&
              !reviewAcknowledgement &&
              unviewedRequiredReviewItems.length > 0 && (
                <GuidanceNote
                  text={t("field_engineer_review_view_required_items", {
                    count: unviewedRequiredReviewItems.length,
                  })}
                  variant="warning"
                />
              )}
            {reviewItems.map((item) => (
              <View key={item.id} style={styles.reviewItemCompact}>
                <View style={styles.reviewItemText}>
                  <Text style={styles.reviewItemTitle}>{item.title}</Text>
                  {item.required && (
                    <Text style={styles.reviewItemMeta}>
                      {t("field_engineer_required")}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.reviewItemButton}
                  onPress={() => openReviewItem(item)}
                  accessibilityRole="button"
                >
                  <Text style={styles.reviewItemButtonText}>
                    {t("field_engineer_view_review_item")}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            {reviewAcknowledgement ? (
              <View style={styles.reviewSummary}>
                <Text style={styles.detailLabel}>
                  {t("field_engineer_review_acknowledgement")}
                </Text>
                <Text style={styles.detailValue}>
                  {t("field_engineer_review_acknowledged_on", {
                    date: formatDateTime(reviewAcknowledgement.timestamp),
                  })}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.secondaryActionButton, styles.tappableCard]}
                onPress={recordReviewAcknowledgement}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel={t(
                  "field_engineer_record_review_acknowledgement"
                )}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#005eb8"
                />
                <Text style={styles.secondaryActionButtonText}>
                  {t("field_engineer_record_review_acknowledgement")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {showChecklistSection && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleNoMargin}>
                {t("field_engineer_checklist")}
              </Text>
              {hasChecklistItems && (
                <Text style={styles.sectionCount}>
                  {t("field_engineer_checklist_progress", {
                    completed: checklistCompletedCount,
                    total: checklistTotalCount,
                  })}
                </Text>
              )}
            </View>
            {isExecutionEvidenceLocked && (
              <GuidanceNote
                text={t("field_engineer_checklist_locked_after_signoff")}
              />
            )}
            {hasChecklistItems ? (
              executionState.checklist.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.checklistRow,
                    isExecutionEvidenceLocked && styles.lockedChecklistRow,
                  ]}
                  onPress={() => toggleChecklistItem(item.id)}
                  disabled={isExecutionEvidenceLocked}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: item.completed,
                    disabled: isExecutionEvidenceLocked,
                  }}
                >
                  <Checkbox
                    value={item.completed}
                    onValueChange={() => toggleChecklistItem(item.id)}
                    color={item.completed ? "#005eb8" : undefined}
                    style={styles.checklistCheckbox}
                    disabled={isExecutionEvidenceLocked}
                  />
                  <View style={styles.checklistTextContainer}>
                    <Text
                      style={[
                        styles.checklistLabel,
                        item.completed && styles.checklistLabelCompleted,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {!!item.helpText && (
                      <Text style={styles.checklistHelpText}>
                        {item.helpText}
                      </Text>
                    )}
                    {item.required && (
                      <Text style={styles.requiredText}>
                        {t("field_engineer_required")}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <GuidanceNote
                text={t("field_engineer_checklist_required_missing")}
                variant="warning"
              />
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleNoMargin}>
              {t("field_engineer_work_photos")}
            </Text>
            <Text style={styles.sectionCount}>
              {t("field_engineer_photo_count", {
                count: executionState.photos.length,
              })}
            </Text>
          </View>
          <GuidanceNote
            text={
              workPhotosRequired
                ? t("field_engineer_work_photos_help", {
                    count: requiredWorkPhotoCount,
                  })
                : t("field_engineer_work_photos_optional_help")
            }
          />
          {!canCaptureWorkPhoto && (
            <GuidanceNote
              text={
                checklistConfigurationMissing
                  ? t("field_engineer_checklist_required_missing")
                  : t("field_engineer_photo_checklist_required")
              }
              variant="warning"
            />
          )}
          {isExecutionEvidenceLocked && (
            <GuidanceNote
              text={t("field_engineer_work_photos_locked_after_signoff")}
            />
          )}
          <TouchableOpacity
            style={[
              styles.secondaryActionButton,
              canCaptureWorkPhoto &&
                !isCapturingPhoto &&
                !isExecutionEvidenceLocked &&
                styles.tappableCard,
              (!canCaptureWorkPhoto ||
                isCapturingPhoto ||
                isExecutionEvidenceLocked) &&
                styles.actionButtonDisabled,
            ]}
            onPress={captureWorkPhoto}
            disabled={
              !canCaptureWorkPhoto ||
              isCapturingPhoto ||
              isExecutionEvidenceLocked
            }
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={t("field_engineer_capture_photo")}
          >
            {isCapturingPhoto ? (
              <ActivityIndicator size="small" color="#005eb8" />
            ) : (
              <Ionicons name="camera-outline" size={20} color="#005eb8" />
            )}
            <Text style={styles.secondaryActionButtonText}>
              {t("field_engineer_capture_photo")}
            </Text>
          </TouchableOpacity>
          {executionState.photos.length > 0 ? (
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoGallery}
            >
              {executionState.photos.map((photo) => (
                <View key={photo.id} style={styles.photoTile}>
                  {photo.uri ? (
                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                  ) : (
                    <View style={styles.photoUnavailable}>
                      <Ionicons
                        name="image-outline"
                        size={24}
                        color="#6b7280"
                      />
                      <Text style={styles.photoUnavailableText}>
                        {t("field_engineer_photo_unavailable")}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.deletePhotoButton,
                      isExecutionEvidenceLocked &&
                        styles.deletePhotoButtonDisabled,
                    ]}
                    onPress={() => confirmDeletePhoto(photo)}
                    disabled={isExecutionEvidenceLocked}
                    accessibilityRole="button"
                    accessibilityLabel={t("delete")}
                  >
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.photoTimestamp} numberOfLines={1}>
                    {formatDateTime(photo.timestamp)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptySectionText}>
              {t("field_engineer_no_work_photos")}
            </Text>
          )}
        </View>

        {showSignOffSection && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleNoMargin}>
                {t("field_engineer_customer_signoff")}
              </Text>
              <View
                style={[
                  styles.signOffStatusPill,
                  signOff
                    ? styles.signOffSignedPill
                    : styles.signOffMissingPill,
                ]}
              >
                <Text
                  style={[
                    styles.signOffStatusText,
                    signOff
                      ? styles.signOffSignedText
                      : styles.signOffMissingText,
                  ]}
                >
                  {signOff
                    ? signOff.type === "skipped"
                      ? t("field_engineer_signoff_skipped")
                      : t("field_engineer_signoff_signed")
                    : t("field_engineer_signoff_not_signed")}
                </Text>
              </View>
            </View>
            <GuidanceNote text={t("field_engineer_customer_signoff_help")} />
            {isExecutionEvidenceLocked && (
              <GuidanceNote text={t("field_engineer_signoff_update_help")} />
            )}
            {reviewItems.length > 0 && (
              <View style={styles.reviewSummary}>
                <Text style={styles.detailLabel}>
                  {t("field_engineer_customer_review")}
                </Text>
                <Text style={styles.detailValue}>
                  {reviewAcknowledgement
                    ? t("field_engineer_review_acknowledged_on", {
                        date: formatDateTime(reviewAcknowledgement.timestamp),
                      })
                    : hasRequiredReviewItems
                      ? t("field_engineer_review_required")
                      : t("field_engineer_review_optional")}
                </Text>
              </View>
            )}
            {!!signOff && (
              <View style={styles.signOffSummary}>
                <DetailRow
                  label={t("field_engineer_customer_name")}
                  value={signOff.customerName}
                />
                <DetailRow
                  label={t("field_engineer_signature_timestamp")}
                  value={formatDateTime(signOff.timestamp)}
                />
                <DetailRow
                  label={t("field_engineer_skip_reason")}
                  value={signOff.reason}
                />
                {signOff.type === "signed" &&
                  (signOff.signaturePaths?.length || signOff.signatureUri) && (
                    <View style={styles.signaturePreview}>
                      {signOff.signaturePaths?.length ? (
                        <Svg width="100%" height="120" viewBox="0 0 320 180">
                          {signOff.signaturePaths.map((path, index) => (
                            <Path
                              key={`saved-signature-${index}`}
                              d={getSignaturePathData(path)}
                              fill="none"
                              stroke="#111827"
                              strokeWidth={3}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ))}
                        </Svg>
                      ) : (
                        <Image
                          source={{ uri: signOff.signatureUri }}
                          style={styles.signatureImagePreview}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                  )}
              </View>
            )}
            {!canCollectSignOff && signOffPrerequisiteMessages.length > 0 && (
              <GuidanceNote
                text={signOffPrerequisiteMessages.join("\n")}
                variant="warning"
              />
            )}
            <TouchableOpacity
              style={[
                styles.secondaryActionButton,
                canCollectSignOff && styles.tappableCard,
                !canCollectSignOff && styles.actionButtonDisabled,
              ]}
              onPress={openSignOff}
              disabled={!canCollectSignOff}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={signOffActionLabel}
            >
              <Ionicons name="create-outline" size={20} color="#005eb8" />
              <Text style={styles.secondaryActionButtonText}>
                {signOffActionLabel}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("field_engineer_status_timeline")}
          </Text>
          <Text style={styles.sectionHelperText}>
            {t("field_engineer_timeline_read_only")}
          </Text>
          {timelineSteps.map((step, index) => {
            const stepState = getTimelineStepState(task, index);
            const isLastStep = index === timelineSteps.length - 1;

            return (
              <View key={step} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      styles.timelineDot,
                      stepState === "completed" && styles.timelineDotCompleted,
                      stepState === "current" && styles.timelineDotCurrent,
                    ]}
                  >
                    {stepState === "completed" && (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                  {!isLastStep && <View style={styles.timelineLine} />}
                </View>
                <Text
                  style={[
                    styles.timelineText,
                    stepState === "completed" && styles.timelineTextCompleted,
                    stepState === "current" && styles.timelineTextCurrent,
                  ]}
                >
                  {step}
                </Text>
              </View>
            );
          })}
        </View>

        {!!task.statusHistory?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("field_engineer_status_history")}
            </Text>
            {task.statusHistory
              .slice()
              .reverse()
              .map((entry, index) => {
                const locationText = getLocationHistoryText(entry.location);
                const recordedByName = getStatusHistoryRecordedByName(entry);

                return (
                  <View
                    key={`${entry.timestamp}-${entry.newStatus}-${index}`}
                    style={styles.historyRow}
                  >
                    <Text style={styles.historyTitle}>
                      {entry.previousStatus}
                      {" -> "}
                      {entry.newStatus}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {formatDateTime(entry.timestamp)}
                    </Text>
                    {!!recordedByName && (
                      <Text style={styles.historyMeta}>
                        {t("field_engineer_recorded_by", {
                          userName: recordedByName,
                        })}
                      </Text>
                    )}
                    {!!locationText && (
                      <View style={styles.historyLocationRow}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color="#6b7280"
                        />
                        <Text style={styles.historyMeta}>{locationText}</Text>
                      </View>
                    )}
                    {!!entry.reason && (
                      <Text style={styles.historyReason}>{entry.reason}</Text>
                    )}
                  </View>
                );
              })}
          </View>
        )}

        {!!executionState.signOffHistory?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("field_engineer_signoff_history")}
            </Text>
            {executionState.signOffHistory
              .slice()
              .reverse()
              .map((entry, index) => {
                const collectorName = getHistoryCollectorName(entry);

                return (
                  <View
                    key={`${entry.timestamp}-${entry.eventKey || entry.event}-${index}`}
                    style={styles.historyRow}
                  >
                    <Text style={styles.historyTitle}>
                      {entry.eventKey ? t(entry.eventKey) : entry.event}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {formatDateTime(entry.timestamp)}
                    </Text>
                    {!!collectorName && (
                      <Text style={styles.historyMeta}>
                        {t("field_engineer_collected_by", {
                          userName: collectorName,
                        })}
                      </Text>
                    )}
                    {!!entry.customerName && (
                      <Text style={styles.historyReason}>
                        {entry.customerName}
                      </Text>
                    )}
                    {!!entry.reason && (
                      <Text style={styles.historyReason}>{entry.reason}</Text>
                    )}
                  </View>
                );
              })}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("field_engineer_task_information")}
          </Text>
          <DetailRow label={t("field_engineer_task_id")} value={task.extId} />
          <DetailRow label={t("description")} value={task.description} />
          <DetailRow
            label={t("field_engineer_progress")}
            value={
              task.percentComplete !== "" &&
              task.percentComplete !== undefined &&
              task.percentComplete !== null
                ? `${task.percentComplete}%`
                : ""
            }
          />
          <DetailRow
            label={t("field_engineer_actual_start")}
            value={actualStart}
          />
          <DetailRow
            label={t("field_engineer_actual_finish")}
            value={actualFinish}
          />
        </View>
      </ScrollView>

      <Modal
        visible={signOffVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeSignOff}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.signOffSheet}>
            <View style={styles.statusSheetHeader}>
              <Text style={styles.statusSheetTitle}>
                {t("field_engineer_customer_signoff")}
              </Text>
              <TouchableOpacity onPress={closeSignOff}>
                <Ionicons name="close-outline" size={26} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.signOffContext}>
                <DetailRow
                  label={t("field_engineer_task_id")}
                  value={task.extId}
                />
                <DetailRow
                  label={t("field_engineer_assignment_title")}
                  value={task.title}
                />
                <DetailRow label={t("customer")} value={task.customer} />
                <DetailRow
                  label={t("location")}
                  value={task.customerAddress}
                  iconName="location-outline"
                />
                <DetailRow
                  label={t("field_engineer_completion_datetime")}
                  value={formatDateTime(new Date().toISOString())}
                />
                <DetailRow label={t("description")} value={task.description} />
              </View>

              <View style={styles.signOffModeRow}>
                <TouchableOpacity
                  style={[
                    styles.signOffModeButton,
                    signOffMode === "signature" &&
                      styles.signOffModeButtonActive,
                  ]}
                  onPress={() => {
                    setSignOffMode("signature");
                    setSignOffValidationMessage("");
                  }}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.signOffModeText,
                      signOffMode === "signature" &&
                        styles.signOffModeTextActive,
                    ]}
                  >
                    {t("field_engineer_signature")}
                  </Text>
                </TouchableOpacity>
                {fieldServicePolicy.allowSignOffSkip && (
                  <TouchableOpacity
                    style={[
                      styles.signOffModeButton,
                      signOffMode === "skip" && styles.signOffModeButtonActive,
                    ]}
                    onPress={() => {
                      setSignOffMode("skip");
                      setSignOffValidationMessage("");
                    }}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.signOffModeText,
                        signOffMode === "skip" && styles.signOffModeTextActive,
                      ]}
                    >
                      {t("field_engineer_customer_not_available")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {!!signOffValidationMessage && (
                <View style={styles.inlineValidationBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color="#b42318"
                  />
                  <Text style={styles.inlineValidationText}>
                    {signOffValidationMessage}
                  </Text>
                </View>
              )}

              {signOffMode === "signature" ? (
                <View>
                  <Text style={styles.detailLabel}>
                    {t("field_engineer_customer_name")}
                  </Text>
                  <TextInput
                    style={styles.signOffInput}
                    value={customerSignOffName}
                    onChangeText={(value) => {
                      setCustomerSignOffName(value);
                      setSignOffValidationMessage("");
                    }}
                    placeholder={t("field_engineer_customer_name_placeholder")}
                    placeholderTextColor="#8a94a6"
                  />
                  <Text style={styles.detailLabel}>
                    {t("field_engineer_customer_signature")}
                  </Text>
                  <View
                    style={styles.signaturePad}
                    {...signaturePanResponder.panHandlers}
                  >
                    <Svg width="100%" height="180" viewBox="0 0 320 180">
                      {signaturePaths.map((path, index) => (
                        <Path
                          key={`signature-${index}`}
                          d={getSignaturePathData(path)}
                          fill="none"
                          stroke="#111827"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                    </Svg>
                    {!signaturePaths.length && (
                      <Text style={styles.signaturePlaceholder}>
                        {t("field_engineer_sign_here")}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.clearSignatureButton}
                    onPress={clearSignature}
                    accessibilityRole="button"
                  >
                    <Text style={styles.clearSignatureText}>
                      {t("field_engineer_clear_signature")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.blockReasonButton}
                    onPress={saveSignatureSignOff}
                    accessibilityRole="button"
                  >
                    <Text style={styles.blockReasonButtonText}>
                      {t("field_engineer_save_signoff")}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={styles.detailLabel}>
                    {t("field_engineer_skip_reason")}
                  </Text>
                  <TextInput
                    style={styles.blockReasonInput}
                    value={skipReason}
                    onChangeText={(value) => {
                      setSkipReason(value);
                      setSignOffValidationMessage("");
                    }}
                    placeholder={t("field_engineer_skip_reason_placeholder")}
                    placeholderTextColor="#8a94a6"
                    multiline={true}
                  />
                  <View style={styles.reasonChips}>
                    {skipReasonOptions.map((reason) => (
                      <TouchableOpacity
                        key={reason}
                        style={styles.reasonChip}
                        onPress={() => {
                          setSkipReason(reason);
                          setSignOffValidationMessage("");
                        }}
                        accessibilityRole="button"
                      >
                        <Text style={styles.reasonChipText}>{reason}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={styles.blockReasonButton}
                    onPress={saveSkippedSignOff}
                    accessibilityRole="button"
                  >
                    <Text style={styles.blockReasonButtonText}>
                      {t("field_engineer_save_skip_reason")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!reviewModalItem}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setReviewModalItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.reviewSheet}>
            <View style={styles.statusSheetHeader}>
              <View style={styles.reviewSheetTitleContainer}>
                <Text style={styles.statusSheetTitle} numberOfLines={2}>
                  {reviewModalItem?.title}
                </Text>
                {!!reviewModalItem?.required && (
                  <Text style={styles.reviewItemMeta}>
                    {t("field_engineer_required")}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setReviewModalItem(null)}>
                <Ionicons name="close-outline" size={26} color="#111827" />
              </TouchableOpacity>
            </View>
            {reviewModalItem?.content ? (
              <WebView
                originWhitelist={["*"]}
                source={{
                  html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${reviewModalItem.content}</body></html>`,
                }}
                style={styles.reviewWebView}
              />
            ) : (
              <View style={styles.reviewDocumentPanel}>
                <Ionicons
                  name="document-text-outline"
                  size={42}
                  color="#005eb8"
                />
                <Text style={styles.emptySectionText}>
                  {t("field_engineer_review_document_help")}
                </Text>
                {!!reviewDocumentMessage && (
                  <View style={styles.inlineWarningBox}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={16}
                      color="#92400e"
                    />
                    <Text style={styles.inlineWarningText}>
                      {reviewDocumentMessage}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.blockReasonButton,
                    styles.reviewDocumentButton,
                    !reviewModalItem?.url &&
                      !reviewModalItem?.resourceId &&
                      styles.actionButtonDisabled,
                  ]}
                  onPress={() => openReviewDocument(reviewModalItem)}
                  disabled={
                    !reviewModalItem?.url && !reviewModalItem?.resourceId
                  }
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.blockReasonButtonText,
                      styles.reviewDocumentButtonText,
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit={true}
                  >
                    {t("field_engineer_open_review_document")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <PreviewDialog
        isVisible={isReviewPreviewVisible}
        fileUri={reviewPreviewUri}
        fileType={reviewPreviewType}
        fileTitle={reviewPreviewTitle}
        fileName={reviewPreviewName}
        fileMimeType={reviewPreviewMimeType}
        onClose={closeReviewPreview}
      />

      <Modal
        visible={!!pendingPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isSavingPhoto) {
            setPendingPhoto(null);
          }
        }}
      >
        <View style={styles.photoPreviewBackdrop}>
          <View style={styles.photoPreviewSheet}>
            <Text style={styles.statusSheetTitle}>
              {t("field_engineer_review_photo")}
            </Text>
            {!!pendingPhoto?.uri && (
              <Image
                source={{ uri: pendingPhoto.uri }}
                style={styles.photoPreview}
              />
            )}
            <View style={styles.photoPreviewActions}>
              <TouchableOpacity
                style={[
                  styles.photoPreviewSecondaryButton,
                  isSavingPhoto && styles.actionButtonDisabled,
                ]}
                onPress={() => setPendingPhoto(null)}
                disabled={isSavingPhoto}
                accessibilityRole="button"
              >
                <Text style={styles.photoPreviewSecondaryText}>
                  {t("delete")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.photoPreviewSecondaryButton,
                  isSavingPhoto && styles.actionButtonDisabled,
                ]}
                onPress={() => {
                  setPendingPhoto(null);
                  captureWorkPhoto();
                }}
                disabled={isSavingPhoto}
                accessibilityRole="button"
              >
                <Text style={styles.photoPreviewSecondaryText}>
                  {t("field_engineer_retake_photo")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.photoPreviewPrimaryButton,
                  isSavingPhoto && styles.photoPreviewPrimaryButtonDisabled,
                ]}
                onPress={savePendingPhoto}
                disabled={isSavingPhoto}
                accessibilityRole="button"
              >
                {isSavingPhoto ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.photoPreviewPrimaryText}>
                    {t("save")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={statusSheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setStatusSheetVisible(false);
          setStatusValidationMessage("");
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.statusSheet}>
            <View style={styles.statusSheetHeader}>
              <Text style={styles.statusSheetTitle}>
                {t("field_engineer_update_status")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setStatusSheetVisible(false);
                  setStatusValidationMessage("");
                }}
              >
                <Ionicons name="close-outline" size={26} color="#111827" />
              </TouchableOpacity>
            </View>
            <Text style={styles.statusSheetHelp}>
              {t("field_engineer_valid_next_status_help")}
            </Text>
            {validTransitions.map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusOption,
                  isUpdatingStatus && styles.actionButtonDisabled,
                ]}
                onPress={() => handleStatusSelection(status)}
                disabled={isUpdatingStatus}
                accessibilityRole="button"
              >
                <View style={styles.statusOptionIcon}>
                  <Ionicons
                    name="arrow-forward-outline"
                    size={18}
                    color="#005eb8"
                  />
                </View>
                <View style={styles.statusOptionContent}>
                  <Text style={styles.statusOptionTitle}>
                    {t(`field_engineer_transition_${status}`)}
                  </Text>
                  <Text style={styles.statusOptionSubtitle}>
                    {t("field_engineer_transition_from_to", {
                      fromStatus: task.status,
                      toStatus: status,
                    })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8a94a6" />
              </TouchableOpacity>
            ))}
            {selectedStatus === WORKFLOW_STATUS.BLOCKED && (
              <View style={styles.blockReasonContainer}>
                {!!statusValidationMessage && (
                  <View style={styles.inlineValidationBox}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={18}
                      color="#b42318"
                    />
                    <Text style={styles.inlineValidationText}>
                      {statusValidationMessage}
                    </Text>
                  </View>
                )}
                <Text style={styles.detailLabel}>
                  {t("field_engineer_block_reason")}
                </Text>
                <TextInput
                  style={styles.blockReasonInput}
                  value={blockedReason}
                  onChangeText={(value) => {
                    setBlockedReason(value);
                    setStatusValidationMessage("");
                  }}
                  placeholder={t("field_engineer_block_reason_placeholder")}
                  placeholderTextColor="#8a94a6"
                  multiline={true}
                />
                <View style={styles.reasonChips}>
                  {blockedReasonOptions.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={styles.reasonChip}
                      onPress={() => {
                        setBlockedReason(reason);
                        setStatusValidationMessage("");
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.reasonChipText}>{reason}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.blockReasonButton}
                  onPress={handleBlockedSubmit}
                  disabled={isUpdatingStatus}
                >
                  <Text style={styles.blockReasonButtonText}>
                    {t("field_engineer_continue")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {isUpdatingStatus && (
              <ActivityIndicator
                size="small"
                color="#005eb8"
                style={styles.statusUpdatingIndicator}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f8fb",
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 32,
  },
  headerLeftContainer: {
    maxWidth: screenDimension.width / 1.5,
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    color: "#fff",
    fontSize: screenDimension.width > 400 ? 18 : 16,
    fontWeight: "bold",
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#e5eef7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroTextContainer: {
    flex: 1,
  },
  title: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#4b5563",
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 6,
    marginTop: 8,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  statusAssigned: {
    backgroundColor: "#6b7280",
  },
  statusProgress: {
    backgroundColor: "#005eb8",
  },
  statusBlocked: {
    backgroundColor: "#c2410c",
  },
  statusCompleted: {
    backgroundColor: "#17633a",
  },
  slaChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  slaChipText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  onTrackChip: {
    backgroundColor: "#dcfce7",
  },
  onTrackText: {
    color: "#17633a",
  },
  atRiskChip: {
    backgroundColor: "#fff7ed",
  },
  atRiskText: {
    color: "#c2410c",
  },
  breachedChip: {
    backgroundColor: "#fff1f2",
  },
  breachedText: {
    color: "#be123c",
  },
  priorityPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#fef3c7",
  },
  priorityText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "bold",
  },
  actionRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    minHeight: 76,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    shadowColor: "#0f172a",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tappableCard: {
    borderColor: "#b9d5ef",
    borderWidth: 1,
    shadowColor: "#0f172a",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: "#005eb8",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 6,
  },
  disabledText: {
    color: "#4b5563",
  },
  updateStatusButton: {
    minHeight: 46,
    backgroundColor: "#005eb8",
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 8,
  },
  updateStatusButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 12,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  sectionTitleNoMargin: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "bold",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    marginBottom: 8,
  },
  sectionCount: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "bold",
  },
  sectionHelperText: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  sectionWarningText: {
    color: "#9f1239",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    marginBottom: 10,
  },
  guidanceNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 8,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  guidanceNoteWarning: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
  },
  guidanceNoteText: {
    flex: 1,
    color: "#4b5563",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  guidanceNoteWarningText: {
    color: "#9f1239",
  },
  secondaryActionButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#005eb8",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    columnGap: 8,
  },
  secondaryActionButtonText: {
    color: "#005eb8",
    fontWeight: "bold",
  },
  photoGallery: {
    columnGap: 10,
    paddingTop: 12,
  },
  photoTile: {
    width: 112,
  },
  photo: {
    width: 112,
    height: 88,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  photoUnavailable: {
    width: 112,
    height: 88,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  photoUnavailableText: {
    color: "#6b7280",
    fontSize: 11,
    lineHeight: 14,
    marginTop: 4,
    textAlign: "center",
  },
  deletePhotoButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(17, 24, 39, 0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  deletePhotoButtonDisabled: {
    opacity: 0.45,
  },
  photoTimestamp: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 5,
  },
  emptySectionText: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingVertical: 10,
  },
  lockedChecklistRow: {
    opacity: 0.72,
  },
  checklistCheckbox: {
    marginTop: 2,
    marginRight: 10,
  },
  checklistTextContainer: {
    flex: 1,
  },
  checklistLabel: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  checklistLabelCompleted: {
    color: "#6b7280",
    textDecorationLine: "line-through",
  },
  checklistHelpText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  requiredText: {
    color: "#be123c",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 4,
  },
  reviewSummary: {
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    marginBottom: 10,
  },
  reviewItem: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingVertical: 10,
  },
  reviewItemCompact: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    backgroundColor: "#fff",
    borderWidth: 0.5,
    borderColor: "#d7dee8",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  reviewItemText: {
    flex: 1,
  },
  reviewItemTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "bold",
  },
  reviewItemMeta: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 3,
  },
  reviewItemButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#005eb8",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reviewItemButtonText: {
    color: "#005eb8",
    fontSize: 12,
    fontWeight: "bold",
  },
  signOffStatusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  signOffSignedPill: {
    backgroundColor: "#dcfce7",
  },
  signOffMissingPill: {
    backgroundColor: "#f3f4f6",
  },
  signOffOptionalPill: {
    backgroundColor: "#e0f2fe",
  },
  signOffStatusText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  signOffSignedText: {
    color: "#17633a",
  },
  signOffMissingText: {
    color: "#4b5563",
  },
  signOffOptionalText: {
    color: "#075985",
  },
  signOffSummary: {
    marginBottom: 10,
  },
  signaturePreview: {
    height: 120,
    borderWidth: 1,
    borderColor: "#d7dee8",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginTop: 8,
    overflow: "hidden",
  },
  signatureImagePreview: {
    width: "100%",
    height: "100%",
  },
  signOffSheet: {
    maxHeight: "90%",
    backgroundColor: "#f6f8fb",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
  },
  reviewSheet: {
    height: "88%",
    backgroundColor: "#f6f8fb",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
  },
  reviewSheetTitleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  reviewWebView: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  reviewDocumentPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 18,
  },
  reviewDocumentButton: {
    alignSelf: "stretch",
    paddingHorizontal: 14,
  },
  reviewDocumentButtonText: {
    textAlign: "center",
    flexShrink: 1,
  },
  inlineWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    alignSelf: "stretch",
  },
  inlineWarningText: {
    flex: 1,
    color: "#92400e",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  signOffContext: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#d7dee8",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  signOffModeRow: {
    flexDirection: "row",
    columnGap: 8,
    marginBottom: 12,
  },
  signOffModeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cfd8e3",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  signOffModeButtonActive: {
    backgroundColor: "#005eb8",
    borderColor: "#005eb8",
  },
  signOffModeText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  signOffModeTextActive: {
    color: "#fff",
  },
  signOffInput: {
    minHeight: 44,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 8,
    paddingHorizontal: 10,
    color: "#111827",
    marginBottom: 12,
  },
  inlineValidationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecdd3",
    backgroundColor: "#fff1f2",
    padding: 10,
    marginBottom: 12,
  },
  inlineValidationText: {
    flex: 1,
    color: "#9f1239",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  signaturePad: {
    height: 180,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
  },
  signaturePlaceholder: {
    position: "absolute",
    alignSelf: "center",
    top: 76,
    color: "#9ca3af",
    fontWeight: "600",
  },
  clearSignatureButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  clearSignatureText: {
    color: "#005eb8",
    fontWeight: "bold",
  },
  reasonChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  reasonChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cfd8e3",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reasonChipText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
  },
  slaSummaryRow: {
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
  },
  detailRow: {
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
  },
  detailContentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  detailTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  detailActionButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    marginTop: 4,
    backgroundColor: "#eef5fc",
  },
  detailActionIcon: {
    marginTop: 0,
    marginLeft: 0,
  },
  detailLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  detailValue: {
    color: "#111827",
    fontSize: 15,
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 40,
  },
  timelineRail: {
    width: 24,
    alignItems: "center",
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#cfd8e3",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotCompleted: {
    borderColor: "#17633a",
    backgroundColor: "#17633a",
  },
  timelineDotCurrent: {
    borderColor: "#005eb8",
    backgroundColor: "#e5eef7",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#d7dee8",
  },
  timelineText: {
    flex: 1,
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "600",
    paddingLeft: 10,
    paddingTop: 2,
  },
  timelineTextCompleted: {
    color: "#17633a",
  },
  timelineTextCurrent: {
    color: "#005eb8",
    fontWeight: "bold",
  },
  historyRow: {
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
  },
  historyTitle: {
    color: "#111827",
    fontWeight: "bold",
  },
  historyMeta: {
    color: "#6b7280",
    marginTop: 4,
    fontSize: 12,
  },
  historyLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginTop: 4,
  },
  historyReason: {
    color: "#111827",
    marginTop: 4,
  },
  photoPreviewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.72)",
    justifyContent: "center",
    padding: 18,
  },
  photoPreviewSheet: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
  },
  photoPreview: {
    width: "100%",
    height: 360,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
    marginTop: 12,
  },
  photoPreviewActions: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 14,
  },
  photoPreviewSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cfd8e3",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPreviewSecondaryText: {
    color: "#111827",
    fontWeight: "bold",
  },
  photoPreviewPrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#005eb8",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPreviewPrimaryButtonDisabled: {
    opacity: 0.7,
  },
  photoPreviewPrimaryText: {
    color: "#fff",
    fontWeight: "bold",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.35)",
  },
  statusSheet: {
    maxHeight: "84%",
    backgroundColor: "#f6f8fb",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
  },
  statusSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusSheetTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "bold",
  },
  statusSheetHelp: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 10,
  },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#b8c7d9",
    borderLeftWidth: 4,
    borderLeftColor: "#005eb8",
    marginBottom: 10,
    shadowColor: "#111827",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statusOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e5eef7",
    alignItems: "center",
    justifyContent: "center",
  },
  statusOptionContent: {
    flex: 1,
  },
  statusOptionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "bold",
  },
  statusOptionSubtitle: {
    color: "#6b7280",
    marginTop: 4,
  },
  blockReasonContainer: {
    marginTop: 6,
  },
  blockReasonInput: {
    minHeight: 86,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 8,
    padding: 10,
    color: "#111827",
    textAlignVertical: "top",
  },
  blockReasonButton: {
    minHeight: 42,
    backgroundColor: "#005eb8",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  blockReasonButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  statusUpdatingIndicator: {
    marginTop: 8,
  },
});

export default FieldEngineerTaskDetail;
