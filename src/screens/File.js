import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import * as DocumentPicker from "expo-document-picker";

import { format, isValid } from "date-fns";

import CustomButton from "../components/CustomButton";
import ConfirmationDialog from "../components/dialogs/ConfimationDialog";
import EditDialog from "../components/dialogs/EditDialog";
import PreviewDialog from "../components/dialogs/PreviewDialog";

import {
  fetchData,
  getAppNameByCategory,
  isDoNotReplaceAnyList,
  uploadBinaryResource,
} from "../utils/APIUtils";
import { handleDownload, handlePreview } from "../utils/FileUtils";
import {
  convertBytesToMegaBytes,
  convertToDateFNSFormat,
} from "../utils/FormatUtils";
import { showToast } from "../utils/MessageUtils";
import updateFields from "../utils/UpdateUtils";

import {
  API_ENDPOINTS,
  APP,
  BUSOBJCATMAP,
  INTSTATUS,
  MAX_UPLOAD_FILE_SIZE,
  TEST_MODE,
  VALID_FILE_EXTENSIONS,
} from "../constants";

import { disableOpacity, useCommonStyles } from "../styles/common";

const File = ({
  busObjCat,
  busObjId,
  initialFilesIdList = [],
  isParentLocked = false,
}) => {
  // Initialize useTranslation hook
  const { t } = useTranslation();

  const common = useCommonStyles();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [files, setFiles] = useState([]);
  const [isFilesDirty, setIsFilesDirty] = useState(false);

  // State variables for modal
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // State variables for file deletion
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] =
    useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  // State variable to hold download progress for each file
  const [downloadProgressMap, setDownloadProgressMap] = useState({});

  // State variables to hold preview information for each file
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [previewFileTitle, setPreviewFileTitle] = useState("");
  const [previewFileType, setPreviewFileType] = useState(null);
  const [previewFileUri, setPreviewFileUri] = useState(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const [previewFileMimeType, setPreviewFileMimeType] = useState("");

  const maxUploadFileSizeInBytes = MAX_UPLOAD_FILE_SIZE * 1024 * 1024; // MAX_UPLOAD_FILE_SIZE in bytes

  // Effect to handle file processing
  useEffect(() => {
    if (isFilesDirty) {
      processFiles(files);
    }
  }, [files, isFilesDirty]);

  /**
   * Asynchronous function to process files based on their status
   * @param {Array} files - List of files to be processed
   */
  const processFiles = async (files) => {
    let updateParams = {}; // Parameters for updating file details

    // Create a copy of the files array to avoid mutation issues while iterating
    let filesToProcess = [...files];

    for (const file of filesToProcess) {
      try {
        setIsUpdating(true);

        if (file.isNewlyAdded) {
          // Upload newly added files
          const newlyAddedAttachment = await uploadBinaryResource(
            file.newlyAddedFileLocalUri,
            false, // Fetch new object IDs
            {
              name: file.name,
              tHeight: 175,
              tWidth: 250,
              ocrCheck: file.mimeType,
            },
            {
              client: APP.LOGIN_USER_CLIENT,
              user: APP.LOGIN_USER_ID,
            }
          );

          if (!newlyAddedAttachment || !newlyAddedAttachment.attachmentId) {
            return;
          }

          // Set update parameters for the newly added file
          updateParams[`Attachment-thumbnail`] = newlyAddedAttachment.thumbID;
          updateParams[`Attachment-busObjs`] = {
            busObjCat: BUSOBJCATMAP[busObjCat],
            iD: file.busObjId,
          };
          updateParams[`Attachment-createdOn`] = new Date();
          updateParams[`Attachment-intStatus`] = 0;
          if (file.mimeType) {
            updateParams[`Attachment-mIMEtype`] = file.mimeType;
          }
          updateParams[`Attachment-sourceFile`] = file.name;
          updateParams[`Attachment-text:text`] = file.name;
          if (file.attachmentType) {
            updateParams[`Attachment-type`] = file.attachmentType;
          }
          updateParams[`isLinked`] = true;

          file.id = newlyAddedAttachment.attachmentId; // Update the file id with the created attachment id

          // Call the function to handle file update with the new attachment ID
          await handleFileUpdate(
            newlyAddedAttachment.attachmentId,
            updateParams
          );

          // Set the isNewlyAdded flag to false after successful upload
          setFiles((prevFiles) =>
            prevFiles.map((f) =>
              f.id === file.id ? { ...f, isNewlyAdded: false } : f
            )
          );

          // Call the function to update attachment ID in files of busObjCat
          await updateBusObjCat();
        } else if (file.isUpdated) {
          // Update existing files
          updateParams[`Attachment-sourceFile`] = file.name;
          updateParams[`Attachment-text:text`] = file.name;
          if (file.attachmentType) {
            updateParams[`Attachment-type`] = file.attachmentType;
          }

          // Call the function to handle file update with the existing attachment ID
          await handleFileUpdate(file.id, updateParams);

          // Set the isUpdated flag to false after successful update
          setFiles((prevFiles) =>
            prevFiles.map((f) =>
              f.id === file.id ? { ...f, isUpdated: false } : f
            )
          );
        } else if (file.isDeleted) {
          // Mark files as deleted
          updateParams[`Attachment-intStatus`] = 3;

          // Call the function to handle file update with the existing attachment ID
          await handleFileUpdate(file.id, updateParams);

          // Remove the deleted file from the array based on file id
          const updatedFiles = files.filter((f) => f.id !== file.id);
          setFiles(updatedFiles);
        }
      } catch (error) {
        // Handle specific error codes and show appropriate messages
        if (error.status === 413) {
          // Remove the file from the array if error code 413 occurs
          const updatedFiles = files.filter((f) => f.id !== file.id);
          setFiles(updatedFiles);

          console.error("Payload too large. Please upload a smaller file.");
          showToast(t("upload_error_413"), "error");
        } else {
          console.error("Error in pickFile method of File:", error);
          showToast(`${t("failed_upload_file")}: ${file.name}`, "error");
        }
      } finally {
        setIsUpdating(false);
        setIsFilesDirty(false);
      }
    }
  };

  /**
   * Asynchronous function to handle file update
   * @param {string} attachmentId - ID of the attachment to be updated
   * @param {Object} updateParams - Parameters for updating the file
   */
  const handleFileUpdate = async (attachmentId, updateParams) => {
    if (!attachmentId) {
      return;
    }

    try {
      // Prepare form data for the update
      let formData = {
        data: {
          [`Attachment-id`]: attachmentId,
          ...updateParams,
        },
      };

      // Prepare query string parameters for the update request
      const queryStringParams = {
        userID: APP.LOGIN_USER_ID,
        client: APP.LOGIN_USER_CLIENT,
        language: APP.LOGIN_USER_LANGUAGE,
        testMode: TEST_MODE,
        component: "platform",
        doNotReplaceAnyList: isDoNotReplaceAnyList(busObjCat),
        appName: JSON.stringify(getAppNameByCategory(busObjCat)),
      };

      // Call the updateFields function to perform the update
      const updateResponse = await updateFields(formData, queryStringParams);

      // Show appropriate messages based on the update response
      if (!updateResponse.success) {
        showToast(t("update_failure"), "error");
      }

      if (updateResponse.message) {
        showToast(updateResponse.message);
      }
    } catch (error) {
      // Handle errors that occur during the file update
      console.error("Error in handleFileUpdate:", error);
      showToast(t("failed_update_file"), "error");
    }
  };

  /**
   * Asynchronous function to update the business object category with the file IDs.
   *
   * @async
   * @function
   * @param {Array} [files=[]] - List of files to be included in the update. Each file should have an `id` property.
   * @throws {Error} Throws an error if the update process fails.
   */
  const updateBusObjCat = async () => {
    try {
      // Collect file IDs into an array. Defaults to an empty array if no files are provided.
      const fileIds = files.length > 0 ? files.map((file) => file.id) : [];

      // Prepare form data for the update request.
      let formData = {
        data: {
          [`${BUSOBJCATMAP[busObjCat]}-id`]: busObjId, // Business object ID to be updated
          [`${BUSOBJCATMAP[busObjCat]}-files`]: fileIds, // Array of file IDs to be associated with the business object
        },
      };

      // Prepare query string parameters for the update request.
      const queryStringParams = {
        userID: APP.LOGIN_USER_ID,
        client: APP.LOGIN_USER_CLIENT,
        language: APP.LOGIN_USER_LANGUAGE,
        testMode: TEST_MODE,
        component: "platform",
        doNotReplaceAnyList: isDoNotReplaceAnyList(busObjCat),
        appName: JSON.stringify(getAppNameByCategory(busObjCat)),
      };

      // Call the updateFields function to perform the update request.
      const updateResponse = await updateFields(formData, queryStringParams);

      if (!updateResponse.success) {
        showToast(t("update_failure"), "error"); // Show error message if the update fails
      }

      if (updateResponse.message) {
        showToast(updateResponse.message); // Show success or informational message
      }
    } catch (error) {
      // Handle errors that occur during the file update process.
      console.error("Error in updateBusObjCat(files):", error);
      showToast(t("failed_upload_file"), "error"); // Show error message for failed file update
    }
  };

  /**
   * Asynchronous function to handle picking files from the device.
   */
  const pickFile = async () => {
    try {
      // Open the document picker to select multiple files
      const documentPickerResult = await DocumentPicker.getDocumentAsync({
        multiple: true, // Enable selecting multiple files
      });

      // Log the document picker result
      console.log(
        "Document picker result: " + JSON.stringify(documentPickerResult)
      );

      // Check if the file picking was cancelled by the user
      if (documentPickerResult.canceled === true) {
        console.log("File picking cancelled");
      } else if (
        documentPickerResult.canceled === false &&
        documentPickerResult.assets &&
        documentPickerResult.assets.length > 0
      ) {
        const skippedLargeFiles = [];
        const skippedExistingFiles = [];

        // Filter out files that already exist and files that exceed the maximum size limit
        const newFiles = documentPickerResult.assets.filter((newFile) => {
          // Check if the file exceeds the maximum size limit
          if (newFile.size > maxUploadFileSizeInBytes) {
            skippedLargeFiles.push({ name: newFile.name, size: newFile.size });
            return false;
          }
          // Check if the file already exists
          if (
            files.some((existingFile) => existingFile.name === newFile.name)
          ) {
            skippedExistingFiles.push(newFile.name);
            return false;
          }
          return true;
        });

        // Map the filtered files to the appropriate format
        const pickedFiles = newFiles.map(({ name, mimeType, size, uri }) => ({
          id: name, // Initially, assigning the name as the id
          name,
          mimeType: mimeType,
          size,
          isNewlyAdded: true,
          newlyAddedFileLocalUri: uri,
        }));

        // Log the picked files
        console.log("Picked files:", pickedFiles);

        // Add the picked files to the top of existing files list
        setFiles([...pickedFiles, ...files]);

        // Show message for skipped files due to existence
        if (skippedExistingFiles.length > 0) {
          showToast(
            `${skippedExistingFiles.length} file${
              skippedExistingFiles.length === 1 ? "" : "s"
            } skipped as ${
              skippedExistingFiles.length === 1 ? "it is" : "they are"
            } already added.`,
            "warning"
          );
        }

        // Show message for skipped files due to size limit
        if (skippedLargeFiles.length > 0) {
          const skippedFileNames = skippedLargeFiles.map((file) => file.name);
          showToast(
            `${skippedLargeFiles.length} file${
              skippedLargeFiles.length === 1 ? "" : "s"
            } (${skippedFileNames.join(", ")}) skipped as ${
              skippedLargeFiles.length === 1 ? "it exceeds" : "they exceed"
            } the maximum size limit of ${convertBytesToMegaBytes(
              maxUploadFileSizeInBytes
            )}.`,
            "warning"
          );
        }

        setIsFilesDirty(true);
      } else {
        // File picking failed for some reason
        console.log("File picking failed");
      }
    } catch (error) {
      // Handle any errors that occur during file picking
      console.error("Error picking file:", error);
    }
  };

  // Function to open modal for editing file name
  const openEditModal = (file) => {
    setSelectedFile(file);
    setIsEditModalVisible(true);
  };

  // Function to close edit modal
  const closeEditModal = () => {
    setIsEditModalVisible(false);
    setSelectedFile(null);
  };

  /**
   * Handles the confirmation of changes made in the EditDialog modal.
   *
   * This function updates the file details in the `files` state based on the provided values from the modal.
   * It extracts the `fileName` and `fileType` from the `values` object and updates the corresponding file
   * entry in the `files` array. If a file with the matching `id` is found, its details are updated and marked as
   * updated. The function also sets a flag to indicate that changes have been made and closes the modal.
   *
   * @param {Object} values - The values from the EditDialog modal.
   * @param {string} values.fileName - The updated name of the file.
   * @param {Object} values.fileType - The updated type of the file, with label and value properties.
   *
   * @returns {void}
   */
  const confirmEditChanges = (values) => {
    // Extract the values from the input IDs
    const fileName = values["fileName"] || "";
    const fileType = values["fileType"] || {}; // fileType is an object with label and value properties

    // Extract the current values of the selected file
    const currentFile = selectedFile || {};
    const currentFileName = currentFile.name || "";
    const currentFileType = currentFile.attachmentType || "";

    // Check if the values have changed
    const isFileNameChanged = fileName !== currentFileName;
    const isFileTypeChanged =
      fileType.value && fileType.value !== currentFileType;

    // Update the files state only if there are changes
    if (isFileNameChanged || isFileTypeChanged) {
      setFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.id === selectedFile.id
            ? {
                ...file,
                name: fileName,
                attachmentType: fileType.value
                  ? fileType.value
                  : file.attachmentType,
                attachmentTypeName: fileType.label
                  ? fileType.label
                  : file.attachmentTypeName,
                isUpdated: true,
              }
            : file
        )
      );

      setIsFilesDirty(true);
    }

    closeEditModal();
  };

  /**
   * Validates the file name input.
   *
   * This function performs validation checks on the file name provided in the input values.
   * It checks for the following:
   * - Whether the file name is empty.
   * - Whether the file name consists only of a file extension.
   * - Whether the file extension is among the supported valid extensions.
   *
   * @param {Object} values - An object containing input values, where the file name can be accessed using the key "fileName".
   * @returns {string|null} - Returns a validation error message if the file name is invalid; otherwise, returns null if the input is valid.
   */
  const validateFileName = (values) => {
    const value = values["fileName"] || "";

    // Check if the input value is empty
    if (!value.trim()) {
      return t("no_filename_provided");
    }

    // Get the file extension from the input value
    const fileExtension = value.slice(value.lastIndexOf(".")).toLowerCase();

    // Check if the file extension is empty or same as the input value (only extension provided)
    if (fileExtension === value.toLowerCase()) {
      return t("filename_cannot_consist_of_extension");
    }

    // Check if the file extension is valid
    if (!VALID_FILE_EXTENSIONS.includes(fileExtension)) {
      return t("invalid_file_extension", {
        extensions: VALID_FILE_EXTENSIONS.join(", "),
      });
    }

    return null; // Return null if input is valid
  };

  const handleEdit = (item) => {
    openEditModal(item); // Open the modal for editing
  };

  // Function to confirm file deletion
  const confirmDelete = () => {
    // Mark the file to be deleted as 'isDeleted: true'
    const updatedFiles = files.map((file) =>
      file.id === fileToDelete.id ? { ...file, isDeleted: true } : file
    );

    setFiles(updatedFiles);

    setIsFilesDirty(true);

    setIsDeleteConfirmationVisible(false);
  };

  // Function to cancel file deletion
  const cancelDelete = () => {
    setIsDeleteConfirmationVisible(false);
    setFileToDelete(null);
  };

  // Function to open confirmation dialog for deleting file
  const handleDelete = (item) => {
    setFileToDelete(item);
    setIsDeleteConfirmationVisible(true);
  };

  // Function to handle closing the preview modal
  const onClosePreview = () => {
    setPreviewFileTitle("");
    setPreviewFileType(null);
    setPreviewFileUri(null);
    setPreviewFileName("");
    setPreviewFileMimeType("");
    setIsPreviewModalVisible(false);
  };

  /**
   * Fetches initial files based on the provided list of file IDs.
   * Retrieves file metadata from the server and updates the state accordingly.
   * @returns {void}
   */
  const fetchInitialFiles = async () => {
    try {
      if (initialFilesIdList?.length === 0) {
        return;
      }

      setLoading(true);

      // Define query fields to fetch file metadata
      const queryFields = {
        fields: [
          "Attachment-id",
          "Attachment-type",
          "Attachment-type:AttachmentType-name",
          "Attachment-thumbnail",
          "Attachment-original",
          "Attachment-sourceFile",
          "Attachment-mIMEtype",
          "Attachment-createdOn",
          "Attachment-original:BinaryResource-length",
        ],
        where: [
          {
            fieldName: "Attachment-id",
            operator: "in",
            value: initialFilesIdList, // Use the initialFilesIdList array as the value
          },
        ],
        sort: [
          { property: "Attachment-createdOn", direction: "DESC" },
          { property: "Attachment-sourceFile", direction: "ASC" },
        ],
      };

      // Define common query parameters
      const commonQueryParams = {
        testMode: TEST_MODE,
        client: parseInt(APP.LOGIN_USER_CLIENT),
        user: APP.LOGIN_USER_ID,
        userID: APP.LOGIN_USER_ID,
        language: APP.LOGIN_USER_LANGUAGE,
        intStatus: JSON.stringify([INTSTATUS.ACTIVE]),
      };

      // Construct form data for the request
      const formData = {
        query: JSON.stringify(queryFields),
        ...commonQueryParams,
      };

      // Fetch data from the server
      const response = await fetchData(
        API_ENDPOINTS.QUERY,
        "POST",
        {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        new URLSearchParams(formData).toString()
      );

      // Process the response if successful and data is available
      if (
        response.success === true &&
        response.data &&
        response.data instanceof Array &&
        response.data.length > 0
      ) {
        // Map fetched files metadata to the desired format
        const fetchedFiles = response.data.map((file) => {
          const id = file["Attachment-id"];
          const attachmentType = file["Attachment-type"];
          const attachmentTypeName =
            file["Attachment-type:AttachmentType-name"];
          const mimeType =
            file["Attachment-mIMEtype"] &&
            file["Attachment-mIMEtype"].length < 30
              ? file["Attachment-mIMEtype"]
              : "image/png";
          const name = file["Attachment-sourceFile"];
          const original = file["Attachment-original"];
          const thumbnail = file["Attachment-thumbnail"];
          const unFormattedCreatedOn = new Date(file["Attachment-createdOn"]);
          const createdOn = isValid(unFormattedCreatedOn)
            ? format(
                unFormattedCreatedOn,
                `${convertToDateFNSFormat(APP.LOGIN_USER_DATE_FORMAT)} HH:mm:ss`
              )
            : "";
          const size = file["Attachment-original:BinaryResource-length"];

          return {
            id,
            attachmentType,
            attachmentTypeName,
            mimeType,
            name,
            original,
            thumbnail,
            createdOn,
            unFormattedCreatedOn,
            size,
          };
        });

        // Sort fetched files by createdOn date in descending order
        const sortedFiles = fetchedFiles.sort((a, b) => {
          const dateA = new Date(a.unFormattedCreatedOn);
          const dateB = new Date(b.unFormattedCreatedOn);

          // Descending order, change to `dateA - dateB` for ascending
          return dateB - dateA;
        });

        // Update the state once with all fetched and sorted files
        setFiles(sortedFiles);
      }
    } catch (error) {
      console.error("Error fetching initial files: ", error);
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Call fetchInitialFiles when initialFilesIdList changes
    fetchInitialFiles();
  }, [initialFilesIdList]);

  const renderItem = ({ item }) => {
    return (
      <View
        style={[
          styles.fileItem,
          item.hasOwnProperty("isNewlyAdded") &&
            item["isNewlyAdded"] === true &&
            styles.newlyAddedItem,
        ]}
      >
        <View style={styles.textContainer}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.fileItemFirstRow,
              {
                color: loading ? `#b0c4de${disableOpacity}` : "#005eb8",
                textDecorationLine: loading ? "none" : "underline",
              },
            ]}
            onPress={() =>
              handlePreview(
                item,
                setIsPreviewModalVisible,
                setPreviewFileType,
                setPreviewFileUri,
                setPreviewFileTitle,
                setPreviewFileName,
                setPreviewFileMimeType,
                t
              )
            }
            disabled={loading}
          >
            {item.name}
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.fileItemSecondRow}
          >
            {item.mimeType} {item.size && "|"}{" "}
            {item.size && convertBytesToMegaBytes(item.size)}
          </Text>
          {item.createdOn && (
            <Text style={styles.fileItemThirdRow}>
              {t("created_on")} {item.createdOn}
            </Text>
          )}
          {item.createdBy && (
            <Text numberOfLines={1} ellipsizeMode="tail">
              {t("created_by")} {item.createdBy}
            </Text>
          )}
          {item.attachmentType && (
            <Text numberOfLines={1} ellipsizeMode="tail">
              {item.attachmentTypeName ?? item.attachmentType}
            </Text>
          )}
        </View>
        <View style={styles.iconContainer}>
          <CustomButton
            onPress={() => handleDelete(item)}
            icon={{
              name: "file-remove",
              library: "MaterialCommunityIcons",
              size: 24,
              color: "red",
            }}
            label=""
            backgroundColor={false}
            disabled={loading || isParentLocked}
          />
          <CustomButton
            onPress={() => handleEdit(item)}
            icon={{
              name: "file-edit",
              library: "MaterialCommunityIcons",
              size: 24,
              color: "green",
            }}
            label=""
            backgroundColor={false}
            disabled={loading || isParentLocked}
          />
          <CustomButton
            onPress={() =>
              handleDownload(item, t, setFiles, setDownloadProgressMap)
            }
            icon={{
              name: item.isDownloading
                ? "progress-download" // Icon for files currently downloading
                : "file-download", // Default icon for files
              library: "MaterialCommunityIcons",
              size: 24,
              color: "blue",
            }}
            label=""
            backgroundColor={false}
            disabled={loading || item.isDownloading}
          />
        </View>
        {/* Progress bar for download */}
        {item.isDownloading && (
          <View style={styles.progressBarContainer}>
            <View
              style={{
                width: `${
                  downloadProgressMap &&
                  downloadProgressMap.hasOwnProperty(item.id)
                    ? downloadProgressMap[item.id]
                    : 0
                }%`,
                height: 5,
                backgroundColor: "blue",
              }}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.tabContainer}>
      {/* Modal for editing file name */}
      <EditDialog
        isVisible={isEditModalVisible}
        onClose={closeEditModal}
        onConfirm={confirmEditChanges}
        title={t("edit_file_name")}
        inputsConfigs={[
          {
            id: "fileName",
            type: "text",
            initialValue: selectedFile ? selectedFile.name : "",
            validateInput: validateFileName,
          },
          {
            id: "fileType",
            type: "dropdown",
            allowBlank: true,
            queryFields: {
              fields: [
                "AttachmentType-id",
                "AttachmentType-extID",
                "AttachmentType-name",
              ],
              where: [
                {
                  fieldName: "AttachmentType-busObjCat",
                  operator: "=",
                  value: "AttachmentType",
                },
              ],
              sort: [
                {
                  property: "AttachmentType-name",
                  direction: "ASC",
                },
              ],
            },
            commonQueryParams: {
              filterQueryValue: "",
              userID: APP.LOGIN_USER_ID,
              client: parseInt(APP.LOGIN_USER_CLIENT),
              language: APP.LOGIN_USER_LANGUAGE,
              testMode: "",
              appName: JSON.stringify(getAppNameByCategory(busObjCat)),
              intStatus: JSON.stringify([INTSTATUS.ACTIVE, 1]),
              page: 1,
              start: 0,
              limit: 20,
            },
            pickerLabel: t("type"),
            initialAdditionalLabel: "",
            initialItemLabel: selectedFile
              ? selectedFile.attachmentTypeName
              : "",
            initialItemValue: selectedFile ? selectedFile.attachmentType : "",
            labelItemField: "AttachmentType-name",
            valueItemField: "AttachmentType-extID",
            additionalFields: [],
            searchFields: ["AttachmentType-name", "AttachmentType-extID"],
          },
        ]}
      />
      {/* Confirmation dialog for file deletion */}
      <ConfirmationDialog
        isVisible={isDeleteConfirmationVisible}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        message={`${fileToDelete?.name}\n${t("confirm_deletion_message")}`}
      />
      {/* Modal for previewing file*/}
      <PreviewDialog
        isVisible={isPreviewModalVisible}
        fileUri={previewFileUri}
        fileType={previewFileType}
        fileTitle={previewFileTitle}
        fileName={previewFileName}
        fileMimeType={previewFileMimeType}
        onClose={onClosePreview}
      />
      <View style={styles.header}>
        <Text style={styles.countText}>
          {files.length > 0 ? `${t("count")}: ${files.length}` : null}
        </Text>
        <View style={styles.addFileContainer}>
          <CustomButton
            onPress={pickFile}
            label={t("add_file")}
            icon={{
              name: "file-plus-outline",
              library: "MaterialCommunityIcons",
              color: "#005eb8",
            }}
            backgroundColor={false}
            labelStyle={{
              color:
                loading || isParentLocked
                  ? `#b0c4de${disableOpacity}`
                  : "#005eb8",
              textDecorationLine:
                loading || isParentLocked ? "none" : "underline",
            }}
            disabled={loading || isParentLocked}
            style={{ icon: { marginRight: 2 } }}
          />
        </View>
      </View>
      {loading && (
        <View style={styles.progressMessageContainer}>
          <Text style={common.loadingText}>{t("loading")}...</Text>
          {error && <Text>Error: {error.message}</Text>}
        </View>
      )}
      {isUpdating && (
        <View style={styles.progressMessageContainer}>
          <Text style={common.loadingText}>{t("update_in_progress")}...</Text>
        </View>
      )}
      {files.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.noFilesText}>{t("no_files")}</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.flatList}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flex: 1,
    justifyContent: "flex-start",
    backgroundColor: "#e5eef7",
  },
  progressMessageContainer: {
    paddingVertical: "4%",
    alignItems: "center",
  },
  header: {
    paddingVertical: "2%",
    paddingHorizontal: "4%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    backgroundColor: "#fff",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    marginBottom: 10,
  },
  countText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
  },
  addFileContainer: {
    justifyContent: "flex-end",
  },
  fileItem: {
    padding: "2%",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
  },
  iconContainer: {
    flex: 1 / 2,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fileItemFirstRow: {},
  fileItemSecondRow: {},
  fileItemThirdRow: {},
  newlyAddedItem: {
    backgroundColor: "#fffb6f",
  },
  progressBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ccc",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noFilesText: {
    fontSize: 18,
    color: "#555",
  },
});

export default File;
