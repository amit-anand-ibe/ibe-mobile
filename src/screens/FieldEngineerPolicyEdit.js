import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import CustomBackButton from "../components/CustomBackButton";
import {
  ChecklistTemplateSettingPicker,
  CustomerSettingPicker,
  ListSettingPicker,
  ProjectSettingPicker,
  ReviewTemplateSettingPicker,
  TaskTypeSettingPicker,
} from "../components/FieldServiceSettingPickers";
import { showToast } from "../utils/MessageUtils";
import {
  deleteFieldServicePolicy,
  fetchFieldServicePolicies,
  saveFieldServicePolicy,
} from "../utils/FieldEngineerUtils";

const defaultPolicy = {
  id: "",
  extID: "",
  name: "",
  taskType: "",
  customerID: "",
  customerLabel: "",
  customerExtID: "",
  projectID: "",
  projectLabel: "",
  projectExtID: "",
  defaultPolicy: false,
  slaAtRiskHours: 4,
  requiredWorkPhotoCount: 1,
  checklistRequired: true,
  customerSignOffRequired: true,
  allowSignOffSkip: true,
  customerReviewRequired: true,
  checklistTemplateID: "",
  checklistTemplateLabel: "",
  reviewTemplateID: "",
  reviewTemplateLabel: "",
  skipReasonListID: "",
  blockedReasonListID: "",
  taskChangedSince: "",
};

const FieldRow = ({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  placeholder = "",
  required = false,
  error = "",
  helperText = "",
}) => (
  <View style={styles.fieldRow}>
    <Text style={styles.label}>
      {label}
      {required && <Text style={styles.requiredMark}> *</Text>}
    </Text>
    <TextInput
      style={[styles.input, !!error && styles.inputError]}
      value={String(value ?? "")}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      placeholderTextColor="#8a94a6"
    />
    {!!error && <Text style={styles.errorText}>{error}</Text>}
    {!error && !!helperText && <Text style={styles.helperText}>{helperText}</Text>}
  </View>
);

const getDateInputValue = (value) => {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
};

const isValidDateInput = (value) => {
  if (!value) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsedDate.getTime());
};

const toBackendDateInput = (value) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : "";

const ToggleRow = ({ label, value, onValueChange, helperText = "" }) => (
  <View>
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={!!value} onValueChange={onValueChange} />
    </View>
    {!!helperText && <Text style={styles.helperText}>{helperText}</Text>}
  </View>
);

const toBoolean = (value) => {
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

const normalizePolicyForComparison = (policy = {}) =>
  JSON.stringify({
    extID: (policy.extID || "").trim(),
    name: (policy.name || "").trim(),
    taskType: (policy.taskType || "").trim(),
    customerID: policy.customerID || "",
    projectID: policy.projectID || "",
    defaultPolicy: toBoolean(policy.defaultPolicy),
    slaAtRiskHours: Number(policy.slaAtRiskHours || 0),
    requiredWorkPhotoCount: Number(policy.requiredWorkPhotoCount || 0),
    checklistRequired: toBoolean(policy.checklistRequired),
    customerSignOffRequired: toBoolean(policy.customerSignOffRequired),
    allowSignOffSkip: toBoolean(policy.allowSignOffSkip),
    customerReviewRequired: toBoolean(policy.customerReviewRequired),
    checklistTemplateID: policy.checklistTemplateID || "",
    reviewTemplateID: policy.reviewTemplateID || "",
    skipReasonListID: policy.skipReasonListID || "",
    blockedReasonListID: policy.blockedReasonListID || "",
    taskChangedSince: getDateInputValue(policy.taskChangedSince),
  });

const getPolicyScope = (policy = {}) => ({
  taskType: (policy.taskType || "").trim().toLowerCase(),
  customerID: policy.customerID || "",
  projectID: policy.projectID || "",
});

const hasOverlappingPolicyScope = (firstPolicy = {}, secondPolicy = {}) => {
  const firstScope = getPolicyScope(firstPolicy);
  const secondScope = getPolicyScope(secondPolicy);

  return Object.keys(firstScope).every((scopeKey) => {
    const firstValue = firstScope[scopeKey];
    const secondValue = secondScope[scopeKey];
    return !firstValue || !secondValue || firstValue === secondValue;
  });
};

const FieldEngineerPolicyEdit = ({ navigation, route }) => {
  const { t } = useTranslation();
  const existingPolicy = route?.params?.policy || null;
  const initialPolicyRef = useRef(null);
  const allowLeaveRef = useRef(false);
  const [policy, setPolicy] = useState({
    ...defaultPolicy,
    ...(existingPolicy || {}),
    defaultPolicy: toBoolean(
      existingPolicy?.defaultPolicy ?? existingPolicy?.defaultTemplate
    ),
    checklistRequired: toBoolean(
      existingPolicy?.checklistRequired ?? defaultPolicy.checklistRequired
    ),
    customerSignOffRequired: toBoolean(
      existingPolicy?.customerSignOffRequired ??
        defaultPolicy.customerSignOffRequired
    ),
    allowSignOffSkip: toBoolean(
      existingPolicy?.allowSignOffSkip ?? defaultPolicy.allowSignOffSkip
    ),
    customerReviewRequired: toBoolean(
      existingPolicy?.customerReviewRequired ??
        defaultPolicy.customerReviewRequired
    ),
    taskChangedSince: getDateInputValue(existingPolicy?.taskChangedSince),
  });
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isNewPolicy = !existingPolicy?.id;
  const title = useMemo(
    () =>
      isNewPolicy
        ? t("field_engineer_new_policy")
        : t("field_engineer_edit_policy"),
    [isNewPolicy, t]
  );
  const hasUnsavedChanges = useMemo(() => {
    if (!initialPolicyRef.current) {
      return false;
    }

    return normalizePolicyForComparison(policy) !== initialPolicyRef.current;
  }, [policy]);

  useEffect(() => {
    initialPolicyRef.current = normalizePolicyForComparison({
      ...defaultPolicy,
      ...(existingPolicy || {}),
      defaultPolicy: toBoolean(
        existingPolicy?.defaultPolicy ?? existingPolicy?.defaultTemplate
      ),
      checklistRequired: toBoolean(
        existingPolicy?.checklistRequired ?? defaultPolicy.checklistRequired
      ),
      customerSignOffRequired: toBoolean(
        existingPolicy?.customerSignOffRequired ??
          defaultPolicy.customerSignOffRequired
      ),
      allowSignOffSkip: toBoolean(
        existingPolicy?.allowSignOffSkip ?? defaultPolicy.allowSignOffSkip
      ),
      customerReviewRequired: toBoolean(
        existingPolicy?.customerReviewRequired ??
          defaultPolicy.customerReviewRequired
      ),
      taskChangedSince: getDateInputValue(existingPolicy?.taskChangedSince),
    });
  }, [existingPolicy]);

  const headerLeft = useCallback(
    () => (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton
          navigation={navigation}
          hasUnsavedChanges={hasUnsavedChanges}
          discardChanges={() => {
            allowLeaveRef.current = true;
          }}
          t={t}
        />
        <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
      </View>
    ),
    [hasUnsavedChanges, navigation, t, title]
  );

  const handleDelete = useCallback(() => {
    if (!existingPolicy?.id || saving) {
      return;
    }

    Alert.alert(
      t("confirm_deletion_title"),
      t("confirm_deletion_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              await deleteFieldServicePolicy({
                ...existingPolicy,
                extID: policy.extID,
              });
              showToast(t("delete_success"));
              allowLeaveRef.current = true;
              navigation.goBack();
            } catch (error) {
              console.error("Error deleting field service policy:", error);
              showToast(t("delete_failure"), "error");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [existingPolicy, navigation, policy.extID, saving, t]);

  const updatePolicy = (fieldName, value) => {
    setPolicy((currentPolicy) => ({
      ...currentPolicy,
      [fieldName]: value,
    }));
  };

  const validationErrors = useMemo(
    () => ({
      extID: !policy.extID.trim()
        ? t("field_engineer_policy_id_required")
        : "",
      name: !policy.name.trim()
        ? t("field_engineer_policy_name_required")
        : "",
      taskChangedSince: !isValidDateInput(policy.taskChangedSince)
        ? t("field_engineer_policy_task_cutoff_invalid")
        : "",
    }),
    [policy.extID, policy.name, policy.taskChangedSince, t]
  );

  const validatePolicy = () => {
    const firstError = Object.values(validationErrors).find(Boolean);
    if (firstError) {
      showToast(firstError, "warning");
      return false;
    }

    return true;
  };

  const hasDefaultPolicyConflict = async () => {
    if (!policy.defaultPolicy) {
      return false;
    }

    const existingPolicies = await fetchFieldServicePolicies({
      forceRefresh: true,
    });

    return existingPolicies.some(
      (existingItem) =>
        existingItem.id !== policy.id &&
        toBoolean(existingItem.defaultPolicy) &&
        hasOverlappingPolicyScope(existingItem, policy)
    );
  };

  const onSave = async () => {
    setSubmitted(true);

    if (saving || !validatePolicy()) {
      return;
    }

    setSaving(true);

    try {
      if (await hasDefaultPolicyConflict()) {
        showToast(t("field_engineer_default_policy_conflict"), "warning");
        return;
      }

      await saveFieldServicePolicy({
        ...policy,
        slaAtRiskHours: Number(policy.slaAtRiskHours || 0),
        requiredWorkPhotoCount: Number(policy.requiredWorkPhotoCount || 0),
        taskChangedSince: toBackendDateInput(policy.taskChangedSince),
      });
      showToast(t("field_engineer_policy_saved"));
      allowLeaveRef.current = true;
      navigation.goBack();
    } catch (error) {
      console.error("Error saving field service policy:", error);
      showToast(t("field_engineer_policy_save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const headerRight = useCallback(
    () => (
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t("save")}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="save-outline" size={22} color="#fff" />
          )}
        </TouchableOpacity>
        {!isNewPolicy && (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDelete}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t("delete")}
          >
            <Ionicons name="trash-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    ),
    [handleDelete, isNewPolicy, onSave, saving, t]
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft,
      headerRight,
    });
  }, [headerLeft, headerRight, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!hasUnsavedChanges || allowLeaveRef.current) {
        return;
      }

      event.preventDefault();
      Alert.alert(
        t("discard_changes_alert_title"),
        t("discard_changes_alert_message"),
        [
          {
            text: t("discard_changes_alert_button_leave"),
            style: "cancel",
          },
          {
            text: t("discard_changes_alert_button_discard"),
            style: "destructive",
            onPress: () => {
              allowLeaveRef.current = true;
              navigation.dispatch(event.data.action);
            },
          },
        ],
        { cancelable: false }
      );
    });

    return unsubscribe;
  }, [hasUnsavedChanges, navigation, t]);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("field_engineer_policy_identity")}
          </Text>
          <FieldRow
            label={t("field_engineer_policy_id")}
            value={policy.extID}
            required
            helperText={t("field_engineer_policy_id_helper")}
            error={submitted ? validationErrors.extID : ""}
            onChangeText={(value) => updatePolicy("extID", value)}
          />
          <FieldRow
            label={t("field_engineer_policy_name")}
            value={policy.name}
            required
            helperText={t("field_engineer_policy_name_helper")}
            error={submitted ? validationErrors.name : ""}
            onChangeText={(value) => updatePolicy("name", value)}
          />
          <TaskTypeSettingPicker
            label={t("field_engineer_policy_task_type")}
            value={policy.taskType}
            onChange={(value) => updatePolicy("taskType", value)}
          />
          <Text style={styles.helperText}>
            {t("field_engineer_policy_task_type_helper")}
          </Text>
          <CustomerSettingPicker
            label={t("field_engineer_policy_customer")}
            value={policy.customerID}
            displayLabel={policy.customerLabel}
            displayExtID={policy.customerExtID}
            onChange={({ value, label, extID }) => {
              setPolicy((currentPolicy) => {
                const customerChanged = value !== currentPolicy.customerID;

                return {
                  ...currentPolicy,
                  customerID: value,
                  customerLabel: label,
                  customerExtID: extID,
                  projectID: customerChanged ? "" : currentPolicy.projectID,
                  projectLabel: customerChanged ? "" : currentPolicy.projectLabel,
                  projectExtID: customerChanged ? "" : currentPolicy.projectExtID,
                };
              });
            }}
          />
          <Text style={styles.helperText}>
            {t("field_engineer_policy_customer_helper")}
          </Text>
          <ProjectSettingPicker
            label={t("field_engineer_policy_project")}
            value={policy.projectID}
            displayLabel={policy.projectLabel}
            displayExtID={policy.projectExtID}
            customerID={policy.customerID}
            onChange={({
              value,
              label,
              extID,
              customerID,
              customerLabel,
              customerExtID,
            }) => {
              setPolicy((currentPolicy) => ({
                ...currentPolicy,
                projectID: value,
                projectLabel: label,
                projectExtID: extID,
                customerID: customerID || currentPolicy.customerID,
                customerLabel: customerID
                  ? customerLabel
                  : currentPolicy.customerLabel,
                customerExtID: customerID
                  ? customerExtID
                  : currentPolicy.customerExtID,
              }));
            }}
          />
          <Text style={styles.helperText}>
            {t("field_engineer_policy_project_helper")}
          </Text>
          <ToggleRow
            label={t("field_engineer_default_policy")}
            value={policy.defaultPolicy}
            onValueChange={(value) => updatePolicy("defaultPolicy", value)}
            helperText={t("field_engineer_default_policy_helper")}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("field_engineer_policy_completion")}
          </Text>
          <FieldRow
            label={t("field_engineer_policy_sla_at_risk_hours")}
            value={policy.slaAtRiskHours}
            keyboardType="numeric"
            helperText={t("field_engineer_policy_sla_at_risk_hours_helper")}
            onChangeText={(value) => updatePolicy("slaAtRiskHours", value)}
          />
          <FieldRow
            label={t("field_engineer_policy_required_photo_count")}
            value={policy.requiredWorkPhotoCount}
            keyboardType="numeric"
            helperText={t("field_engineer_policy_required_photo_count_helper")}
            onChangeText={(value) =>
              updatePolicy("requiredWorkPhotoCount", value)
            }
          />
          <ToggleRow
            label={t("field_engineer_policy_checklist_required")}
            value={policy.checklistRequired}
            onValueChange={(value) => updatePolicy("checklistRequired", value)}
            helperText={t("field_engineer_policy_checklist_required_helper")}
          />
          <ToggleRow
            label={t("field_engineer_policy_review_required")}
            value={policy.customerReviewRequired}
            onValueChange={(value) =>
              updatePolicy("customerReviewRequired", value)
            }
            helperText={t("field_engineer_policy_review_required_helper")}
          />
          <ToggleRow
            label={t("field_engineer_policy_signoff_required")}
            value={policy.customerSignOffRequired}
            onValueChange={(value) =>
              updatePolicy("customerSignOffRequired", value)
            }
            helperText={t("field_engineer_policy_signoff_required_helper")}
          />
          <ToggleRow
            label={t("field_engineer_policy_allow_signoff_skip")}
            value={policy.allowSignOffSkip}
            onValueChange={(value) => updatePolicy("allowSignOffSkip", value)}
            helperText={t("field_engineer_policy_allow_signoff_skip_helper")}
          />
          <FieldRow
            label={t("field_engineer_policy_task_changed_since")}
            value={policy.taskChangedSince}
            placeholder={t("field_engineer_policy_task_cutoff_placeholder")}
            helperText={t("field_engineer_policy_task_changed_since_helper")}
            error={submitted ? validationErrors.taskChangedSince : ""}
            onChangeText={(value) => updatePolicy("taskChangedSince", value)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("field_engineer_policy_templates")}
          </Text>
          <ChecklistTemplateSettingPicker
            label={t("field_engineer_policy_checklist_template")}
            value={policy.checklistTemplateID}
            displayLabel={policy.checklistTemplateLabel}
            onChange={({ value, label }) => {
              setPolicy((currentPolicy) => ({
                ...currentPolicy,
                checklistTemplateID: value,
                checklistTemplateLabel: label,
              }));
            }}
          />
          <Text style={styles.helperText}>
            {t("field_engineer_policy_checklist_template_helper")}
          </Text>
          <ReviewTemplateSettingPicker
            label={t("field_engineer_policy_review_template")}
            value={policy.reviewTemplateID}
            displayLabel={policy.reviewTemplateLabel}
            onChange={({ value, label }) => {
              setPolicy((currentPolicy) => ({
                ...currentPolicy,
                reviewTemplateID: value,
                reviewTemplateLabel: label,
              }));
            }}
          />
          <Text style={styles.helperText}>
            {t("field_engineer_policy_review_template_helper")}
          </Text>
          <ListSettingPicker
            label={t("field_engineer_policy_skip_reason_list")}
            value={policy.skipReasonListID}
            onChange={(value) => updatePolicy("skipReasonListID", value)}
          />
          <Text style={styles.helperText}>
            {t("field_engineer_policy_skip_reason_list_helper")}
          </Text>
          <ListSettingPicker
            label={t("field_engineer_policy_blocked_reason_list")}
            value={policy.blockedReasonListID}
            onChange={(value) => updatePolicy("blockedReasonListID", value)}
          />
          <Text style={styles.helperText}>
            {t("field_engineer_policy_blocked_reason_list_helper")}
          </Text>
        </View>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f8fb",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 32,
    gap: 12,
  },
  headerLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "90%",
  },
  headerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  fieldRow: {
    gap: 6,
  },
  label: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "700",
  },
  requiredMark: {
    color: "#b42318",
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#111827",
    backgroundColor: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  inputError: {
    borderColor: "#b42318",
    backgroundColor: "#fffafa",
  },
  errorText: {
    color: "#b42318",
    fontSize: 12,
    fontWeight: "700",
  },
  helperText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  toggleRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLabel: {
    flex: 1,
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
});

export default FieldEngineerPolicyEdit;
