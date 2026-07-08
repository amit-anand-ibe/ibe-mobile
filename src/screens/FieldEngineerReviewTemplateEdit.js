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
import ScreenHeader from "../components/ScreenHeader";
import {
  CustomerSettingPicker,
  ProjectSettingPicker,
  TaskTypeSettingPicker,
} from "../components/FieldServiceSettingPickers";
import { showToast } from "../utils/MessageUtils";
import {
  deleteFieldServiceReviewTemplate,
  fetchFieldServiceReviewTemplates,
  saveFieldServiceReviewTemplate,
} from "../utils/FieldEngineerUtils";

const defaultTemplate = {
  id: "",
  extID: "",
  name: "",
  description: "",
  taskType: "",
  customerID: "",
  customerLabel: "",
  customerExtID: "",
  projectID: "",
  projectLabel: "",
  projectExtID: "",
  defaultTemplate: false,
  items: [],
};

const createReviewItem = (index) => ({
  itemID: `item-${index + 1}`,
  title: "",
  contentType: "document",
  sourcePath: "",
  required: false,
  sequence: index + 1,
  resourceID: "",
  url: "",
  htmlContent: "",
});

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
  }
  return false;
};

const normalizeReviewItems = (items = []) =>
  items.map((item, index) => ({
    itemID: item.itemID || item.id || `item-${index + 1}`,
    subID: item.subID,
    title: item.title || item.label || item.name || "",
    contentType: item.contentType || item.documentType || item.type || "document",
    sourcePath: Array.isArray(item.sourcePath || item.sourcePaths)
      ? (item.sourcePath || item.sourcePaths).join("\n")
      : item.sourcePath || item.sourcePaths || "",
    required: toBoolean(item.required),
    sequence: item.sequence ?? index + 1,
    resourceID: item.resourceID || item.resourceId || "",
    url: item.url || "",
    htmlContent: item.htmlContent || item.content || item.html || "",
  }));

const normalizeTemplateForComparison = (template = {}) =>
  JSON.stringify({
    extID: (template.extID || "").trim(),
    name: (template.name || "").trim(),
    description: template.description || "",
    taskType: template.taskType || "",
    customerID: template.customerID || "",
    projectID: template.projectID || "",
    defaultTemplate: toBoolean(template.defaultTemplate),
    items: normalizeReviewItems(template.items || []).map((item) => ({
      itemID: item.itemID,
      subID: item.subID,
      title: item.title,
      contentType: item.contentType,
      sourcePath: item.sourcePath,
      required: item.required,
      sequence: Number(item.sequence || 0),
      resourceID: item.resourceID,
      url: item.url,
      htmlContent: item.htmlContent,
    })),
  });

const getTemplateScope = (template = {}) => ({
  taskType: (template.taskType || "").trim().toLowerCase(),
  customerID: template.customerID || "",
  projectID: template.projectID || "",
});

const hasOverlappingTemplateScope = (firstTemplate = {}, secondTemplate = {}) => {
  const firstScope = getTemplateScope(firstTemplate);
  const secondScope = getTemplateScope(secondTemplate);

  return Object.keys(firstScope).every((scopeKey) => {
    const firstValue = firstScope[scopeKey];
    const secondValue = secondScope[scopeKey];
    return !firstValue || !secondValue || firstValue === secondValue;
  });
};

const FieldRow = ({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType = "default",
  required = false,
  error = "",
  helperText = "",
  onFocus,
}) => (
  <View style={styles.fieldRow}>
    <Text style={styles.label}>
      {label}
      {required && <Text style={styles.requiredMark}> *</Text>}
    </Text>
    <TextInput
      style={[
        styles.input,
        multiline && styles.multilineInput,
        !!error && styles.inputError,
      ]}
      value={String(value ?? "")}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      multiline={multiline}
      onFocus={onFocus}
      textAlignVertical={multiline ? "top" : "center"}
      placeholderTextColor="#8a94a6"
    />
    {!!error && <Text style={styles.errorText}>{error}</Text>}
    {!error && !!helperText && <Text style={styles.helperText}>{helperText}</Text>}
  </View>
);

const ToggleRow = ({ label, value, onValueChange, helperText = "" }) => (
  <View>
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={!!value} onValueChange={onValueChange} />
    </View>
    {!!helperText && <Text style={styles.helperText}>{helperText}</Text>}
  </View>
);

const FieldEngineerReviewTemplateEdit = ({ navigation, route }) => {
  const { t } = useTranslation();
  const existingTemplate = route?.params?.template || null;
  const scrollViewRef = useRef(null);
  const initialTemplateRef = useRef(null);
  const allowLeaveRef = useRef(false);
  const [template, setTemplate] = useState({
    ...defaultTemplate,
    ...(existingTemplate || {}),
    defaultTemplate: toBoolean(existingTemplate?.defaultTemplate),
    items: existingTemplate?.items?.length
      ? normalizeReviewItems(existingTemplate.items)
      : [createReviewItem(0)],
  });
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isNewTemplate = !existingTemplate?.id;
  const title = useMemo(
    () =>
      isNewTemplate
        ? t("field_engineer_new_review_template")
        : t("field_engineer_edit_review_template"),
    [isNewTemplate, t]
  );
  const hasUnsavedChanges = useMemo(() => {
    if (!initialTemplateRef.current) return false;
    return normalizeTemplateForComparison(template) !== initialTemplateRef.current;
  }, [template]);

  useEffect(() => {
    initialTemplateRef.current = normalizeTemplateForComparison({
      ...defaultTemplate,
      ...(existingTemplate || {}),
      defaultTemplate: toBoolean(existingTemplate?.defaultTemplate),
      items: existingTemplate?.items?.length
        ? normalizeReviewItems(existingTemplate.items)
        : [createReviewItem(0)],
    });
  }, [existingTemplate]);

  const scrollToField = useCallback((yPosition) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, yPosition),
        animated: true,
      });
    }, 120);
  }, []);

  const handleDelete = useCallback(() => {
    if (!existingTemplate?.id || saving) return;

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
              await deleteFieldServiceReviewTemplate({
                ...existingTemplate,
                extID: template.extID,
              });
              showToast(t("delete_success"));
              allowLeaveRef.current = true;
              navigation.goBack();
            } catch (error) {
              console.error("Error deleting review template:", error);
              showToast(t("delete_failure"), "error");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [existingTemplate, navigation, saving, t, template.extID]);

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

  const updateTemplate = (updates) =>
    setTemplate((current) => ({ ...current, ...updates }));

  const updateItem = (index, updates) =>
    setTemplate((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...updates } : item
      ),
    }));

  const addItem = () =>
    setTemplate((current) => ({
      ...current,
      items: [...current.items, createReviewItem(current.items.length)],
    }));

  const removeItem = (index) =>
    setTemplate((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));

  const validationErrors = useMemo(() => ({
    extID: !template.extID.trim()
      ? t("field_engineer_review_template_id_required")
      : "",
    name: !template.name.trim()
      ? t("field_engineer_review_template_name_required")
      : "",
    items: template.items.map((item) =>
      item.title.trim() ? "" : t("field_engineer_review_item_title_required")
    ),
  }), [template.extID, template.items, template.name, t]);

  const validateTemplate = () => {
    const validItems = template.items.filter((item) => item.title.trim());
    const firstError =
      validationErrors.extID ||
      validationErrors.name ||
      (!validItems.length
        ? t("field_engineer_review_template_item_required")
        : "");

    if (firstError) {
      showToast(firstError, "warning");
      return false;
    }

    return true;
  };

  const hasDefaultTemplateConflict = async () => {
    if (!template.defaultTemplate) {
      return false;
    }

    const templates = await fetchFieldServiceReviewTemplates({
      forceRefresh: true,
    });

    return templates.some(
      (item) =>
        item.id !== template.id &&
        toBoolean(item.defaultTemplate) &&
        hasOverlappingTemplateScope(item, template)
    );
  };

  const onSave = async () => {
    setSubmitted(true);

    if (saving || !validateTemplate()) {
      return;
    }

    try {
      setSaving(true);

      if (await hasDefaultTemplateConflict()) {
        showToast(t("field_engineer_default_review_conflict"), "warning");
        return;
      }

      await saveFieldServiceReviewTemplate({
        ...template,
        extID: template.extID.trim(),
        name: template.name.trim(),
        originalItems: normalizeReviewItems(existingTemplate?.items || []),
        items: template.items.map((item, index) => ({
          ...item,
          sequence: Number(item.sequence || index + 1),
        })),
      });
      showToast(t("field_engineer_review_template_saved"));
      allowLeaveRef.current = true;
      navigation.goBack();
    } catch (error) {
      console.error("Error saving review template:", error);
      showToast(t("field_engineer_review_template_save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const headerRight = useCallback(
    () => (
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerIconButton}
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
        {!isNewTemplate && (
          <TouchableOpacity
            style={styles.headerIconButton}
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
    [handleDelete, isNewTemplate, onSave, saving, t]
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
      if (!hasUnsavedChanges || allowLeaveRef.current) return;

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

  const errors = submitted
    ? {
        extID: validationErrors.extID,
        name: validationErrors.name,
        items: template.items.some((item) => item.title.trim())
          ? ""
          : t("field_engineer_review_template_item_required"),
        itemTitles: validationErrors.items,
      }
    : {};

  return (
    <View style={styles.container}>
      <ScreenHeader left={headerLeft()} right={headerRight()} />
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("field_engineer_review_template_identity")}
          </Text>
          <FieldRow
            label={t("field_engineer_review_template_id")}
            value={template.extID}
            onChangeText={(value) => updateTemplate({ extID: value })}
            required={true}
            error={errors.extID}
            helperText={t("field_engineer_review_template_id_helper")}
            onFocus={() => scrollToField(0)}
          />
          <FieldRow
            label={t("field_engineer_review_template_name")}
            value={template.name}
            onChangeText={(value) => updateTemplate({ name: value })}
            required={true}
            helperText={t("field_engineer_review_template_name_helper")}
            error={errors.name}
            onFocus={() => scrollToField(0)}
          />
          <FieldRow
            label={t("field_engineer_review_template_description")}
            value={template.description}
            onChangeText={(value) => updateTemplate({ description: value })}
            multiline={true}
            helperText={t("field_engineer_review_template_description_helper")}
            onFocus={() => scrollToField(80)}
          />
        </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("field_engineer_policy_scope")}
            </Text>
            <TaskTypeSettingPicker
              label={t("field_engineer_policy_task_type")}
              value={template.taskType}
              displayLabel={template.taskType}
              onChange={(value) => updateTemplate({ taskType: value })}
            />
            <Text style={styles.helperText}>
              {t("field_engineer_template_task_type_helper")}
            </Text>
            <CustomerSettingPicker
              label={t("field_engineer_policy_customer")}
              value={template.customerID}
              displayLabel={template.customerLabel}
              displayExtID={template.customerExtID}
              onChange={({ value, label, extID }) => {
                setTemplate((currentTemplate) => {
                  const customerChanged = value !== currentTemplate.customerID;

                  return {
                    ...currentTemplate,
                    customerID: value,
                    customerLabel: label,
                    customerExtID: extID,
                    projectID: customerChanged ? "" : currentTemplate.projectID,
                    projectLabel: customerChanged
                      ? ""
                      : currentTemplate.projectLabel,
                    projectExtID: customerChanged
                      ? ""
                      : currentTemplate.projectExtID,
                  };
                });
              }}
            />
            <Text style={styles.helperText}>
              {t("field_engineer_template_customer_helper")}
            </Text>
            <ProjectSettingPicker
              label={t("field_engineer_policy_project")}
              value={template.projectID}
              displayLabel={template.projectLabel}
              displayExtID={template.projectExtID}
              customerID={template.customerID}
              onChange={({
                value,
                label,
                extID,
                customerID,
                customerLabel,
                customerExtID,
              }) => {
                setTemplate((currentTemplate) => ({
                  ...currentTemplate,
                  projectID: value,
                  projectLabel: label,
                  projectExtID: extID,
                  customerID: customerID || currentTemplate.customerID,
                  customerLabel: customerID
                    ? customerLabel
                    : currentTemplate.customerLabel,
                  customerExtID: customerID
                    ? customerExtID
                    : currentTemplate.customerExtID,
                }));
              }}
            />
            <Text style={styles.helperText}>
              {t("field_engineer_template_project_helper")}
            </Text>
            <ToggleRow
              label={t("field_engineer_default_template")}
              value={template.defaultTemplate}
              onValueChange={(value) => updateTemplate({ defaultTemplate: value })}
              helperText={t("field_engineer_default_template_helper")}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleNoMargin}>
                {t("field_engineer_review_items")}
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={addItem}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={18} color="#005eb8" />
                <Text style={styles.addButtonText}>
                  {t("field_engineer_add_review_item")}
                </Text>
              </TouchableOpacity>
            </View>
            {!!errors.items && <Text style={styles.errorText}>{errors.items}</Text>}
            {template.items.map((item, index) => (
              <View key={`${item.itemID}-${index}`} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>
                    {t("field_engineer_review_item_number", {
                      number: index + 1,
                    })}
                  </Text>
                  {template.items.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeItem(index)}
                      accessibilityRole="button"
                    >
                      <Ionicons name="trash-outline" size={20} color="#b42318" />
                    </TouchableOpacity>
                  )}
                </View>
                <FieldRow
                  label={t("field_engineer_review_item_title")}
                  value={item.title}
                  onChangeText={(value) => updateItem(index, { title: value })}
                  required={true}
                  helperText={t("field_engineer_review_item_title_helper")}
                  error={errors.itemTitles?.[index] || ""}
                  onFocus={() => scrollToField(520 + index * 560)}
                />
                <FieldRow
                  label={t("field_engineer_review_item_type")}
                  value={item.contentType}
                  onChangeText={(value) =>
                    updateItem(index, { contentType: value })
                  }
                  helperText={t("field_engineer_review_item_type_helper")}
                  onFocus={() => scrollToField(580 + index * 560)}
                />
                <FieldRow
                  label={t("field_engineer_review_item_resource")}
                  value={item.resourceID}
                  onChangeText={(value) =>
                    updateItem(index, { resourceID: value })
                  }
                  helperText={t("field_engineer_review_item_resource_helper")}
                  onFocus={() => scrollToField(640 + index * 560)}
                />
                <FieldRow
                  label={t("field_engineer_review_item_source_path")}
                  value={item.sourcePath}
                  onChangeText={(value) =>
                    updateItem(index, { sourcePath: value })
                  }
                  helperText={t("field_engineer_review_item_source_path_helper")}
                  multiline={true}
                  onFocus={() => scrollToField(700 + index * 560)}
                />
                <FieldRow
                  label={t("field_engineer_review_item_url")}
                  value={item.url}
                  onChangeText={(value) => updateItem(index, { url: value })}
                  helperText={t("field_engineer_review_item_url_helper")}
                  onFocus={() => scrollToField(790 + index * 560)}
                />
                <FieldRow
                  label={t("field_engineer_review_item_content")}
                  value={item.htmlContent}
                  onChangeText={(value) =>
                    updateItem(index, { htmlContent: value })
                  }
                  multiline={true}
                  helperText={t("field_engineer_review_item_content_helper")}
                  onFocus={() => scrollToField(850 + index * 560)}
                />
                <FieldRow
                  label={t("field_engineer_review_item_sequence")}
                  value={item.sequence}
                  keyboardType="number-pad"
                  onChangeText={(value) =>
                    updateItem(index, { sequence: value.replace(/[^0-9]/g, "") })
                  }
                  helperText={t("field_engineer_review_item_sequence_helper")}
                  onFocus={() => scrollToField(950 + index * 560)}
                />
                <ToggleRow
                  label={t("field_engineer_review_item_required")}
                  value={item.required}
                  onValueChange={(value) => updateItem(index, { required: value })}
                  helperText={t("field_engineer_review_item_required_helper")}
                />
              </View>
            ))}
          </View>
      </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f8fb" },
  keyboardAvoidingView: { flex: 1 },
  content: { padding: 14, paddingBottom: 32, gap: 12 },
  headerLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "78%",
  },
  headerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 4,
  },
  headerActions: { flexDirection: "row", alignItems: "center" },
  headerIconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    padding: 14,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  sectionTitleNoMargin: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  fieldRow: { marginBottom: 12 },
  label: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  requiredMark: { color: "#b42318" },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#111827",
    backgroundColor: "#fff",
  },
  multilineInput: { minHeight: 86, paddingTop: 10 },
  inputError: { borderColor: "#b42318" },
  errorText: {
    color: "#b42318",
    fontSize: 12,
    marginTop: 5,
    fontWeight: "600",
  },
  helperText: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
  },
  toggleRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    paddingRight: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  addButtonText: {
    color: "#005eb8",
    fontWeight: "700",
    fontSize: 13,
  },
  itemCard: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 12,
    marginTop: 8,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
});

export default FieldEngineerReviewTemplateEdit;
