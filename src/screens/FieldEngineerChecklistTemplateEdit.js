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
  deleteFieldServiceChecklistTemplate,
  fetchFieldServiceChecklistTemplates,
  saveFieldServiceChecklistTemplate,
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

const createChecklistItem = (index) => ({
  itemID: `item-${index + 1}`,
  label: "",
  required: false,
  sequence: index + 1,
  helpText: "",
});

const normalizeChecklistItems = (items = []) =>
  items.map((item, index) => ({
    itemID: item.itemID || item.id || `item-${index + 1}`,
    subID: item.subID,
    label: item.label || "",
    required: toBoolean(item.required),
    sequence: item.sequence ?? index + 1,
    helpText: item.helpText || "",
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
    items: normalizeChecklistItems(template.items || []).map((item) => ({
      itemID: item.itemID,
      subID: item.subID,
      label: item.label,
      required: item.required,
      sequence: Number(item.sequence || 0),
      helpText: item.helpText,
    })),
  });

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

const FieldEngineerChecklistTemplateEdit = ({ navigation, route }) => {
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
      ? normalizeChecklistItems(existingTemplate.items)
      : [createChecklistItem(0)],
  });
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isNewTemplate = !existingTemplate?.id;
  const title = useMemo(
    () =>
      isNewTemplate
        ? t("field_engineer_new_checklist_template")
        : t("field_engineer_edit_checklist_template"),
    [isNewTemplate, t]
  );
  const hasUnsavedChanges = useMemo(() => {
    if (!initialTemplateRef.current) {
      return false;
    }

    return normalizeTemplateForComparison(template) !== initialTemplateRef.current;
  }, [template]);

  useEffect(() => {
    initialTemplateRef.current = normalizeTemplateForComparison({
      ...defaultTemplate,
      ...(existingTemplate || {}),
      defaultTemplate: toBoolean(existingTemplate?.defaultTemplate),
      items: existingTemplate?.items?.length
        ? normalizeChecklistItems(existingTemplate.items)
        : [createChecklistItem(0)],
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
    if (!existingTemplate?.id || saving) {
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
              await deleteFieldServiceChecklistTemplate({
                ...existingTemplate,
                extID: template.extID,
              });
              showToast(t("delete_success"));
              allowLeaveRef.current = true;
              navigation.goBack();
            } catch (error) {
              console.error("Error deleting checklist template:", error);
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

  const updateTemplate = (fieldName, value) => {
    setTemplate((currentTemplate) => ({
      ...currentTemplate,
      [fieldName]: value,
    }));
  };

  const updateItem = (index, fieldName, value) => {
    setTemplate((currentTemplate) => ({
      ...currentTemplate,
      items: currentTemplate.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [fieldName]: value } : item
      ),
    }));
  };

  const addItem = () => {
    setTemplate((currentTemplate) => ({
      ...currentTemplate,
      items: [
        ...currentTemplate.items,
        createChecklistItem(currentTemplate.items.length),
      ],
    }));
  };

  const removeItem = (index) => {
    setTemplate((currentTemplate) => ({
      ...currentTemplate,
      items: currentTemplate.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const validationErrors = useMemo(() => {
    const itemErrors = template.items.map((item) =>
      item.label.trim() ? "" : t("field_engineer_checklist_item_label_required")
    );

    return {
      extID: !template.extID.trim()
        ? t("field_engineer_checklist_template_id_required")
        : "",
      name: !template.name.trim()
        ? t("field_engineer_checklist_template_name_required")
        : "",
      items: itemErrors,
    };
  }, [template.extID, template.items, template.name, t]);

  const validateTemplate = () => {
    const validItems = template.items.filter((item) => item.label.trim());
    const firstError =
      validationErrors.extID ||
      validationErrors.name ||
      (!validItems.length
        ? t("field_engineer_checklist_template_item_required")
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

    const existingTemplates = await fetchFieldServiceChecklistTemplates({
      forceRefresh: true,
    });

    return existingTemplates.some(
      (existingItem) =>
        existingItem.id !== template.id &&
        toBoolean(existingItem.defaultTemplate) &&
        hasOverlappingTemplateScope(existingItem, template)
    );
  };

  const onSave = async () => {
    setSubmitted(true);

    if (saving || !validateTemplate()) {
      return;
    }

    setSaving(true);

    try {
      if (await hasDefaultTemplateConflict()) {
        showToast(t("field_engineer_default_checklist_conflict"), "warning");
        return;
      }

      await saveFieldServiceChecklistTemplate({
        ...template,
        originalItems: normalizeChecklistItems(existingTemplate?.items || []),
        items: template.items.map((item, index) => ({
          ...item,
          sequence: Number(item.sequence || index + 1),
        })),
      });
      showToast(t("field_engineer_checklist_template_saved"));
      allowLeaveRef.current = true;
      navigation.goBack();
    } catch (error) {
      console.error("Error saving checklist template:", error);
      showToast(t("field_engineer_checklist_template_save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const headerRight = useCallback(
    () => (
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerSaveButton}
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
            {t("field_engineer_checklist_template_identity")}
          </Text>
          <FieldRow
            label={t("field_engineer_checklist_template_id")}
            value={template.extID}
            required
            helperText={t("field_engineer_checklist_template_id_helper")}
            error={submitted ? validationErrors.extID : ""}
            onChangeText={(value) => updateTemplate("extID", value)}
            onFocus={() => scrollToField(0)}
          />
          <FieldRow
            label={t("field_engineer_checklist_template_name")}
            value={template.name}
            required
            helperText={t("field_engineer_checklist_template_name_helper")}
            error={submitted ? validationErrors.name : ""}
            onChangeText={(value) => updateTemplate("name", value)}
            onFocus={() => scrollToField(0)}
          />
          <FieldRow
            label={t("field_engineer_checklist_template_description")}
            value={template.description}
            multiline
            helperText={t("field_engineer_checklist_template_description_helper")}
            onChangeText={(value) => updateTemplate("description", value)}
            onFocus={() => scrollToField(80)}
          />
          <TaskTypeSettingPicker
            label={t("field_engineer_policy_task_type")}
            value={template.taskType}
            onChange={(value) => updateTemplate("taskType", value)}
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
            onValueChange={(value) =>
              updateTemplate("defaultTemplate", value)
            }
            helperText={t("field_engineer_default_template_helper")}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t("field_engineer_checklist_items")}
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={addItem}
              accessibilityRole="button"
              accessibilityLabel={t("field_engineer_add_checklist_item")}
            >
              <Ionicons name="add" size={18} color="#005eb8" />
              <Text style={styles.addButtonText}>
                {t("field_engineer_add_checklist_item")}
              </Text>
            </TouchableOpacity>
          </View>

          {template.items.map((item, index) => (
            <View
              key={`${item.itemID || "item"}-${index}`}
              style={styles.itemCard}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>
                  {t("field_engineer_checklist_item_number", {
                    number: index + 1,
                  })}
                </Text>
                {template.items.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeItem(index)}
                    accessibilityRole="button"
                    accessibilityLabel={t("delete")}
                  >
                    <Ionicons name="trash-outline" size={18} color="#b42318" />
                  </TouchableOpacity>
                )}
              </View>
              <FieldRow
                label={t("field_engineer_checklist_item_label")}
                value={item.label}
                required
                helperText={t("field_engineer_checklist_item_label_helper")}
                error={submitted ? validationErrors.items[index] : ""}
                onChangeText={(value) => updateItem(index, "label", value)}
                onFocus={() => scrollToField(470 + index * 330)}
              />
              <FieldRow
                label={t("field_engineer_checklist_item_sequence")}
                value={item.sequence}
                keyboardType="numeric"
                helperText={t("field_engineer_checklist_item_sequence_helper")}
                onChangeText={(value) => updateItem(index, "sequence", value)}
                onFocus={() => scrollToField(520 + index * 330)}
              />
              <FieldRow
                label={t("field_engineer_checklist_item_help_text")}
                value={item.helpText}
                helperText={t("field_engineer_checklist_item_help_text_helper")}
                onChangeText={(value) => updateItem(index, "helpText", value)}
                onFocus={() => scrollToField(575 + index * 330)}
              />
              <ToggleRow
                label={t("field_engineer_checklist_item_required")}
                value={item.required}
                onValueChange={(value) => updateItem(index, "required", value)}
                helperText={t("field_engineer_checklist_item_required_helper")}
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
  headerSaveButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
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
  multilineInput: {
    minHeight: 76,
    paddingTop: 10,
    paddingBottom: 10,
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
  addButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b8d4f0",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
  },
  addButtonText: {
    color: "#005eb8",
    fontSize: 13,
    fontWeight: "800",
  },
  itemCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1f0",
  },
});

export default FieldEngineerChecklistTemplateEdit;
