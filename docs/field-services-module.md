# Field Services Module

This document is a shared reference for testers, developers, and business analysts working with the mobile Field Services, displayed as Jobs in the app.

## Purpose

Field Services is a personal work execution module for field users. It helps a user see assigned work, review customer and assignment information, capture execution evidence, collect customer acknowledgement, and complete jobs from the mobile app.

## Access

Access is controlled from the logged-in user's `accessRoles` value.

| Role | Behavior |
| --- | --- |
| `FieldServices` | Shows the Jobs card and allows the user to work with assigned jobs. |
| `FieldServicesAdmin` | Shows the Jobs card and the Job Settings menu. Admin access implies normal Field Services access. |

The app checks `accessRoles` / `User-accessRoles`. It does not use `User-access`, because that field is a boolean.

## Main Screens

### Home

The Home screen shows the Jobs card only when the user has Field Services access. The card count is hidden until job data finishes loading, so users do not briefly see an incorrect zero count.

### Jobs Dashboard

The dashboard gives a high-level work summary:

- Assigned count
- In Progress count
- Completed count
- Quick actions: View All Assignments, Start Next Assignment, Open Map
- Active Assignments needing attention

Active Assignments are assigned or in-progress jobs that still require action. They are ordered by urgency, with breached and at-risk SLA work first.

### Assignment List

The full list screen supports:

- Status filters
- Priority filters
- SLA status filters
- Customer filtering
- Date range filtering
- Sorting by target completion date, priority, or recently updated
- Search by job/task description

Header counts reflect the filtered result set.

### Job Detail

The Job Detail screen is the main execution workspace. It displays:

- Job summary and status
- SLA status and target completion
- Customer information
- Customer review items
- Checklist
- Work photos
- Customer sign-off
- Status progression
- Status history
- Additional information

## My Tasks Rule

A task belongs to the current user's Field Services work if the logged-in person is linked to the task by one of these relationships:

- `Task-responsible`
- `Task-assigned`
- `Task-extStatus-recipient`
- `Task-extStatus-recipientList`

Only active tasks are shown.

## Status Classification

The app derives status from task execution fields, not Kanban status.

| Status | Rule |
| --- | --- |
| Completed | `actualFinish` is populated, or `percentComplete >= 100` |
| In Progress | `actualStart` is populated, `actualFinish` is empty, and `percentComplete > 0` |
| Assigned | `actualStart` and `actualFinish` are empty, and `percentComplete == 0` |

## SLA Rules

SLA status is derived from the target completion date.

| SLA Status | Rule |
| --- | --- |
| Breached | Current date/time is after target completion. |
| At Risk | Target completion is within the configured at-risk window. |
| On Track | Target completion is outside the at-risk window. |

The default at-risk window is four hours unless overridden by policy.

## Execution Workflow

Supported workflow statuses:

- Assigned
- En Route
- Arrived Onsite
- Work Started
- Blocked
- Completed

Users cannot skip required workflow steps:

Assigned -> En Route -> Arrived Onsite -> Work Started -> Completed

Blocked can be selected from active stages and requires a reason.

Each status update records:

- Previous status
- New status
- Timestamp
- GPS coordinates when available
- User/person who recorded the change
- Reason when applicable

## Completion Validation

The app prevents completion until configured requirements are met:

- Required checklist items completed
- Required work photos captured/uploaded
- Required customer review acknowledgement completed
- Required customer sign-off captured or skipped with a reason
- Current status allows completion

Once sign-off is captured or skipped, earlier evidence such as checklist and photos is locked to preserve what the customer acknowledged.

## Customer Information

Customer information is derived from `Task-customerID -> Customer`.

Displayed information includes:

- Customer name
- Customer address
- Primary contact name
- Contact job title
- Contact email
- Contact phone

If the customer has `primaryContact`, that person is used as the default contact. Customer address navigation prefers coordinates when available, then location/address details.

## Customer Review

Customer Review is separate from Customer Sign-Off. It is intended for information the customer should review before acknowledgement, such as scope, job card, work instructions, or safety information.

Review items can come from:

- `FieldServiceReviewTemplate` records
- Client-specific mobile overrides in `src/config/fieldServiceReviewOverrides.js`

The template model is generic. It supports configured review items without hardcoding document labels in the main UI. The current mobile override file exists for client-specific sources that are not yet modeled consistently in backend configuration.

Supported review item styles include:

- Rich text / field group content
- Resource/document references, such as PDF attachments

## Job Settings

Job Settings are visible only for users with `FieldServicesAdmin`.

Settings include:

- Policies
- Checklist templates
- Review templates

### Policies

Policies configure execution behavior such as:

- SLA at-risk hours
- Required work photo count
- Checklist required
- Customer sign-off required
- Customer review required
- Checklist template
- Review template
- Skip reason list ID
- Blocked reason list ID
- Task changed-since cutoff

Policy scope can be narrowed by task type, customer, project, and effective dates. More specific matching policies win over generic defaults.

### Checklist Templates

Checklist templates define the checklist shown on Job Detail. Items support:

- Item label
- Required flag
- Sequence
- Help text

Required items block job completion until checked.

### Review Templates

Review templates define customer-facing review items. Items should be configured generically where possible. Client-specific hardcoded paths should be avoided unless backend data is not yet normalized.

## Backend Objects

Field Services execution data is stored separately from Task to avoid overloading the Task object.

Main objects:

- `FieldServiceExecution`
- `FieldServicePolicy`
- `FieldServiceChecklistTemplate`
- `FieldServiceReviewTemplate`

`FieldServiceExecution` stores:

- Linked task ID
- Current execution status
- Status history
- Checklist completion
- Work photos
- Customer review acknowledgement
- Customer sign-off
- Sign-off history
- Completion metadata

On completion, the app also updates Task completion fields:

- `actualFinish`
- `percentComplete = 100`

## Date Handling

Execution timestamps are saved in UTC ISO format. UI display should be local time.

## Testing Checklist

Recommended test flow:

1. Give the test user `accessRoles = FieldServices`.
2. Confirm Jobs card appears and Job Settings does not.
3. Give the test user `accessRoles = FieldServicesAdmin`.
4. Confirm Jobs card and Job Settings appear.
5. Open Jobs and verify dashboard counts.
6. Open View All Assignments and verify filters, search, sorting, and header count.
7. Open a job detail.
8. Progress status from Assigned to Work Started.
9. Complete all required checklist items.
10. Capture the required number of work photos.
11. Review required customer review items and record acknowledgement.
12. Capture customer sign-off, or skip with a reason if allowed.
13. Complete the job.
14. Reopen the job and confirm execution state was saved to backend.

## Known Technical Debt

- Client-specific review item overrides live in mobile code until backend configuration supports all required source paths consistently.
- PDF preview support depends on platform capabilities. A native PDF viewer dependency should be considered for production-grade in-app PDF viewing.
- Notifications and offline sync behavior should be verified separately if required for production rollout.
- Role values must be returned reliably in authentication data as `accessRoles` / `User-accessRoles`.
