import * as FileSystem from "expo-file-system/legacy";
import {
  API_ENDPOINTS,
  API_TIMEOUT,
  APP,
  APP_NAME,
  BUSOBJCAT,
  BUSOBJCATMAP,
  INTSTATUS,
  PAGE_SIZE,
  TEST_MODE,
} from "../constants";

import { showToast } from "../utils/MessageUtils";

/**
 * Performs an asynchronous HTTP request to the specified endpoint.
 * @param {string} endpoint - The URL endpoint to which the request will be made.
 * @param {string} method - The HTTP method for the request (e.g., 'GET', 'POST', 'PUT', 'DELETE').
 * @param {Object} headers - (Optional) An object containing request headers.
 * @param {Object} body - (Optional) The request body, typically used for 'POST' or 'PUT' requests.
 * @returns {Promise<Object>} - A promise resolving to the JSON response from the server.
 * @throws {Error} - Throws an error if the request fails or encounters an error.
 */
const fetchData = async (endpoint, method, headers = {}, body = {}) => {
  console.log("Request url: " + endpoint);
  console.log("Request method: " + method);
  console.log("Request headers: " + JSON.stringify(headers));
  console.log("Request body: " + JSON.stringify(body));

  try {
    let requestOptions = {
      method: method,
    };
    if (Object.keys(headers).length > 0) {
      requestOptions.headers = headers;
    }
    if (Object.keys(body).length > 0) {
      requestOptions.body = body;
    }

    const response = await Promise.race([
      fetch(`${endpoint}`, requestOptions),

      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), API_TIMEOUT)
      ),
    ]);

    if (!response.ok) {
      let error;
      switch (response.status) {
        case 400:
          error = new Error(
            "Bad Request: The request could not be understood or was missing required parameters."
          );
          break;
        case 401:
          error = new Error(
            "Unauthorized: Authentication failed or user lacks necessary permissions."
          );
          break;
        case 403:
          error = new Error(
            "Forbidden: The server understood the request, but it refuses to authorize it."
          );
          break;
        case 404:
          error = new Error(
            "Not Found: The requested resource could not be found."
          );
          break;
        case 409:
          error = new Error(
            "Conflict: A conflict occurred with the current state of the target resource."
          );
          break;
        case 413:
          error = new Error("Payload too large.");
          break;
        case 429:
          error = new Error(
            "Too Many Requests: The user has sent too many requests in a given amount of time."
          );
          break;
        case 500:
          error = new Error(
            "Internal Server Error: The server encountered an unexpected condition."
          );
          break;
        case 502:
          error = new Error(
            "Bad Gateway: The server, while acting as a gateway or proxy, received an invalid response from an upstream server."
          );
          break;
        case 503:
          error = new Error(
            "Service Unavailable: The server is not ready to handle the request. Common causes are a server that is down for maintenance or is overloaded."
          );
          break;
        case 504:
          error = new Error(
            "Gateway Timeout: The server, while acting as a gateway or proxy, did not receive a timely response from an upstream server."
          );
          break;
        default:
          error = new Error(
            `HTTP error! Status: ${response.status}, Status Text: ${response.statusText}`
          );
      }

      error.status = response.status; // Add the status code to the error object
      throw error;
    }

    const responseText = await response.text();
    //console.log(JSON.stringify(responseText, null, 2));

    const jsonResponse = JSON.parse(responseText || "{}"); // Parse JSON response or default to empty object

    if (
      (jsonResponse.hasOwnProperty("success") &&
        jsonResponse.success === false) ||
      (jsonResponse.messages &&
        jsonResponse.messages.some((msg) => msg.message_type === "error")) ||
      (jsonResponse.details &&
        jsonResponse.details.some((detail) => detail.success === false))
    ) {
      let errorMessage = jsonResponse.errorMessage || "";

      // Append additional error details if available
      if (jsonResponse.hasOwnProperty("errorCode")) {
        errorMessage += ` | Code: ${jsonResponse.errorCode}`;
      }

      if (jsonResponse.hasOwnProperty("errorDetail")) {
        errorMessage += ` | Detail: ${jsonResponse.errorDetail}`;
      }

      // Append UI message details if available
      if (
        jsonResponse.hasOwnProperty("ui_message") &&
        jsonResponse.ui_message.hasOwnProperty("message_id") &&
        jsonResponse.ui_message.hasOwnProperty("message_text")
      ) {
        errorMessage += ` | UI Message ID: ${jsonResponse.ui_message.message_id}, Message Text: ${jsonResponse.ui_message.message_text}`;
      }

      // Filter and join error messages from the messages array
      const errorMessagesFromMessages =
        jsonResponse.messages
          ?.filter((msg) => msg.message_type === "error")
          .map((msg) => msg.message_text)
          .join(" | ") || "";

      // Filter and join error messages from the details array
      const errorMessagesFromDetails =
        jsonResponse.details
          ?.filter((detail) => detail.success === false)
          .flatMap((detail) => detail.messages.map((msg) => msg.message_text))
          .join(" | ") || "";

      const combinedErrorMessages = [
        errorMessagesFromMessages,
        errorMessagesFromDetails,
      ]
        .filter(Boolean) // Remove empty strings
        .join(" | ");

      if (combinedErrorMessages) {
        errorMessage += `Error: ${combinedErrorMessages}`;
      }

      // Log the error message and show a toast notification
      console.error(errorMessage);
      showToast(errorMessage, "error");
    }

    return jsonResponse;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

/**
 * Fetches a resource with the specified ID from the API, caches it locally, and returns the cached path.
 * @param {string} id - The ID of the resource to fetch and cache.
 * @returns {Promise<string>} - A promise resolving to the cached path of the resource.
 * @throws {Error} - Throws an error if the fetch or caching process fails.
 */
const fetchAndCacheResource = async (id) => {
  try {
    console.log(`Going to fetch resource with id: ${id}`);

    if (!id) {
      console.log("Resource ID is blank, skipping fetch");
      return;
    }

    const cachePath = `${FileSystem.cacheDirectory}${id}`;

    // Check if resource is in cache
    const fileInfo = await FileSystem.getInfoAsync(cachePath);

    console.log(`File Info:`, fileInfo);

    if (fileInfo.exists) {
      console.log(`Resource ${id} is in cache, return the cached path`);
      return cachePath;
    } else {
      console.log(`Resource ${id} not in cache, fetch from API`);
      const apiResponse = await fetch(
        `${API_ENDPOINTS.RESOURCE}/${id}?client=${APP.LOGIN_USER_CLIENT}`
      );

      console.log(`Fetch resource response status: ${apiResponse.status}`);

      if (!apiResponse.ok) {
        throw new Error(
          `Failed to fetch resource ${id}. Status: ${apiResponse.status}, Status Text: ${apiResponse.statusText}`
        );
      }

      const resourceBlob = await apiResponse.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64String = reader.result.split(",")[1];

          await FileSystem.writeAsStringAsync(cachePath, base64String, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log("Resource saved to cache: ", cachePath);
          resolve(cachePath);
        };

        reader.onerror = (error) => {
          console.error("Error reading resource blob:", error);
          reject(error);
        };

        reader.readAsDataURL(resourceBlob);
      });
    }
  } catch (error) {
    console.error(`Error fetching and caching resource for ID ${id}: `, error);
    throw error;
  }
};

/**
 * Returns the query fields configuration based on the specified business object category.
 * @param {string} busObjCat - The business object category.
 * @param {Array} extraFields - Extra fields to be added to the fields array. It can be used in detail screen.
 * @returns {Object} - The query fields configuration object.
 */
const getQueryFields = (busObjCat, extraFields = []) => {
  switch (busObjCat) {
    case BUSOBJCAT.TIMESHEET:
      return {
        fields: [
          "TimeConfirmation-id",
          "TimeConfirmation-start",
          "TimeConfirmation-end",
          "TimeConfirmation-totalTime",
          "TimeConfirmation-extStatus-processTemplateID",
          "TimeConfirmation-extStatus-statusID",
          "TimeConfirmation-extStatus-processTemplateID:ProcessTemplate-steps",
          "TimeConfirmation-remark:text",
          "TimeConfirmation-billableTime",
          "TimeConfirmation-totalTime",
          "TimeConfirmation-totalOvertime",
          ...extraFields,
        ],
        where: [
          {
            fieldName: "TimeConfirmation-employeeID",
            operator: "=",
            value: APP.LOGIN_USER_EMPLOYEE_ID,
          },
        ],
      };
    case BUSOBJCAT.EXPENSE:
      return {
        fields: [
          "ExpenseClaim-id",
          "ExpenseClaim-extID",
          "ExpenseClaim-remark:text",
          "ExpenseClaim-amountBU",
          "ExpenseClaim-date",
          "ExpenseClaim-extStatus-processTemplateID:ProcessTemplate-steps",
          "ExpenseClaim-busUnitID:BusUnit-id",
          "ExpenseClaim-busUnitID:BusUnit-name",
          "ExpenseClaim-busUnitID:BusUnit-name-text",
          "ExpenseClaim-extStatus-processTemplateID",
          "ExpenseClaim-extStatus-statusID",
          ...extraFields,
        ],
        where: [
          {
            fieldName: "ExpenseClaim-type:ExpenseClaimType-singleVendor",
            operator: "=",
            value: false,
          },
          {
            fieldName: "ExpenseClaim-type",
            operator: "!=",
            value: "CASH_ADVANCE",
          },
          {
            fieldName: "ExpenseClaim-employeeID",
            operator: "=",
            value: APP.LOGIN_USER_EMPLOYEE_ID,
          },
        ],
      };
    case BUSOBJCAT.ABSENCE:
      return {
        fields: [
          "Absence-id",
          "Absence-adjustAbsence",
          "Absence-adjustTaken",
          "Absence-type:AbsenceType-name",
          "Absence-type:AbsenceType-hourlyLeave",
          "Absence-type:AbsenceType-displayInHours",
          "Absence-start",
          "Absence-end",
          "Absence-remark:text",
          "Absence-plannedDays",
          "Absence-extStatus-processTemplateID",
          "Absence-extStatus-statusID",
          "Absence-extStatus-processTemplateID:ProcessTemplate-steps",
          ...extraFields,
        ],
        where: [
          {
            fieldName: "Absence-employeeID",
            operator: "=",
            value: APP.LOGIN_USER_EMPLOYEE_ID,
          },
        ],
      };
    default:
      console.log("None of the case matched in getQueryFields:", busObjCat);
      return;
  }
};

/**
 * Returns the sort conditions based on the specified business object category.
 * @param {string} busObjCat - The business object category.
 * @returns {Array<Object>} - An array of sort condition objects.
 */
const getSortConditions = (busObjCat) => {
  switch (busObjCat) {
    case BUSOBJCAT.TIMESHEET:
      return [{ property: "TimeConfirmation-start", direction: "DESC" }];
    case BUSOBJCAT.EXPENSE:
      return [{ property: "ExpenseClaim-date", direction: "DESC" }];
    case BUSOBJCAT.ABSENCE:
      return [{ property: "Absence-start", direction: "DESC" }];
    default:
      console.log(
        "None of the case matched in getSortConditions: " + busObjCat
      );
      return;
  }
};

/**
 * Fetches data for the specified business object category using a query with optional pagination, query fields, and conditions.
 * @param {string} busObjCat - The business object category for which data is to be fetched.
 * @param {number} [page=1] - The page number for pagination (default is 1).
 * @param {number} [limit=PAGE_SIZE] - The limit of items per page (default is PAGE_SIZE).
 * @param {Object} [queryFields={}] - (Optional) Query fields configuration object.
 * @param {Array<Object>} [whereConditions=[]] - (Optional) Array of where conditions for the query.
 * @param {Array<Object>} [orConditions=[]] - (Optional) Array of OR conditions for the query.
 * @param {Array<Object>} [sortConditions=[]] - (Optional) Array of sort conditions for the query.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the fetched data, page number, limit, and total record count.
 *                             If an error occurs during the API request, it resolves to an object containing an error message.
 */
const fetchBusObjCatData = async (
  busObjCat,
  page = 1,
  limit = PAGE_SIZE,
  queryFields = {},
  whereConditions = [],
  orConditions = [],
  sortConditions = []
) => {
  try {
    // If query fields are not provided, get them based on the business object category
    if (!queryFields || Object.keys(queryFields).length === 0) {
      queryFields = getQueryFields(busObjCat);
    }

    // Add where conditions to the query fields if whereConditions is provided
    if (whereConditions && whereConditions.length > 0) {
      // Initialize queryFields.where as an array if it's undefined
      if (!queryFields.where) {
        queryFields.where = [];
      }
      whereConditions.forEach((whereCondition) => {
        queryFields.where.push(whereCondition);
      });
    }

    // Add OR conditions to the query fields if orConditions is provided
    if (orConditions && orConditions.length > 0) {
      // Initialize queryFields.where as an array if it's undefined
      if (!queryFields.or) {
        queryFields.or = [];
      }
      orConditions.forEach((orCondition) => {
        queryFields.or.push(orCondition);
      });
    }

    // Common query data for the API request
    const commonQueryData = {
      userID: APP.LOGIN_USER_ID,
      client: parseInt(APP.LOGIN_USER_CLIENT),
      language: APP.LOGIN_USER_LANGUAGE,
      query: JSON.stringify(queryFields),
      testMode: TEST_MODE,
      appName: JSON.stringify(getAppNameByCategory(busObjCat)),
      intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
    };

    // Add optional parameters if any
    if (page !== null) {
      commonQueryData.page = page;
      if (limit !== null && page >= 1) {
        commonQueryData.limit = limit;
        commonQueryData.start = (page - 1) * limit;
      }
    }

    // Use sortConditions if provided or fallback to getSortConditions
    if (sortConditions.length > 0) {
      commonQueryData.sort = JSON.stringify(sortConditions);
    } else if (getSortConditions(busObjCat)) {
      commonQueryData.sort = JSON.stringify(getSortConditions(busObjCat));
    }

    console.log(
      `Query data for ${busObjCat}: ${JSON.stringify(commonQueryData)}`
    );

    // Convert common query data to URLSearchParams
    const formData = new URLSearchParams(commonQueryData);

    // Fetch data using the fetchData function
    const busObjCatData = await fetchData(
      API_ENDPOINTS.QUERY,
      "POST",
      {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      formData.toString()
    );

    // Handle errors if present in the response
    if (!busObjCatData || busObjCatData.errorCode) {
      console.error(busObjCatData.errorMessage);
      showToast(
        "An error occurred during fetching " + busObjCat + " data.",
        "error"
      );
      return { error: busObjCatData.errorMessage };
    }

    // Return fetched data along with page number and limit
    return {
      data: busObjCatData.data,
      page: page,
      limit: limit,
      totalCount: busObjCatData?.["TOTAL_RECORD_COUNT"],
    };
  } catch (error) {
    console.error("Error: fetching " + busObjCat + " data: ", error);
  }
};

/**
 * Returns the application app path name based on the specified business object category.
 * @param {string} busObjCat - The business object category.
 * @returns {string} - The application path name.
 */
const getAppNameByCategory = (busObjCat) => {
  switch (busObjCat) {
    case BUSOBJCAT.TIMESHEET:
      return APP_NAME.TIMESHEET;
    case BUSOBJCAT.EXPENSE:
      return APP_NAME.EXPENSE;
    case BUSOBJCAT.ABSENCE:
      return APP_NAME.ABSENCE;
    default:
      console.log(
        "None of the case matched in getAppNameByCategory:",
        busObjCat
      );
      return null;
  }
};

/**
 * Retrieve the app name for a given document category.
 * @param {string} documentCategory - The document category (e.g., "TimeConfirmation").
 * @returns {string|null} - The corresponding app name, or null if not found.
 */
const getAppNameByDocumentCategory = (documentCategory) => {
  // Find the key in BUSOBJCATMAP using the document category
  const categoryKey = Object.keys(BUSOBJCATMAP).find(
    (key) => BUSOBJCATMAP[key] === documentCategory
  );

  // Convert the category key (e.g., "Timesheet") to uppercase to match APP_NAME keys
  return categoryKey ? APP_NAME[categoryKey.toUpperCase()] : null;
};

/**
 * Determines whether any list should not be replaced based on the specified business object category.
 * @param {string} busObjCat - The business object category.
 * @returns {boolean} - Returns true if the list should not be replaced; otherwise, false.
 */
const isDoNotReplaceAnyList = (busObjCat) => {
  switch (busObjCat) {
    case BUSOBJCAT.TIMESHEET:
      return true;
    case BUSOBJCAT.EXPENSE:
      return false;
    case BUSOBJCAT.ABSENCE:
      return true;
    case BUSOBJCAT.EMPLOYEE:
      return true;
    default:
      console.log(
        "None of the case matched in doNotReplaceAnyList :",
        busObjCat
      );
      return;
  }
};

/**
 * Loads more data for the specified business object category and updates the list data state.
 * @param {string} busObjCat - The business object category for which data is being loaded.
 * @param {number} page - The page number to load.
 * @param {number} limit - The limit of items per page.
 * @param {Object} queryFields - The query fields configuration.
 * @param {Array<Object>} whereConditions - Array of where conditions for the query.
 * @param {Array<Object>} orConditions - Array of or conditions for the query.
 * @param {Array<Object>} sortConditions - Array of sort conditions for the query.
 * @param {function} setListData - Function to update the list data state.
 * @param {function} setLoading - Function to update the loading state.
 * @param {function} setError - Function to update the error state.
 * @returns {void}
 */
const loadMoreData = async (
  busObjCat,
  page,
  limit,
  queryFields,
  whereConditions,
  orConditions,
  sortConditions,
  setListData,
  setLoading,
  setError
) => {
  try {
    console.log(
      `Loading more data for busObjCat: ${busObjCat}. Current page is ${page}. Limit is ${limit}.`
    );

    // Set loading state to indicate that the load more operation is in progress
    setLoading(true);

    // Fetch additional data for the specified page and limit
    const fetchResponse = await fetchBusObjCatData(
      busObjCat,
      page,
      limit,
      queryFields,
      whereConditions,
      orConditions,
      sortConditions
    );

    // Check if there is an error in the fetch response
    if (!fetchResponse.error) {
      // Extract new data from the fetch response
      const newData = fetchResponse.data;

      // Check if there is new data to append
      if (newData.length > 0) {
        // Log keys of the new data
        console.log(
          "New Data Keys:",
          newData.map((item) => item[`${BUSOBJCATMAP[busObjCat]}-id`])
        );

        setListData((prevData) => {
          // Log keys of the previous data
          console.log(
            "Previous data keys:",
            prevData.map((item) => item[`${BUSOBJCATMAP[busObjCat]}-id`])
          );

          // Filter out new data items that are already present in the previous data
          const filteredNewData = newData.filter(
            (newItem) =>
              !prevData.some(
                (prevItem) =>
                  prevItem[`${BUSOBJCATMAP[busObjCat]}-id`] ===
                  newItem[`${BUSOBJCATMAP[busObjCat]}-id`]
              )
          );

          // Log keys of the filtered new data
          console.log(
            "Filtered New Data Keys:",
            filteredNewData.map((item) => item[`${BUSOBJCATMAP[busObjCat]}-id`])
          );

          // Concatenate the filtered new data with the existing data
          return [...prevData, ...filteredNewData];
        });
      }

      // Reset error state
      setError(null);
    } else {
      // Handle the case where there is an error in fetching data
      setError(fetchResponse.error);
    }
  } catch (error) {
    // Handle any errors that occur during the load more operation
    console.error(`Error loading more data: ${error}`);
    setError(`Error loading more data: ${error}`);
  } finally {
    // Reset the loading state regardless of success or failure
    setLoading(false);
  }
};

/**
 * Uploads a binary resource (e.g., image) and creates an attachment entry in the IBE client database.
 * The function returns the ID of the newly created attachment.
 *
 * @param {string} imagePath - The local path of the image to be uploaded.
 * @param {boolean} fetchNewObjectIds - Whether to fetch new object IDs.
 * @param {Object} options - Additional options for the upload.
 * @param {string} [options.type] - The MIME type of the image.
 * @param {string} [options.name] - The name of the image file.
 * @param {number} [options.tHeight] - The height of the thumbnail.
 * @param {number} [options.tWidth] - The width of the thumbnail.
 * @param {boolean} [options.convertToPng] - Whether to convert the image to PNG.
 * @param {string} [options.ocrCheck] - The MIME type for OCR check.
 * @param {Object} [queryParams] - Additional query string parameters.
 * @param {string} [queryParams.client] - Client information.
 * @param {boolean} [queryParams.allClient] - All client flag.
 * @param {string} [queryParams.user] - User information.
 * @returns {Promise<Object>} - A promise resolving to an object containing uploaded file id and thumbnail IDs.
 */
const uploadBinaryResource = async (
  imagePath,
  fetchNewObjectIds,
  { type, name, tHeight, tWidth, convertToPng, ocrCheck } = {},
  queryParams = {}
) => {
  try {
    let photoId = "";
    let thumbId = "";

    // Obtain new object IDs from the server if needed
    if (fetchNewObjectIds) {
      const objectIdQueryParams = convertToQueryString({ count: 50 });
      const objectIds = await fetchData(
        `${API_ENDPOINTS.NEW_OBJECT_ID}?${objectIdQueryParams}`,
        "GET"
      );

      // Check if new object IDs were obtained successfully
      if (
        !objectIds ||
        !(objectIds instanceof Array) ||
        objectIds.length === 0
      ) {
        throw new Error("Failed to obtain new object Id");
      }

      // Extract photo and thumbnail IDs from the obtained object IDs
      photoId = objectIds[objectIds.length - 1];
      thumbId = objectIds.length > 1 ? objectIds[objectIds.length - 2] : "";
    }

    // Prepare form data for upload
    const formData = new FormData();
    formData.append("resourceFile", {
      uri: imagePath,
      type: type || "image/png",
      name: name || "user-photo.jpg",
    });

    if (tHeight !== undefined) {
      formData.append("tHeight", tHeight.toString());
    }

    if (tWidth !== undefined) {
      formData.append("tWidth", tWidth.toString());
    }

    if (convertToPng !== undefined) {
      formData.append("convertToPng", convertToPng.toString());
    }

    if (ocrCheck !== undefined) {
      formData.append("ocrCheck", ocrCheck);
    }

    if (fetchNewObjectIds) {
      formData.append("photoID", photoId);
      formData.append("thumbID", thumbId);
    }

    // Build dynamic query string parameters
    const dynamicQueryParams = {};
    if (queryParams.client) dynamicQueryParams.client = queryParams.client;
    if (queryParams.allClient)
      dynamicQueryParams.allClient = queryParams.allClient;
    if (queryParams.user) dynamicQueryParams.user = queryParams.user;

    const uploadQueryParams = convertToQueryString(dynamicQueryParams);

    const uploadResourceResponse = await fetchData(
      `${API_ENDPOINTS.UPLOAD_BINARY_RESOURCE}?${uploadQueryParams}`,
      "POST",
      {
        "Content-Type": "multipart/form-data",
      },
      formData
    );

    if (!uploadResourceResponse.success) {
      throw new Error("Failed to upload binary resource");
    }

    const binaryResource = {
      attachmentId: uploadResourceResponse.id,
      resourceId:
        uploadResourceResponse.resourceID ||
        uploadResourceResponse.resourceId ||
        uploadResourceResponse.id,
      thumbId: uploadResourceResponse.thumbID,
    };

    return binaryResource;
  } catch (error) {
    console.error("Error uploading binary resource:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
};

/**
 * Converts an object to a query string.
 * @param {Object} params - The object containing key-value pairs to be converted to a query string.
 * @returns {string} - The generated query string.
 */
const convertToQueryString = (params) => {
  return Object.keys(params)
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");
};

export {
  convertToQueryString,
  fetchData,
  fetchAndCacheResource,
  fetchBusObjCatData,
  getAppNameByCategory,
  getAppNameByDocumentCategory,
  isDoNotReplaceAnyList,
  loadMoreData,
  uploadBinaryResource,
};
