import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { format, isValid } from "date-fns";
import { useTranslation } from "react-i18next";

import { APP } from "../constants";
import CustomBackButton from "../components/CustomBackButton";
import Loader from "../components/Loader";
import { convertToDateFNSFormat } from "../utils/FormatUtils";
import { screenDimension } from "../utils/ScreenUtils";
import { showToast } from "../utils/MessageUtils";
import {
  fetchFieldEngineerTasks,
  getFieldServicePolicy,
  hasFieldEngineerAdminRole,
} from "../utils/FieldEngineerUtils";
import { LoggedInUserInfoContext } from "../../context/LoggedInUserInfoContext";

const ACTIVE_ASSIGNMENT_DISPLAY_LIMIT = 10;
const FIELD_ENGINEER_DASHBOARD_CACHE_KEY = "fieldEngineerDashboardTasksCache";
const FIELD_ENGINEER_DASHBOARD_CACHE_META_KEY =
  "fieldEngineerDashboardTasksCacheMeta";

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

const isWaitingToStart = (task) =>
  String(task.status || "").toLowerCase() === "assigned";

const isInProgress = (task) => {
  const normalizedStatus = String(task.status || "").toLowerCase();

  return [
    "in progress",
    "en route",
    "arrived onsite",
    "work started",
    "blocked",
  ].includes(normalizedStatus);
};

const isActionable = (task) => isWaitingToStart(task) || isInProgress(task);

const getSlaState = (task) => {
  const deadline = getDeadlineDate(task);
  if (!deadline) {
    return "";
  }

  if (isCompleted(task)) {
    return "onTrack";
  }

  const now = new Date();
  const atRiskWindow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  if (deadline < now) {
    return "breached";
  }

  if (deadline <= atRiskWindow) {
    return "atRisk";
  }

  return "onTrack";
};

const getAssignmentPriorityRank = (task) => {
  const slaState = getSlaState(task);
  if (slaState === "breached") {
    return 1;
  }

  if (slaState === "atRisk") {
    return 2;
  }

  if (isInProgress(task)) {
    return 3;
  }

  if (isWaitingToStart(task)) {
    return 4;
  }

  return 5;
};

const sortByUrgency = (a, b) => {
  const rankDifference =
    getAssignmentPriorityRank(a) - getAssignmentPriorityRank(b);
  if (rankDifference !== 0) {
    return rankDifference;
  }

  const aTime = getDeadlineDate(a)?.getTime() || Number.MAX_SAFE_INTEGER;
  const bTime = getDeadlineDate(b)?.getTime() || Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
};

const getStatusChipStyle = (status) => {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus.includes("complete")) {
    return styles.statusCompleted;
  }

  if (normalizedStatus.includes("blocked")) {
    return styles.statusBlocked;
  }

  if (
    normalizedStatus.includes("progress") ||
    normalizedStatus.includes("route") ||
    normalizedStatus.includes("arrived") ||
    normalizedStatus.includes("started")
  ) {
    return styles.statusProgress;
  }

  return styles.statusAssigned;
};

const FieldEngineerDashboard = ({ navigation }) => {
  const { t } = useTranslation();
  const { loggedInUserInfo = {} } = useContext(LoggedInUserInfoContext);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [configurationMenuVisible, setConfigurationMenuVisible] =
    useState(false);
  const [locationLabel, setLocationLabel] = useState(
    t("field_engineer_location_unavailable")
  );

  const engineerName =
    loggedInUserInfo?.knownAs ||
    loggedInUserInfo?.name ||
    loggedInUserInfo?.personId ||
    t("home_hello_user");
  const canAccessJobSettings = hasFieldEngineerAdminRole(loggedInUserInfo);

  const actionableAssignments = useMemo(
    () => tasks.filter((task) => isActionable(task)).sort(sortByUrgency),
    [tasks]
  );

  const completedAssignments = useMemo(
    () => tasks.filter((task) => isCompleted(task)),
    [tasks]
  );

  const displayedActiveAssignments = useMemo(
    () => actionableAssignments.slice(0, ACTIVE_ASSIGNMENT_DISPLAY_LIMIT),
    [actionableAssignments]
  );

  const dailySummary = useMemo(
    () => ({
      assigned: actionableAssignments.filter((task) => isWaitingToStart(task))
        .length,
      inProgress: actionableAssignments.filter((task) => isInProgress(task))
        .length,
      completed: completedAssignments.length,
    }),
    [actionableAssignments, completedAssignments.length]
  );

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) {
      return "";
    }

    return formatDateTime(lastUpdatedAt);
  }, [lastUpdatedAt]);

  const loadLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationLabel(t("field_engineer_location_denied"));
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = currentLocation.coords || {};

      if (latitude && longitude) {
        const places = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        const place = places?.[0] || {};
        const readableLocation = [
          place.name,
          place.city || place.district,
          place.region,
        ]
          .filter(Boolean)
          .join(", ");

        setLocationLabel(
          readableLocation || t("field_engineer_location_available")
        );
      }
    } catch (locationError) {
      console.error("Error loading field services location:", locationError);
      setLocationLabel(t("field_engineer_location_unavailable"));
    }
  }, [t]);

  const nextAssignment = useMemo(
    () => actionableAssignments[0],
    [actionableAssignments]
  );

  const loadCachedDashboard = useCallback(async () => {
    try {
      const cachedTasks = await AsyncStorage.getItem(
        FIELD_ENGINEER_DASHBOARD_CACHE_KEY
      );

      if (!cachedTasks) {
        return false;
      }

      const parsedTasks = JSON.parse(cachedTasks);
      if (!Array.isArray(parsedTasks)) {
        return false;
      }

      const cachedMeta = await AsyncStorage.getItem(
        FIELD_ENGINEER_DASHBOARD_CACHE_META_KEY
      );
      const parsedMeta = cachedMeta ? JSON.parse(cachedMeta) : {};

      setTasks(parsedTasks);
      setLastUpdatedAt(parsedMeta.updatedAt || null);
      return true;
    } catch (cacheError) {
      console.error(
        "Error loading cached field services dashboard:",
        cacheError
      );
      return false;
    }
  }, []);

  const cacheDashboardTasks = useCallback(async (nextTasks = []) => {
    try {
      const updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(
        FIELD_ENGINEER_DASHBOARD_CACHE_KEY,
        JSON.stringify(nextTasks)
      );
      await AsyncStorage.setItem(
        FIELD_ENGINEER_DASHBOARD_CACHE_META_KEY,
        JSON.stringify({ updatedAt })
      );
      setLastUpdatedAt(updatedAt);
    } catch (cacheError) {
      console.error("Error caching field services dashboard:", cacheError);
    }
  }, []);

  const loadDashboard = useCallback(
    async ({ isRefresh = false } = {}) => {
      let hasCachedDashboard = false;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        hasCachedDashboard = await loadCachedDashboard();
        setLoading(!hasCachedDashboard);
        setRefreshing(hasCachedDashboard);
      }

      setError(null);

      try {
        const policy = await getFieldServicePolicy();
        const response = await fetchFieldEngineerTasks({
          status: "All",
          limit: 1000,
          fieldSet: "dashboard",
          taskChangedSince: policy.taskChangedSince,
        });
        const nextTasks = response.data || [];
        setTasks(nextTasks);
        cacheDashboardTasks(nextTasks);
      } catch (loadError) {
        console.error("Error loading field services dashboard:", loadError);
        setError(t("field_engineer_tasks_error"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cacheDashboardTasks, loadCachedDashboard, t]
  );

  const openMap = async () => {
    const target = nextAssignment || actionableAssignments[0];
    const customerLocation =
      target?.customerAddress || target?.customerNavigationLocation;

    if (!customerLocation) {
      showToast(t("field_engineer_map_unavailable"), "warning");
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      customerLocation
    )}`;

    try {
      await Linking.openURL(url);
    } catch (mapError) {
      console.error("Error opening map:", mapError);
      showToast(t("field_engineer_action_unavailable"), "error");
    }
  };

  const startNextAssignment = () => {
    if (!nextAssignment) {
      showToast(t("field_engineer_no_next_assignment"), "warning");
      return;
    }

    navigation.navigate("FieldEngineerTaskDetail", { task: nextAssignment });
  };

  const openAssignmentList = (initialStatus = "All") => {
    navigation.navigate("FieldEngineerAssignments", { initialStatus });
  };

  const renderAssignmentCard = (task) => {
    const targetCompletion = formatDateTime(task.slaDeadline);
    const slaState = getSlaState(task);
    const slaLabel =
      slaState === "breached"
        ? t("field_engineer_sla_breached")
        : slaState === "atRisk"
          ? t("field_engineer_sla_at_risk")
          : t("field_engineer_sla_on_track");

    return (
      <TouchableOpacity
        key={`assignment-${task.id || task.extId}`}
        style={[styles.assignmentCard, styles.tappableCard]}
        onPress={() => navigation.navigate("FieldEngineerTaskDetail", { task })}
        activeOpacity={0.78}
        accessibilityRole="button"
      >
        <View style={styles.assignmentTopRow}>
          <Text style={styles.assignmentTitle} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={styles.assignmentRightActions}>
            <View style={[styles.statusPill, getStatusChipStyle(task.status)]}>
              <Text style={styles.statusText}>{task.status}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#005eb8" />
          </View>
        </View>
        {!!task.customer && (
          <Text style={styles.assignmentMeta} numberOfLines={1}>
            {task.customer}
          </Text>
        )}
        {!!task.customerAddress && (
          <View style={styles.assignmentLocationRow}>
            <Ionicons name="location-outline" size={14} color="#4b5563" />
            <Text style={styles.assignmentLocationText} numberOfLines={1}>
              {task.customerAddress}
            </Text>
          </View>
        )}
        <View style={styles.assignmentBottomRow}>
          {slaState ? (
            <View style={[styles.slaChip, styles[`${slaState}Chip`]]}>
              <Text style={[styles.slaChipText, styles[`${slaState}Text`]]}>
                {slaLabel}
              </Text>
            </View>
          ) : (
            <View />
          )}
          {!!task.priority && (
            <Text style={styles.priorityText}>{task.priority}</Text>
          )}
        </View>
        {!!targetCompletion && (
          <Text style={styles.targetText}>
            {t("field_engineer_target_completion")}: {targetCompletion}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const headerLeft = useCallback(
    () => (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton navigation={navigation} t={t} />
        <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
          {t("field_engineer")}
        </Text>
      </View>
    ),
    [navigation, t]
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft,
      headerRight: canAccessJobSettings
        ? () => (
            <TouchableOpacity
              style={styles.headerMenuButton}
              onPress={() => setConfigurationMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t("field_engineer_configuration")}
            >
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [canAccessJobSettings, headerLeft, navigation, t]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  if (loading && !refreshing) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.content}>
        {(refreshing || !!lastUpdatedLabel) && (
          <View style={styles.refreshStatusRow}>
            {refreshing && (
              <Text style={styles.refreshStatusText}>
                {t("field_engineer_dashboard_refreshing")}
              </Text>
            )}
            {!!lastUpdatedLabel && (
              <Text style={styles.refreshTimestampText}>
                {t("field_engineer_dashboard_last_updated", {
                  date: lastUpdatedLabel,
                })}
              </Text>
            )}
          </View>
        )}

        <View style={styles.profileCard}>
          <View style={styles.profileIcon}>
            <MaterialCommunityIcons
              name="account-hard-hat"
              size={28}
              color="#005eb8"
            />
          </View>
          <View style={styles.profileTextContainer}>
            <Text style={styles.profileName} numberOfLines={1}>
              {engineerName}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#4b5563" />
              <Text
                style={styles.locationText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {locationLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <TouchableOpacity
            style={[styles.summaryCard, styles.tappableCard]}
            onPress={() => openAssignmentList("Assigned")}
            activeOpacity={0.78}
            accessibilityRole="button"
          >
            <Ionicons
              name="chevron-forward"
              size={16}
              color="#8a94a6"
              style={styles.summaryActionIcon}
            />
            <Text style={styles.summaryValue}>{dailySummary.assigned}</Text>
            <Text style={styles.summaryLabel}>
              {t("field_engineer_assigned")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.summaryCard, styles.tappableCard]}
            onPress={() => openAssignmentList("In Progress")}
            activeOpacity={0.78}
            accessibilityRole="button"
          >
            <Ionicons
              name="chevron-forward"
              size={16}
              color="#8a94a6"
              style={styles.summaryActionIcon}
            />
            <Text style={styles.summaryValue}>{dailySummary.inProgress}</Text>
            <Text style={styles.summaryLabel}>
              {t("field_engineer_in_progress")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.summaryCard, styles.tappableCard]}
            onPress={() => openAssignmentList("Completed")}
            activeOpacity={0.78}
            accessibilityRole="button"
          >
            <Ionicons
              name="chevron-forward"
              size={16}
              color="#8a94a6"
              style={styles.summaryActionIcon}
            />
            <Text style={styles.summaryValue}>{dailySummary.completed}</Text>
            <Text style={styles.summaryLabel}>
              {t("field_engineer_completed")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionCard, styles.tappableCard]}
            onPress={() => openAssignmentList("All")}
            activeOpacity={0.78}
            accessibilityRole="button"
          >
            <Ionicons name="list-outline" size={22} color="#005eb8" />
            <Text style={styles.actionText}>
              {t("field_engineer_view_all_assignments")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionCard,
              styles.tappableCard,
              !nextAssignment && styles.actionCardDisabled,
            ]}
            onPress={startNextAssignment}
            disabled={!nextAssignment}
            activeOpacity={0.78}
            accessibilityRole="button"
          >
            <Ionicons name="play-circle-outline" size={22} color="#005eb8" />
            <Text style={styles.actionText}>
              {t("field_engineer_start_next_assignment")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionCard, styles.tappableCard]}
            onPress={openMap}
            activeOpacity={0.78}
            accessibilityRole="button"
          >
            <Ionicons name="map-outline" size={22} color="#005eb8" />
            <Text style={styles.actionText}>
              {t("field_engineer_open_map")}
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => loadDashboard()}>
              <Text style={styles.retryText}>{t("field_engineer_retry")}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t("field_engineer_todays_assignments")}
          </Text>
          <Text style={styles.sectionCount}>
            {actionableAssignments.length}
          </Text>
        </View>
        <Text style={styles.sectionHelperText}>
          {t("field_engineer_active_assignments_help")}
        </Text>

        <FlatList
          style={styles.assignmentList}
          data={displayedActiveAssignments}
          keyExtractor={(item) => `assignment-${item.id || item.extId}`}
          renderItem={({ item }) => renderAssignmentCard(item)}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t("field_engineer_no_active_assignments")}
              </Text>
            </View>
          }
          ListFooterComponent={
            <>
              {actionableAssignments.length >
                ACTIVE_ASSIGNMENT_DISPLAY_LIMIT && (
                <Text style={styles.assignmentLimitText}>
                  {t("field_engineer_showing_active_assignments", {
                    shown: ACTIVE_ASSIGNMENT_DISPLAY_LIMIT,
                    total: actionableAssignments.length,
                  })}
                </Text>
              )}
            </>
          }
          refreshControl={
            <RefreshControl
              refreshing={false}
              tintColor="#005eb8"
              title={t("pull_to_refresh")}
              titleColor="#005eb8"
              colors={["#005eb8"]}
              onRefresh={() => loadDashboard({ isRefresh: true })}
            />
          }
          contentContainerStyle={styles.assignmentListContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
      <Modal
        visible={configurationMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfigurationMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setConfigurationMenuVisible(false)}
        >
          <View style={styles.menuPanel}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setConfigurationMenuVisible(false);
                navigation.navigate("FieldEngineerConfiguration");
              }}
              accessibilityRole="button"
            >
              <Ionicons name="settings-outline" size={18} color="#005eb8" />
              <Text style={styles.menuItemText}>
                {t("field_engineer_configuration")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 30,
  },
  assignmentList: {
    flex: 1,
  },
  assignmentListContent: {
    paddingBottom: 4,
  },
  assignmentLimitText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 10,
    textAlign: "center",
  },
  headerLeftContainer: {
    maxWidth: screenDimension.width / 1.4,
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    color: "#fff",
    fontSize: screenDimension.width > 400 ? 18 : 16,
    fontWeight: "bold",
  },
  headerMenuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.18)",
    alignItems: "flex-end",
    paddingTop: 72,
    paddingRight: 10,
  },
  menuPanel: {
    width: 220,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  menuItemText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#d7dee8",
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
  profileIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: "#e5eef7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  profileTextContainer: {
    flex: 1,
  },
  profileName: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "bold",
  },
  profileMeta: {
    color: "#4b5563",
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginTop: 2,
    minWidth: 0,
  },
  locationText: {
    flex: 1,
    minWidth: 0,
    color: "#4b5563",
  },
  refreshStatusRow: {
    minHeight: 20,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 2,
    marginBottom: 8,
  },
  refreshStatusText: {
    color: "#005eb8",
    fontSize: 12,
    fontWeight: "700",
  },
  refreshTimestampText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 0.5,
    borderColor: "#d7dee8",
    position: "relative",
  },
  summaryActionIcon: {
    position: "absolute",
    right: 8,
    top: 8,
  },
  summaryValue: {
    color: "#005eb8",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  summaryLabel: {
    color: "#4b5563",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: "row",
    columnGap: 8,
    marginTop: 12,
  },
  actionCard: {
    flex: 1,
    minHeight: 74,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#d7dee8",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  actionCardDisabled: {
    opacity: 0.45,
  },
  actionText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 5,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 2,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "bold",
  },
  sectionCount: {
    color: "#005eb8",
    fontWeight: "bold",
  },
  sectionHelperText: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 12,
  },
  assignmentCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  assignmentTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  assignmentRightActions: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    marginLeft: 8,
  },
  assignmentTitle: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    fontWeight: "bold",
    paddingRight: 8,
  },
  assignmentMeta: {
    color: "#4b5563",
    marginTop: 6,
  },
  assignmentLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginTop: 8,
  },
  assignmentLocationText: {
    flex: 1,
    color: "#4b5563",
  },
  assignmentBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  priorityText: {
    color: "#111827",
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "bold",
  },
  targetText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  slaChip: {
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
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
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    borderWidth: 0.5,
    borderColor: "#d7dee8",
  },
  emptyText: {
    color: "#6b7280",
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: "#9f1239",
  },
  retryText: {
    color: "#005eb8",
    fontWeight: "bold",
    marginTop: 8,
  },
});

export default FieldEngineerDashboard;
