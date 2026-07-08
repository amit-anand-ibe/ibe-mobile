import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { format, isToday, isValid } from "date-fns";
import { useTranslation } from "react-i18next";

import { APP } from "../constants";
import CustomBackButton from "../components/CustomBackButton";
import Loader from "../components/Loader";
import ScreenHeader from "../components/ScreenHeader";
import { convertToDateFNSFormat } from "../utils/FormatUtils";
import { screenDimension } from "../utils/ScreenUtils";
import {
  fetchFieldEngineerTasks,
  getFieldServicePolicy,
} from "../utils/FieldEngineerUtils";
import { ThemeContext } from "../theme/ThemeContext";

const STATUS_OPTIONS = [
  "All",
  "Assigned",
  "In Progress",
  "Blocked",
  "Completed",
];
const SORT_OPTIONS = ["Target Completion Date", "Priority", "Recently Updated"];
const PRIORITY_OPTIONS = ["All", "High", "Medium", "Low"];
const SLA_OPTIONS = ["All", "On Track", "At Risk", "Breached"];
const DATE_RANGE_OPTIONS = ["All", "Overdue", "Today", "Upcoming"];

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (!isValid(parsedDate)) {
    return String(value);
  }

  return format(
    parsedDate,
    `${convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)} HH:mm`
  );
};

const getPriorityStyle = (priority) => {
  const normalizedPriority = String(priority || "").toLowerCase();

  if (normalizedPriority.includes("high")) {
    return styles.priorityHigh;
  }

  if (normalizedPriority.includes("low")) {
    return styles.priorityLow;
  }

  return styles.priorityMedium;
};

const getStatusStyle = (status) => {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus.includes("complete")) {
    return styles.statusCompleted;
  }

  if (
    normalizedStatus.includes("progress") ||
    normalizedStatus.includes("route") ||
    normalizedStatus.includes("arrived") ||
    normalizedStatus.includes("started")
  ) {
    return styles.statusProgress;
  }

  if (normalizedStatus.includes("blocked")) {
    return styles.statusBlocked;
  }

  return styles.statusAssigned;
};

const getDeadlineDate = (task) => {
  const parsedDate = new Date(task.slaDeadline);
  return isValid(parsedDate) ? parsedDate : null;
};

const isCompleted = (task) =>
  String(task.status || "")
    .toLowerCase()
    .includes("complete");

const getSlaState = (task) => {
  const deadline = getDeadlineDate(task);
  if (!deadline) {
    return "";
  }

  if (isCompleted(task)) {
    return "On Track";
  }

  const now = new Date();
  const atRiskWindow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  if (deadline < now) {
    return "Breached";
  }

  if (deadline <= atRiskWindow) {
    return "At Risk";
  }

  return "On Track";
};

const getSlaChipStyle = (slaState) => {
  if (slaState === "Breached") {
    return styles.slaBreachedChip;
  }

  if (slaState === "At Risk") {
    return styles.slaAtRiskChip;
  }

  return styles.slaOnTrackChip;
};

const getSlaTextStyle = (slaState) => {
  if (slaState === "Breached") {
    return styles.slaBreachedText;
  }

  if (slaState === "At Risk") {
    return styles.slaAtRiskText;
  }

  return styles.slaOnTrackText;
};

const matchesDateRange = (task, dateRangeFilter) => {
  if (dateRangeFilter === "All") {
    return true;
  }

  const deadline = getDeadlineDate(task);
  if (!deadline) {
    return false;
  }

  const now = new Date();

  if (dateRangeFilter === "Overdue") {
    return deadline < now && !isCompleted(task);
  }

  if (dateRangeFilter === "Today") {
    return isToday(deadline);
  }

  if (dateRangeFilter === "Upcoming") {
    return deadline > now && !isToday(deadline);
  }

  return true;
};

const FieldEngineer = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);

  const initialStatus = route?.params?.initialStatus || "All";
  const [tasks, setTasks] = useState([]);
  const [activeStatus, setActiveStatus] = useState(initialStatus);
  const [sortBy, setSortBy] = useState("Target Completion Date");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [slaFilter, setSlaFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [dateRangeFilter, setDateRangeFilter] = useState("All");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filterSheetMode, setFilterSheetMode] = useState("filters");
  const [customerSearch, setCustomerSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadTasks = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const policy = await getFieldServicePolicy();
        const response = await fetchFieldEngineerTasks({
          status: activeStatus,
          sortBy,
          limit: 1000,
          taskChangedSince: policy.taskChangedSince,
        });
        setTasks(response.data || []);
      } catch (loadError) {
        console.error("Error loading field engineer tasks:", loadError);
        setError(t("field_engineer_tasks_error"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeStatus, sortBy, t]
  );

  const displayedTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const priorityMatches =
          priorityFilter === "All" || task.priority === priorityFilter;
        const slaMatches =
          slaFilter === "All" || getSlaState(task) === slaFilter;
        const customerMatches =
          customerFilter === "All" || task.customer === customerFilter;
        const dateMatches = matchesDateRange(task, dateRangeFilter);
        const normalizedSearch = assignmentSearch.trim().toLowerCase();
        const searchMatches =
          !normalizedSearch ||
          [
            task.title,
            task.description,
            task.extId,
            task.customer,
            task.customerAddress,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(normalizedSearch)
            );

        return (
          priorityMatches &&
          slaMatches &&
          customerMatches &&
          dateMatches &&
          searchMatches
        );
      }),
    [
      assignmentSearch,
      customerFilter,
      dateRangeFilter,
      priorityFilter,
      slaFilter,
      tasks,
    ]
  );

  const headerLeft = useCallback(
    () => (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton navigation={navigation} t={t} />
        <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
          {t("field_engineer")} ({displayedTasks.length})
        </Text>
      </View>
    ),
    [displayedTasks.length, navigation, t]
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft,
    });
  }, [headerLeft, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  useEffect(() => {
    setActiveStatus(initialStatus);
  }, [initialStatus]);

  const customerOptions = useMemo(() => {
    const customers = tasks
      .map((task) => task.customer)
      .filter(Boolean)
      .filter((customer, index, list) => list.indexOf(customer) === index)
      .sort((a, b) => a.localeCompare(b));

    return ["All", ...customers];
  }, [tasks]);

  const customerPickerItems = useMemo(() => customerOptions, [customerOptions]);

  const filteredCustomerOptions = useMemo(() => {
    const normalizedSearch = customerSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return customerPickerItems;
    }

    return customerPickerItems.filter((customer) =>
      customer.toLowerCase().includes(normalizedSearch)
    );
  }, [customerPickerItems, customerSearch]);

  const advancedFilterCount = useMemo(
    () =>
      [priorityFilter, slaFilter, customerFilter, dateRangeFilter].filter(
        (value) => value !== "All"
      ).length,
    [customerFilter, dateRangeFilter, priorityFilter, slaFilter]
  );

  const sortFilterCount = sortBy === "Target Completion Date" ? 0 : 1;

  const themedStyles = useMemo(
    () => ({
      activeChip: {
        backgroundColor: theme.secondary,
        borderColor: theme.secondary,
      },
      activeChipText: {
        color: theme.contrastOnSecondary,
      },
      iconButtonActive: {
        borderColor: theme.secondary,
        backgroundColor: theme.card.backgroundColor,
      },
      iconColor: theme.secondary,
      badge: {
        backgroundColor: theme.secondary,
      },
      badgeText: {
        color: theme.contrastOnSecondary,
      },
      applyButton: {
        backgroundColor: theme.secondary,
      },
      applyButtonText: {
        color: theme.contrastOnSecondary,
      },
      clearButton: {
        borderColor: theme.border.color,
      },
      card: {
        backgroundColor: theme.card.backgroundColor,
      },
      controlBorder: {
        borderColor: theme.border.color,
      },
      selectedCustomer: {
        backgroundColor: theme.card.backgroundColor,
      },
      selectedCustomerText: {
        color: theme.secondary,
      },
    }),
    [theme]
  );

  const resetAdvancedFilters = () => {
    setPriorityFilter("All");
    setSlaFilter("All");
    setCustomerFilter("All");
    setDateRangeFilter("All");
    setCustomerSearch("");
  };

  const openFilterSheet = (mode) => {
    setFilterSheetMode(mode);
    setFiltersVisible(true);
  };

  const clearCurrentSheet = () => {
    if (filterSheetMode === "sort") {
      setSortBy("Target Completion Date");
      return;
    }

    resetAdvancedFilters();
  };

  const renderFilterChips = (
    label,
    options,
    value,
    onChange,
    { hideLabel = false, closeOnSelect = false, scrollerStyle } = {}
  ) => (
    <>
      {!hideLabel && <Text style={styles.controlLabel}>{label}</Text>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.controlScroller, scrollerStyle]}
      >
        {options.map((option) => (
          <TouchableOpacity
            key={`${label}-${option}`}
            style={[
              styles.filterChip,
              themedStyles.controlBorder,
              value === option && styles.filterChipActive,
              value === option && themedStyles.activeChip,
            ]}
            onPress={() => {
              onChange(option);
              if (closeOnSelect) {
                setFiltersVisible(false);
              }
            }}
          >
            <Text
              style={[
                styles.filterChipText,
                value === option && styles.filterChipTextActive,
                value === option && themedStyles.activeChipText,
              ]}
              numberOfLines={1}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );

  const renderFilterControls = () => (
    <View style={styles.filterPanel}>
      <View style={styles.assignmentSearchRow}>
        <Ionicons name="search-outline" size={18} color="#6b7280" />
        <TextInput
          style={styles.assignmentSearchInput}
          value={assignmentSearch}
          onChangeText={setAssignmentSearch}
          placeholder={t("field_engineer_assignment_search_placeholder")}
          placeholderTextColor="#8a94a6"
          returnKeyType="search"
        />
        {!!assignmentSearch && (
          <TouchableOpacity
            onPress={() => setAssignmentSearch("")}
            accessibilityRole="button"
            accessibilityLabel={t("clear")}
          >
            <Ionicons name="close-circle" size={18} color="#8a94a6" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.filterHeaderRow}>
        <View style={styles.statusChipContainer}>
          {renderFilterChips(
            t("field_engineer_status_filter"),
            STATUS_OPTIONS,
            activeStatus,
            setActiveStatus,
            { hideLabel: true, scrollerStyle: styles.statusControlScroller }
          )}
          <View pointerEvents="none" style={styles.statusScrollCue}>
            <Ionicons name="chevron-forward" size={16} color="#8a94a6" />
          </View>
        </View>
        <View style={styles.filterActionRow}>
          <TouchableOpacity
            style={[
              styles.compactIconButton,
              themedStyles.controlBorder,
              sortFilterCount > 0 && styles.compactActionButtonActive,
              sortFilterCount > 0 && themedStyles.iconButtonActive,
            ]}
            onPress={() => openFilterSheet("sort")}
            accessibilityRole="button"
            accessibilityLabel={t("field_engineer_sort_filter")}
          >
            <Ionicons
              name="swap-vertical-outline"
              size={20}
              color={themedStyles.iconColor}
            />
            {sortFilterCount > 0 && (
              <View style={[styles.filterCountBadge, themedStyles.badge]}>
                <Text style={[styles.filterCountText, themedStyles.badgeText]}>
                  {sortFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.compactIconButton,
              themedStyles.controlBorder,
              advancedFilterCount > 0 && styles.compactActionButtonActive,
              advancedFilterCount > 0 && themedStyles.iconButtonActive,
            ]}
            onPress={() => openFilterSheet("filters")}
            accessibilityRole="button"
            accessibilityLabel={t("filters")}
          >
            <Ionicons
              name="filter-outline"
              size={20}
              color={themedStyles.iconColor}
            />
            {advancedFilterCount > 0 && (
              <View style={[styles.filterCountBadge, themedStyles.badge]}>
                <Text style={[styles.filterCountText, themedStyles.badgeText]}>
                  {advancedFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadTasks()}>
            <Text style={styles.retryText}>{t("field_engineer_retry")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderAdvancedFilters = () => (
    <Modal
      visible={filtersVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setFiltersVisible(false)}
    >
      <SafeAreaView
        style={styles.modalBackdrop}
        edges={["top", "right", "bottom", "left"]}
      >
        <View style={styles.filterSheet}>
          <View style={styles.filterSheetHeader}>
            <Text style={styles.filterSheetTitle}>
              {filterSheetMode === "sort"
                ? t("field_engineer_sort_filter")
                : t("filters")}
            </Text>
            <TouchableOpacity onPress={() => setFiltersVisible(false)}>
              <Ionicons name="close-outline" size={26} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.filterSheetBody}
            contentContainerStyle={styles.filterSheetBodyContent}
            showsVerticalScrollIndicator={false}
          >
            {filterSheetMode === "sort" ? (
              renderFilterChips(
                t("field_engineer_sort_filter"),
                SORT_OPTIONS,
                sortBy,
                setSortBy,
                { closeOnSelect: true }
              )
            ) : (
              <>
                {renderFilterChips(
                  t("field_engineer_priority_filter"),
                  PRIORITY_OPTIONS,
                  priorityFilter,
                  setPriorityFilter
                )}
                {renderFilterChips(
                  t("field_engineer_sla_filter"),
                  SLA_OPTIONS,
                  slaFilter,
                  setSlaFilter
                )}
                <Text style={styles.filterHelpText}>
                  {t("field_engineer_sla_status_help")}
                </Text>
                {renderFilterChips(
                  t("field_engineer_date_filter"),
                  DATE_RANGE_OPTIONS,
                  dateRangeFilter,
                  setDateRangeFilter
                )}
                {customerOptions.length > 1 && (
                  <View>
                    <Text style={styles.controlLabel}>
                      {t("field_engineer_customer_filter")}
                    </Text>
                    <View style={styles.customerSearchRow}>
                      <Ionicons
                        name="search-outline"
                        size={18}
                        color="#6b7280"
                      />
                      <TextInput
                        style={styles.customerSearchInput}
                        value={customerSearch}
                        onChangeText={setCustomerSearch}
                        placeholder={t(
                          "field_engineer_customer_search_placeholder"
                        )}
                        placeholderTextColor="#8a94a6"
                      />
                    </View>
                    <View style={styles.customerList}>
                      {filteredCustomerOptions.slice(0, 20).map((customer) => (
                        <TouchableOpacity
                          key={`customer-${customer}`}
                          style={[
                            styles.customerOption,
                            themedStyles.card,
                            customerFilter === customer &&
                              styles.customerOptionActive,
                            customerFilter === customer &&
                              themedStyles.selectedCustomer,
                          ]}
                          onPress={() => setCustomerFilter(customer)}
                        >
                          <Text
                            style={[
                              styles.customerOptionText,
                              customerFilter === customer &&
                                styles.customerOptionTextActive,
                              customerFilter === customer &&
                                themedStyles.selectedCustomerText,
                            ]}
                            numberOfLines={1}
                          >
                            {customer}
                          </Text>
                          {customerFilter === customer && (
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color={themedStyles.iconColor}
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {filterSheetMode !== "sort" && (
            <View style={styles.filterSheetFooter}>
              <TouchableOpacity
                style={[styles.clearButton, themedStyles.clearButton]}
                onPress={clearCurrentSheet}
              >
                <Text style={styles.clearButtonText}>{t("clear")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyButton, themedStyles.applyButton]}
                onPress={() => setFiltersVisible(false)}
              >
                <Text
                  style={[styles.applyButtonText, themedStyles.applyButtonText]}
                >
                  {t("apply")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
  const renderTask = ({ item }) => {
    const slaState = getSlaState(item);
    const slaLabel =
      slaState === "Breached"
        ? t("field_engineer_sla_breached")
        : slaState === "At Risk"
          ? t("field_engineer_sla_at_risk")
          : t("field_engineer_sla_on_track");
    const targetCompletion = formatDateTime(item.slaDeadline);

    return (
      <TouchableOpacity
        style={[styles.taskCard, styles.tappableCard, themedStyles.card]}
        onPress={() =>
          navigation.navigate("FieldEngineerTaskDetail", { task: item })
        }
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`${t("field_engineer_open_task")} ${item.title}`}
      >
        <View style={styles.taskHeader}>
          <View style={styles.taskTitleContainer}>
            <Text
              style={styles.taskTitle}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.title}
            </Text>
            <Text
              style={styles.taskMeta}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.customer || t("field_engineer_customer_unknown")}
            </Text>
          </View>
          <View style={styles.taskRightActions}>
            <View style={[styles.statusPill, getStatusStyle(item.status)]}>
              <Text style={styles.statusPillText}>{item.status}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#005eb8" />
          </View>
        </View>
        <View style={styles.taskInfoRow}>
          <Ionicons name="location-outline" size={16} color="#4b5563" />
          <Text
            style={styles.taskInfoText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.customerAddress || t("field_engineer_location_unavailable")}
          </Text>
        </View>
        <View style={styles.taskFooter}>
          <View style={styles.slaContainer}>
            {!!slaState && (
              <View style={[styles.slaChip, getSlaChipStyle(slaState)]}>
                <Text style={[styles.slaChipText, getSlaTextStyle(slaState)]}>
                  {slaLabel}
                </Text>
              </View>
            )}
            {!!targetCompletion && (
              <Text
                style={styles.slaText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {targetCompletion}
              </Text>
            )}
          </View>
          {!!item.priority && (
            <View
              style={[styles.priorityPill, getPriorityStyle(item.priority)]}
            >
              <Text style={styles.priorityText}>{item.priority}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader left={headerLeft()} />
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      {loading && !refreshing ? (
        <View style={styles.initialLoaderContainer}>
          <Loader />
        </View>
      ) : (
        <>
          {Platform.OS === "ios" && refreshing && <Loader />}
          {renderFilterControls()}
          {renderAdvancedFilters()}
          <FlatList
            style={styles.taskList}
            data={displayedTasks}
            keyExtractor={(item) => item.id || item.extId}
            renderItem={renderTask}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor="#005eb8"
                title={t("pull_to_refresh")}
                titleColor="#005eb8"
                colors={["#005eb8"]}
                onRefresh={() => loadTasks({ isRefresh: true })}
              />
            }
            ListEmptyComponent={
              !error && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="clipboard-outline" size={36} color="#6b7280" />
                  <Text style={styles.emptyTitle}>
                    {t("field_engineer_no_tasks")}
                  </Text>
                  <Text style={styles.emptyText}>
                    {t("field_engineer_no_tasks_description")}
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              refreshing ? (
                <ActivityIndicator size="small" color="#005eb8" />
              ) : null
            }
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f8fb",
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 32,
  },
  initialLoaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPanel: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: "#f6f8fb",
  },
  assignmentSearchRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  assignmentSearchInput: {
    flex: 1,
    color: "#111827",
    fontWeight: "600",
  },
  taskList: {
    flex: 1,
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
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#d7dee8",
  },
  profileIcon: {
    width: 52,
    height: 52,
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
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  profileMeta: {
    color: "#4b5563",
    marginTop: 2,
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
    padding: 12,
    borderWidth: 0.5,
    borderColor: "#d7dee8",
  },
  summaryValue: {
    color: "#005eb8",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  summaryLabel: {
    color: "#4b5563",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  filterHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 8,
  },
  filterActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    columnGap: 6,
  },
  statusChipContainer: {
    flex: 1,
    minWidth: 0,
    position: "relative",
    paddingRight: 16,
  },
  compactIconButton: {
    width: 42,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 8,
    position: "relative",
  },
  compactActionButtonActive: {
    borderColor: "#005eb8",
    backgroundColor: "#e5eef7",
  },
  filterCountBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterCountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  statusControlScroller: {
    marginBottom: 0,
  },
  statusScrollCue: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 22,
    alignItems: "flex-end",
    justifyContent: "center",
    backgroundColor: "rgba(246, 248, 251, 0.92)",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.35)",
  },
  filterSheet: {
    maxHeight: "82%",
    backgroundColor: "#f6f8fb",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  filterSheetBody: {
    flexShrink: 1,
  },
  filterSheetBodyContent: {
    paddingBottom: 8,
  },
  filterSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  filterSheetTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "bold",
  },
  filterSheetFooter: {
    flexDirection: "row",
    columnGap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e5eaf1",
  },
  clearButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
  },
  clearButtonText: {
    color: "#374151",
    fontWeight: "bold",
  },
  applyButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#005eb8",
  },
  applyButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  todayJobRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: "#d7dee8",
  },
  todayJobTitle: {
    flex: 1,
    color: "#111827",
    fontWeight: "600",
    paddingRight: 8,
  },
  todayJobStatus: {
    color: "#005eb8",
    fontWeight: "bold",
  },
  controlScroller: {
    marginBottom: 8,
  },
  controlLabel: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  filterHelpText: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 16,
    marginTop: -2,
    marginBottom: 10,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#005eb8",
    borderColor: "#005eb8",
  },
  filterChipText: {
    color: "#374151",
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  sortChip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#e5eef7",
    marginRight: 8,
  },
  sortChipActive: {
    backgroundColor: "#d9eadf",
  },
  sortChipText: {
    color: "#374151",
    fontWeight: "600",
  },
  sortChipTextActive: {
    color: "#17633a",
  },
  customerSearchRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cfd8e3",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  customerSearchInput: {
    flex: 1,
    color: "#111827",
    fontWeight: "600",
  },
  customerList: {
    maxHeight: 168,
    marginBottom: 10,
  },
  customerOption: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  customerOptionActive: {
    backgroundColor: "#e5eef7",
  },
  customerOptionText: {
    flex: 1,
    color: "#374151",
    fontWeight: "600",
    paddingRight: 8,
  },
  customerOptionTextActive: {
    color: "#005eb8",
  },
  errorContainer: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  errorText: {
    color: "#9f1239",
  },
  retryText: {
    color: "#005eb8",
    fontWeight: "bold",
    marginTop: 8,
  },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
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
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  taskRightActions: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    marginLeft: 8,
  },
  taskTitleContainer: {
    flex: 1,
    paddingRight: 8,
  },
  taskTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "bold",
  },
  taskMeta: {
    color: "#4b5563",
    marginTop: 4,
  },
  taskInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  taskInfoText: {
    flex: 1,
    color: "#4b5563",
    marginLeft: 6,
  },
  taskFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    columnGap: 10,
  },
  slaContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  slaChip: {
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  slaChipText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  slaText: {
    flex: 1,
    minWidth: 0,
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  slaOnTrackChip: {
    backgroundColor: "#dcfce7",
  },
  slaOnTrackText: {
    color: "#17633a",
  },
  slaAtRiskChip: {
    backgroundColor: "#fff7ed",
  },
  slaAtRiskText: {
    color: "#c2410c",
  },
  slaBreachedChip: {
    backgroundColor: "#fff1f2",
  },
  slaBreachedText: {
    color: "#be123c",
  },
  statusPill: {
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
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
  priorityPill: {
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  priorityText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "bold",
  },
  priorityHigh: {
    backgroundColor: "#fee2e2",
  },
  priorityMedium: {
    backgroundColor: "#fef3c7",
  },
  priorityLow: {
    backgroundColor: "#dcfce7",
  },
  emptyContainer: {
    alignItems: "center",
    padding: 28,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
  emptyText: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
  },
});

export default FieldEngineer;
