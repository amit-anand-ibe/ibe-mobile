import React, { useMemo } from "react";

import { APP, INTSTATUS, TEST_MODE } from "../constants";
import CustomRemotePicker from "./CustomRemotePicker";

const getCommonQueryParams = () => ({
  userID: APP.LOGIN_USER_ID,
  client: parseInt(APP.LOGIN_USER_CLIENT, 10),
  language: APP.LOGIN_USER_LANGUAGE,
  testMode: TEST_MODE,
  intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
  page: 1,
  start: 0,
  limit: 20,
});

const taskTypeQueryFields = {
  fields: [
    "TaskType-id",
    "TaskType-extID",
    "TaskType-text",
    "TaskType-text-text",
  ],
  sort: [{ property: "TaskType-extID", direction: "ASC" }],
};

const customerQueryFields = {
  fields: [
    "Customer-id",
    "Customer-extID",
    "Customer-name",
    "Customer-name-text",
  ],
  sort: [
    { property: "Customer-name-text", direction: "ASC" },
    { property: "Customer-extID", direction: "ASC" },
  ],
};

const checklistTemplateQueryFields = {
  fields: [
    "FieldServiceChecklistTemplate-id",
    "FieldServiceChecklistTemplate-extID",
    "FieldServiceChecklistTemplate-name",
  ],
  sort: [{ property: "FieldServiceChecklistTemplate-name", direction: "ASC" }],
};

const reviewTemplateQueryFields = {
  fields: [
    "FieldServiceReviewTemplate-id",
    "FieldServiceReviewTemplate-extID",
    "FieldServiceReviewTemplate-name",
  ],
  sort: [{ property: "FieldServiceReviewTemplate-name", direction: "ASC" }],
};

const listQueryFields = {
  fields: [
    "Lists-id",
    "Lists-extID",
    "Lists-text",
    "Lists-text-text",
  ],
  where: [
    {
      fieldName: "Lists-extID",
      operator: "contains",
      value: "FieldService",
    },
  ],
  sort: [{ property: "Lists-extID", direction: "ASC" }],
};

const getListQueryFields = (listExtID = "") => ({
  ...listQueryFields,
  where: listExtID
    ? [
        {
          fieldName: "Lists-extID",
          operator: "=",
          value: listExtID,
        },
      ]
    : listQueryFields.where,
});

const getProjectQueryFields = (customerID) => {
  const queryFields = {
    fields: [
      "ProjectWBS-id",
      "ProjectWBS-extID",
      "ProjectWBS-text",
      "ProjectWBS-text-text",
      "ProjectWBS-customerID",
      "ProjectWBS-customerID:Customer-extID",
      "ProjectWBS-customerID:Customer-name-text",
    ],
    sort: [
      { property: "ProjectWBS-text-text", direction: "ASC" },
      { property: "ProjectWBS-extID", direction: "ASC" },
    ],
  };

  if (customerID) {
    queryFields.where = [
      {
        fieldName: "ProjectWBS-customerID",
        operator: "=",
        value: customerID,
      },
    ];
  }

  return queryFields;
};

const RemoteSettingPicker = ({
  label,
  queryFields,
  initialAdditionalLabel = "",
  initialItemLabel = "",
  initialItemValue = "",
  labelItemField,
  valueItemField,
  additionalFields = [],
  searchFields = [],
  onValueChange,
}) => (
  <CustomRemotePicker
    queryParams={{
      queryFields,
      commonQueryParams: getCommonQueryParams(),
    }}
    pickerLabel={label}
    initialAdditionalLabel={initialAdditionalLabel}
    initialItemLabel={initialItemLabel}
    initialItemValue={initialItemValue}
    labelItemField={labelItemField}
    valueItemField={valueItemField}
    additionalFields={additionalFields}
    searchFields={searchFields}
    serverSearchEnabled={false}
    multiline
    onValueChange={onValueChange}
  />
);

export const TaskTypeSettingPicker = ({ label, value, onChange }) => (
  <RemoteSettingPicker
    label={label}
    queryFields={taskTypeQueryFields}
    initialAdditionalLabel={value}
    initialItemLabel={value}
    initialItemValue={value}
    labelItemField="TaskType-extID"
    valueItemField="TaskType-extID"
    additionalFields={[{ extID: "TaskType-extID" }]}
    searchFields={["TaskType-extID", "TaskType-text-text"]}
    onValueChange={({ value: selectedValue }) => onChange(selectedValue || "")}
  />
);

export const CustomerSettingPicker = ({
  label,
  value,
  displayLabel,
  displayExtID,
  onChange,
}) => (
  <RemoteSettingPicker
    label={label}
    queryFields={customerQueryFields}
    initialAdditionalLabel={displayExtID || ""}
    initialItemLabel={displayLabel || value || ""}
    initialItemValue={value}
    labelItemField="Customer-name-text"
    valueItemField="Customer-id"
    additionalFields={[{ extID: "Customer-extID" }]}
    searchFields={["Customer-name-text", "Customer-extID"]}
    onValueChange={({ value: selectedValue, label: selectedLabel, additionalData }) =>
      onChange({
        value: selectedValue || "",
        label: selectedLabel || "",
        extID: additionalData?.extID || "",
      })
    }
  />
);

export const ProjectSettingPicker = ({
  label,
  value,
  displayLabel,
  displayExtID,
  customerID,
  onChange,
}) => {
  const projectQueryFields = useMemo(
    () => getProjectQueryFields(customerID),
    [customerID]
  );

  return (
    <RemoteSettingPicker
      label={label}
      queryFields={projectQueryFields}
      initialAdditionalLabel={displayExtID || ""}
      initialItemLabel={displayLabel || value || ""}
      initialItemValue={value}
      labelItemField="ProjectWBS-text-text"
      valueItemField="ProjectWBS-id"
      additionalFields={[
        { extID: "ProjectWBS-extID" },
        { projectCustomerId: "ProjectWBS-customerID" },
        { projectCustomerExtId: "ProjectWBS-customerID:Customer-extID" },
        { projectCustomerText: "ProjectWBS-customerID:Customer-name-text" },
      ]}
      searchFields={["ProjectWBS-text-text", "ProjectWBS-extID"]}
      onValueChange={({ value: selectedValue, label: selectedLabel, additionalData }) =>
        onChange({
          value: selectedValue || "",
          label: selectedLabel || "",
          extID: additionalData?.extID || "",
          customerID: additionalData?.projectCustomerId || "",
          customerLabel: additionalData?.projectCustomerText || "",
          customerExtID: additionalData?.projectCustomerExtId || "",
        })
      }
    />
  );
};

export const ChecklistTemplateSettingPicker = ({
  label,
  value,
  displayLabel,
  onChange,
}) => (
  <RemoteSettingPicker
    label={label}
    queryFields={checklistTemplateQueryFields}
    initialAdditionalLabel={value}
    initialItemLabel={displayLabel || value || ""}
    initialItemValue={value}
    labelItemField="FieldServiceChecklistTemplate-name"
    valueItemField="FieldServiceChecklistTemplate-extID"
    additionalFields={[{ extID: "FieldServiceChecklistTemplate-extID" }]}
    searchFields={[
      "FieldServiceChecklistTemplate-name",
      "FieldServiceChecklistTemplate-extID",
    ]}
    onValueChange={({ value: selectedValue, label: selectedLabel }) =>
      onChange({
        value: selectedValue || "",
        label: selectedLabel || "",
      })
    }
  />
);

export const ReviewTemplateSettingPicker = ({
  label,
  value,
  displayLabel,
  onChange,
}) => (
  <RemoteSettingPicker
    label={label}
    queryFields={reviewTemplateQueryFields}
    initialAdditionalLabel={value}
    initialItemLabel={displayLabel || value || ""}
    initialItemValue={value}
    labelItemField="FieldServiceReviewTemplate-name"
    valueItemField="FieldServiceReviewTemplate-extID"
    additionalFields={[{ extID: "FieldServiceReviewTemplate-extID" }]}
    searchFields={[
      "FieldServiceReviewTemplate-name",
      "FieldServiceReviewTemplate-extID",
    ]}
    onValueChange={({ value: selectedValue, label: selectedLabel }) =>
      onChange({
        value: selectedValue || "",
        label: selectedLabel || "",
      })
    }
  />
);

export const ListSettingPicker = ({
  label,
  value,
  onChange,
  listExtID = "",
}) => (
  <RemoteSettingPicker
    label={label}
    queryFields={getListQueryFields(listExtID)}
    initialAdditionalLabel=""
    initialItemLabel={value || listExtID}
    initialItemValue={value || listExtID}
    labelItemField="Lists-extID"
    valueItemField="Lists-extID"
    additionalFields={[]}
    searchFields={["Lists-extID", "Lists-text-text"]}
    onValueChange={({ value: selectedValue }) => onChange(selectedValue || "")}
  />
);
