import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { fetchAndCacheResource } from "./APIUtils";
import { showToast } from "./MessageUtils";

import { API_ENDPOINTS, APP } from "../constants";

/**
 * Handles the download process for a file item.
 * @param {Object} item - The file item to be downloaded.
 * @param {Function} translation - A function for translating strings.
 * @param {Function} setFiles - A function to update the file state.
 * @param {Function} setDownloadProgressMap - Function to update the download progress map.
 */
const handleDownload = async (
  item,
  translation,
  setFiles,
  setDownloadProgressMap
) => {
  try {
    console.log("Starting download process for item with id: ", item.id);

    // Set the isDownloading flag to true for the item
    item.isDownloading = true;
    updateFileState(setFiles, item.id, true);

    // Get the URI of the file to download
    const fileUri = `${API_ENDPOINTS.RESOURCE}/${item.original}?client=${APP.LOGIN_USER_CLIENT}`;
    console.log("File URI: ", fileUri);

    // Create download path
    const downloadPath = await createDownloadPath(item, false);
    console.log("Download path: ", downloadPath);

    // Download the file
    const downloadResult = await downloadFile(
      fileUri,
      downloadPath,
      setDownloadProgressMap,
      item.id, // Pass item ID to identify the download progress
      item.size // Pass item size to provide the download total size
    );
    console.log("Download result: ", JSON.stringify(downloadResult));

    // Reset download progress for the item ID
    resetDownloadProgress(setDownloadProgressMap, item.id);

    // Save via SAF on Android or share sheet on iOS to avoid broad media permissions.
    const shareResult = await shareAndDelete(downloadPath, item, translation);

    if (shareResult) {
      showToast(`${item.name}\n${translation("file_download_success")}`);
    } else {
      showToast(`${item.name}\n${translation("file_download_error")}`, "error");
    }
  } catch (error) {
    // Handle any errors that occur during the download process
    console.error("Error in downloading file: ", error);
    showToast(`${item.name}\n${translation("file_download_error")}`, "error");
  } finally {
    // Whether the download succeeds or fails, reset the isDownloading flag to false
    item.isDownloading = false;
    updateFileState(setFiles, item.id, false);
  }
};

/**
 * Creates the download path for a file item.
 * @param {Object} item - The file item for which the download path is created.
 * @returns {string} The download path for the file.
 * @throws {Error} Throws an error if unable to create the download path.
 */
const createDownloadPath = async (item) => {
  try {
    // Ensure the download directory exists
    let downloadDirectory = FileSystem.documentDirectory + "iBE/";
    await FileSystem.makeDirectoryAsync(downloadDirectory, {
      intermediates: true,
    });

    // Extract the file name from the item
    const fileName = item.name;

    // Construct the download path
    const downloadPath = `${downloadDirectory}${fileName}`;

    return downloadPath;
  } catch (error) {
    // Handle errors
    console.error("Error in creating download path: ", error);
    throw new Error("Unable to create download path.");
  }
};

/**
 * Updates the file state with the download status.
 * @param {function} setFiles - Function to update files state.
 * @param {string} id - The ID of the file.
 * @param {boolean} isDownloading - Whether the file is being downloaded.
 */
const updateFileState = (setFiles, id, isDownloading) => {
  setFiles((prevFiles) =>
    prevFiles.map((file) =>
      file.id === id ? { ...file, isDownloading } : file
    )
  );
};

/**
 * Initiates the download of a file from the specified URI to the specified download path.
 * @param {string} fileUri - The URI of the file to download.
 * @param {string} downloadPath - The path where the file will be downloaded.
 * @param {Function} setDownloadProgressMap - Function to update the download progress map.
 * @param {string} fileId - The unique identifier of the file being downloaded.
 * @param {number} fileSize - The size of the file being downloaded.
 * @returns {Promise<void>} A promise that resolves once the download is complete.
 */
const downloadFile = async (
  fileUri,
  downloadPath,
  setDownloadProgressMap,
  fileId,
  fileSize
) => {
  const downloadResumable = FileSystem.createDownloadResumable(
    fileUri,
    downloadPath,
    {},
    (downloadProgress) =>
      downloadCallback(
        downloadProgress,
        setDownloadProgressMap,
        fileId,
        fileSize
      )
  );
  return downloadResumable.downloadAsync();
};

/**
 * A callback function to track the download progress.
 * @param {Object} downloadProgress - An object containing information about the download progress.
 * @param {Function} setDownloadProgressMap - Function to update the download progress map.
 * @param {string} fileId - The unique identifier of the file being downloaded.
 * @param {number} fileSize - The size of the file being downloaded.
 */
const downloadCallback = (
  downloadProgress,
  setDownloadProgressMap,
  fileId,
  fileSize
) => {
  const progress = downloadProgress.totalBytesWritten / fileSize;
  const progressPercentage = Math.round(progress * 100);
  // Update download progress for the corresponding file ID
  setDownloadProgressMap((prevProgressMap) => ({
    ...prevProgressMap,
    [fileId]: progressPercentage,
  }));
};

/**
 * Function to share a file and then delete it asynchronously.
 *
 * @param {string} originalFilePath - The file path of the file to be shared and deleted.
 * @param {object} item - Information about the file.
 * @param {Function} translation - A function for translating strings.
 * @returns {Promise<boolean>} - A Promise that resolves with a boolean value indicating whether
 * the file has been shared and deleted successfully (true) or there was an error (false).
 */
const shareAndDelete = async (originalFilePath, item, translation) => {
  try {
    // Check platform for special handling
    if (Platform.OS === "android") {
      console.log("Android platform detected.");

      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (permissions.granted) {
        console.log("Directory permissions granted.");

        // Read the downloaded file from the cache directory
        const downloadedFileContent = await FileSystem.readAsStringAsync(
          originalFilePath,
          { encoding: FileSystem.EncodingType.Base64 }
        );

        // Create a new file in the directory obtained from SAF
        const newFileUri =
          await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            item.name,
            item.mimeType
          );

        // Write the downloaded file content to the new file
        await FileSystem.writeAsStringAsync(newFileUri, downloadedFileContent, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log("File copied successfully using SAF.");
      } else {
        console.log("Directory permissions not granted. Fallback to sharing.");

        // Permissions not granted, fallback to sharing the downloaded file
        await Sharing.shareAsync(originalFilePath, {
          dialogTitle: translation("choose_destination"),
        });
      }
    } else if (Platform.OS === "ios") {
      console.log("iOS platform detected.");

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        console.log("Sharing is available. Sharing file.");

        // Share the file using Expo's Sharing module
        await Sharing.shareAsync(originalFilePath, {
          dialogTitle: translation("choose_destination"),
        });
      } else {
        console.log("Sharing is not available on this device");
        return false;
      }
    }

    // Delete the original file
    await FileSystem.deleteAsync(originalFilePath);
    console.log("Original file deleted successfully: ", originalFilePath);

    return true; // Both sharing and deletion were successful
  } catch (error) {
    console.error("Error in sharing and deleting file: ", error);
    return false;
  }
};

/**
 * Resets the download progress for a specific item ID.
 * @param {Function} setDownloadProgressMap - Function to update the download progress map.
 * @param {string} fileId - The unique identifier of the file for which progress needs to be reset.
 */
const resetDownloadProgress = (setDownloadProgressMap, fileId) => {
  setDownloadProgressMap((prevProgressMap) => {
    const updatedProgressMap = { ...prevProgressMap };
    delete updatedProgressMap[fileId];
    return updatedProgressMap;
  });
};

/**
 * Handles the preview process for a file item.
 * @param {Object} item - The file item to be previewed.
 * @param {Function} setIsPreviewModalVisible - A function to set the visibility of the preview modal.
 * @param {Function} setPreviewFileType - A function to set the type of the file for preview.
 * @param {Function} setPreviewFileUri - A function to set the URI of the file for preview.
 * @param {Function} setPreviewFileTitle - A function to set the title of the file for preview.
 * @param {Function} translation - A function for translating strings (languages).
 */
const handlePreview = async (
  item,
  setIsPreviewModalVisible,
  setPreviewFileType,
  setPreviewFileUri,
  setPreviewFileTitle,
  setPreviewFileName,
  setPreviewFileMimeType,
  translation
) => {
  try {
    console.log("Starting preview process for item with id: ", item.id);

    // Determine the file type based on MIME type
    if (item.mimeType.startsWith("image/")) {
      setPreviewFileType("image");
    } else if (item.mimeType === "application/pdf") {
      setPreviewFileType("pdf");
    } else if (item.mimeType.startsWith("video/")) {
      setPreviewFileType("video");
    } else {
      // Handle other types of files (e.g., documents, videos)
      showToast(
        translation("preview_not_supported", { fileType: item.mimeType }),
        "error"
      );
      return;
    }

    // Set the modal visible initially
    setIsPreviewModalVisible(true);
    setPreviewFileTitle(item.name);
    setPreviewFileName(item.name || item.fileName || item.title || "");
    setPreviewFileMimeType(item.mimeType || "");

    if (item["newlyAddedFileLocalUri"]) {
      setPreviewFileUri(item["newlyAddedFileLocalUri"]);
      return;
    }

    const cachedPath = await fetchAndCacheResource(item.original);
    console.log(`Preview file path: ${cachedPath}`);

    // Set the URI for preview
    setPreviewFileUri(cachedPath);
  } catch (error) {
    // Handle any errors that occur during the preview process
    console.error("Error in previewing file: ", error);
    showToast(`${item.name}\n${translation("preview_error")}`, "error");
  }
};

export { handleDownload, handlePreview };
