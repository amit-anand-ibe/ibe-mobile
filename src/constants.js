/**
 * Function to dynamically determine the current environment.
 * This function can be based on various factors such as the domain, configuration files, etc.
 * @returns {string} - The current environment (e.g., "development", "testing", "production").
 */
const determineEnvironment = () => {
  return "testing";
};

/**
 * Enum representing different environments with their base URLs.
 * @readonly
 * @enum {string}
 */
const Environment = {
  /** Development environment. */
  DEVELOPMENT: "development",
  /** Testing environment. */
  TESTING: "testing",
  /** Production environment. */
  PRODUCTION: "production",
};

/**
 * Base URLs for different environments.
 * @constant
 * @type {Object.<string, string>}
 */
const BASE_URL = {
  [Environment.DEVELOPMENT]: "http://172.17.0.90",
  [Environment.TESTING]: "https://testserver.ibenv.net",
  [Environment.PRODUCTION]: "https://appnew.ibenv.net",
};

// Determine the current environment
const currentEnvironment = determineEnvironment();

/**
 * Base URL for the current environment.
 * @constant
 * @type {string}
 */
const baseURL = BASE_URL[currentEnvironment];

/**
 * Object containing API endpoints based on the current environment's base URL.
 * @constant
 * @type {Object.<string, string>}
 */
const API_ENDPOINTS = {
  /** Endpoint for authentication. */
  AUTHENTICATE: `${baseURL}/api/authenticate`,
  /** Endpoint for user logout. */
  LOGOUT: `${baseURL}/api/logout`,
  /** Endpoint for querying fields. */
  QUERY: `${baseURL}/api/queryfields`,
  /** Endpoint for updating fields. */
  UPDATE_FIELDS: `${baseURL}/api/updatefields`,
  /** Endpoint for accessing resources. */
  RESOURCE: `${baseURL}/resource`,
  /** Endpoint for obtaining a new object ID. */
  NEW_OBJECT_ID: `${baseURL}/api/newobjectid`,
  /** Endpoint for uploading binary resources. */
  UPLOAD_BINARY_RESOURCE: `${baseURL}/api/uploadbinaryresource`,
  /** Endpoint for invoking APIs. */
  INVOKE: `${baseURL}/api/invoke`,
  /** Endpoint for invoking new APIs. */
  INVOKE_API_NEW: `${baseURL}/api/invokeApiNew`,
  /** Endpoint for invoking get document workflow status. */
  GET_DOCUMENT_STATUS: `${baseURL}/api/getdocstatus`,
  /** Endpoint for invoking set document workflow status. */
  SET_DOCUMENT_STATUS: `${baseURL}/api/setdocstatus`,
};

/**
 * Timeout duration for API requests in milliseconds.
 * @constant
 * @type {number}
 */
const API_TIMEOUT = 120000; // 2 minutes

/**
 * Object containing application-related constants.
 * @constant
 * @type {Object}
 */
const APP = {
  /** Client ID of the logged-in user. */
  LOGIN_USER_CLIENT: "",
  /** Date format for the logged-in user. */
  LOGIN_USER_DATE_FORMAT: "",
  /** Employee ID of the logged-in user. */
  LOGIN_USER_EMPLOYEE_ID: "",
  /** Person ID of the logged-in user. */
  LOGIN_USER_PERSON_ID: "",
  /** ID of the logged-in user. */
  LOGIN_USER_ID: "",
  /** Language preference of the logged-in user. Default is English. */
  LOGIN_USER_LANGUAGE: "en",
};

/**
 * Object containing activity IDs for different application modules.
 * @constant
 * @type {Object}
 */
const APP_ACTIVITY_ID = {
  /** Activity ID for timesheet module. */
  TIMESHEET: "manage.timemgt.timesheet",
  /** Activity ID for expense module. */
  EXPENSE: "manage.expensemgt.expenseclaim",
  /** Activity ID for absence module. */
  ABSENCE: "manage.absencemgt.myabsencerequest",
  /** Activity ID for inbox module. */
  MESSAGELOG: "platform.bpm.inbox",
};

/**
 * Object containing app path names for different application modules.
 * @constant
 * @type {Object}
 */
const APP_NAME = {
  /** App name for timesheet module. */
  TIMESHEET: "hrAdmin.timemgt",
  /** App name for expense module. */
  EXPENSE: "accountspayable.expenseclaim",
  /** App name for absence module. */
  ABSENCE: "hrAdmin.absencemgmt",
  /** App name for employee module. */
  EMPLOYEE: "hrAdmin.employeemaster",
};

/**
 * Object containing business object categories and their mappings.
 * @constant
 * @type {Object}
 */
const BUSOBJCAT = {
  /** Business object category for timesheet. */
  TIMESHEET: "Timesheet",
  /** Business object category for expense. */
  EXPENSE: "Expense",
  /** Business object category for absence. */
  ABSENCE: "Absence",
  /** Business object category for inbox. */
  MESSAGELOG: "Approval",
  /** Business object category for employee. */
  EMPLOYEE: "Employee",
};

/**
 * Object mapping business object categories to their respective data models.
 * @constant
 * @type {Object}
 */
const BUSOBJCATMAP = {
  [BUSOBJCAT.TIMESHEET]: "TimeConfirmation",
  [BUSOBJCAT.EXPENSE]: "ExpenseClaim",
  [BUSOBJCAT.ABSENCE]: "Absence",
  [BUSOBJCAT.EMPLOYEE]: "Resource",
};

/**
 * Time duration (in milliseconds) representing the interval between consecutive clicks
 * in a double-click event.
 * @constant
 * @type {number}
 */
const DOUBLE_CLICK_DELTA = 400;

/**
 * This constant defines the maximum allowed size for images in bytes.
 * The application will reject image uploads that exceed this size limit
 * to prevent errors related to payload size during the upload process.
 *
 * @constant {number}
 */
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Object containing internal status codes.
 * @constant
 * @enum {number}
 */
const INTSTATUS = {
  /** Indicates an active status. */
  ACTIVE: 0,
  /** Indicates a deleted status. */
  DELETED: 3,
};

/**
 * Maximum lengths for login input fields.
 * @constant
 * @type {Object}
 */
const LOGIN_INPUTS_MAXLENGTH = {
  /** Maximum length for username field. */
  USERNAME: 30,
  /** Maximum length for password field. */
  PASSWORD: 30,
  /** Maximum length for client ID field. */
  CLIENTID: 4,
};

/**
 * Maximum allowed upload file size in MB.
 * @constant
 * @type {number}
 */
const MAX_UPLOAD_FILE_SIZE = 10;

/**
 * Default page size for paginated data.
 * @constant
 * @type {number}
 */
const PAGE_SIZE = 20;

/**
 * List of preferred languages to use as fallbacks for language-specific operations.
 * @constant
 * @type {Array<string>}
 */
const PREFERRED_LANGUAGES = ["en", "en_GB"];

/**
 * Flag indicating whether the application is running in test mode.
 * @constant
 * @type {boolean}
 */
const TEST_MODE = false;

/**
 * Array containing valid file extensions.
 * These extensions are commonly used for text documents, images, and other file types.
 * @constant
 * @type {string[]}
 */
const VALID_FILE_EXTENSIONS = [
  ".txt",
  ".docx",
  ".pdf",
  ".jpg",
  ".png",
  ".xlsx",
  ".xls",
  ".mp4",
  ".jpeg",
  ".zip",
  ".html",
  ".mp3",
  ".pptx",
  ".csv",
  ".json",
  ".xml",
  ".svg",
  ".wav",
  ".avi",
];

export {
  API_ENDPOINTS,
  API_TIMEOUT,
  APP,
  APP_ACTIVITY_ID,
  APP_NAME,
  BUSOBJCAT,
  BUSOBJCATMAP,
  DOUBLE_CLICK_DELTA,
  MAX_IMAGE_SIZE,
  INTSTATUS,
  LOGIN_INPUTS_MAXLENGTH,
  MAX_UPLOAD_FILE_SIZE,
  PAGE_SIZE,
  PREFERRED_LANGUAGES,
  TEST_MODE,
  VALID_FILE_EXTENSIONS,
};
