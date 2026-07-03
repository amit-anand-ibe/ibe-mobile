const fieldServiceReviewOverrides = {
  // Optional future scopes:
  // users: { "<userId>": { reviewItems: [] } },
  // persons: { "<personId>": { reviewItems: [] } },
  // clients: { "<clientId>": { reviewItems: [] } },
  1331: {
    relatedObjects: {
      project: {
        busObjCat: "ProjectWBS",
        source: {
          path: "Task-projectWbsID",
        },
        fields: [
          "ProjectWBS-id",
          "ProjectWBS-extID",
          "ProjectWBS-text-text",
          "ProjectWBS-jobCardID",
          "ProjectWBS-links",
          "ProjectWBS-customFieldsMap",
        ],
      },
      opportunity: {
        busObjCat: "Opportunity",
        source: {
          type: "linkedObject",
          paths: [
            "related.project.ProjectWBS-links",
            "related.project.links",
            "Task-projectWbsID:ProjectWBS-links",
          ],
          busObjCat: "Opportunity",
          idField: "iD",
        },
        fields: [
          "Opportunity-id",
          "Opportunity-extID",
          "Opportunity-name",
          "Opportunity-text",
          "Opportunity-text-text",
          "Opportunity-purchaseOrder",
          "Opportunity-customFieldsMap",
          "Opportunity-cf_machineType",
          "Opportunity-customFieldsMap.cf_machineType",
          "Opportunity-cf_CAD",
          "Opportunity-customFieldsMap.cf_CAD",
          "Opportunity-cf_calVersion",
          "Opportunity-customFieldsMap.cf_calVersion",
          "Opportunity-cf_sensorType",
          "Opportunity-customFieldsMap.cf_sensorType",
          "Opportunity-cf_workScope",
          "Opportunity-customFieldsMap.cf_workScope",
          "Opportunity-cf_addtnl_info",
          "Opportunity-customFieldsMap.cf_addtnl_info",
          "Opportunity-cf_print",
          "Opportunity-customFieldsMap.cf_print",
          "Opportunity-cf_timing",
          "Opportunity-customFieldsMap.cf_timing",
          "Opportunity-cf_deliverbales",
          "Opportunity-customFieldsMap.cf_deliverbales",
          "Opportunity-cf_partsRequired",
          "Opportunity-customFieldsMap.cf_partsRequired",
          "Opportunity-cf_custPart",
          "Opportunity-customFieldsMap.cf_custPart",
        ],
      },
    },
    reviewItems: [
      {
        id: "client-1331-sow",
        title: "Scope of Work",
        contentType: "rich text",
        required: true,
        type: "fieldGroup",
        fields: [
          {
            label: "CAD Required",
            paths: [
              "related.opportunity.Opportunity-cf_CAD",
              "related.opportunity.Opportunity-customFieldsMap.cf_CAD",
              "related.opportunity.cf_CAD",
            ],
          },
          {
            label: "Print Required",
            paths: [
              "related.opportunity.Opportunity-cf_print",
              "related.opportunity.Opportunity-customFieldsMap.cf_print",
              "related.opportunity.cf_print",
            ],
          },
          {
            label: "Parts Required",
            paths: [
              "related.opportunity.Opportunity-cf_partsRequired",
              "related.opportunity.Opportunity-customFieldsMap.cf_partsRequired",
              "related.opportunity.cf_partsRequired",
            ],
          },
          {
            label: "Cust. Part #",
            paths: [
              "related.opportunity.Opportunity-cf_custPart",
              "related.opportunity.Opportunity-customFieldsMap.cf_custPart",
              "related.opportunity.cf_custPart",
            ],
          },
          {
            label: "Machine Type",
            paths: [
              "related.opportunity.Opportunity-cf_machineType",
              "related.opportunity.Opportunity-customFieldsMap.cf_machineType",
              "related.opportunity.cf_machineType",
            ],
          },
          {
            label: "Calypso Version",
            paths: [
              "related.opportunity.Opportunity-cf_calVersion",
              "related.opportunity.Opportunity-customFieldsMap.cf_calVersion",
              "related.opportunity.cf_calVersion",
            ],
          },
          {
            label: "Sensor Type",
            paths: [
              "related.opportunity.Opportunity-cf_sensorType",
              "related.opportunity.Opportunity-customFieldsMap.cf_sensorType",
              "related.opportunity.cf_sensorType",
            ],
          },
          {
            label: "Scope Of Work",
            preserveHtml: true,
            paths: [
              "related.opportunity.Opportunity-cf_workScope",
              "related.opportunity.Opportunity-customFieldsMap.cf_workScope",
              "related.opportunity.cf_workScope",
            ],
          },
          {
            label: "Deliverables",
            preserveHtml: true,
            paths: [
              "related.opportunity.Opportunity-cf_deliverbales",
              "related.opportunity.Opportunity-customFieldsMap.cf_deliverbales",
              "related.opportunity.cf_deliverbales",
            ],
          },
          {
            label: "Exclusions, Additional Info & Notes",
            preserveHtml: true,
            paths: [
              "related.opportunity.Opportunity-cf_addtnl_info",
              "related.opportunity.Opportunity-customFieldsMap.cf_addtnl_info",
              "related.opportunity.cf_addtnl_info",
            ],
          },
          {
            label: "Timing for Quote",
            preserveHtml: true,
            paths: [
              "related.opportunity.Opportunity-cf_timing",
              "related.opportunity.Opportunity-customFieldsMap.cf_timing",
              "related.opportunity.cf_timing",
            ],
          },
        ],
      },
      {
        id: "client-1331-job-card",
        title: "Job Card",
        contentType: "document",
        required: true,
        type: "resource",
        resourcePaths: [
          "related.project.ProjectWBS-jobCardID",
          "related.project.jobCardID",
          "Task-projectWbsID:ProjectWBS-jobCardID",
        ],
      },
    ],
  },
};

export default fieldServiceReviewOverrides;
