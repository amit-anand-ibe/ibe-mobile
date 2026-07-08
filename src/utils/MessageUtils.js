import Toast from "react-native-root-toast";
import { Platform } from "react-native";

// Internal queue to manage toast messages
let toastQueue = [];
let isToastVisible = false;

/**
 * Displays a toast message using the React Native Root Toast library.
 * Toast messages are queued to ensure they are displayed sequentially.
 *
 * @param {string} message - The message to be displayed in the toast.
 * @param {string} type - The type of the toast message. Possible values are 'information', 'warning', or 'error'. Default is 'information'.
 * @param {object} props - Additional props to be passed to the Toast component.
 */
const showToast = (message, type = "information", props) => {
  if (!Toast) {
    console.warn("Toast library not properly initialized.");
    return;
  }

  // Check if the message is already in the queue
  if (toastQueue.some((item) => item.message === message)) {
    return;
  }

  // Add the new message to the queue
  toastQueue.push({ message, type, props });

  // If no toast is currently visible, display the first message in the queue
  if (!isToastVisible) {
    displayNextToast();
  }
};

/**
 * Displays the next toast message in the queue.
 * Toast messages are displayed sequentially and removed from the queue after being shown.
 */
const displayNextToast = () => {
  if (toastQueue.length > 0) {
    const { message, type, props } = toastQueue[0];
    let duration = Toast.durations.SHORT; // Default duration

    // Determine background color and text color based on the type of message
    let backgroundColor, textColor;
    if (type === "information") {
      backgroundColor = "#007bff"; // Bootstrap blue
      textColor = "#fff";
    } else if (type === "warning") {
      backgroundColor = "#ffc107"; // Bootstrap yellow
      textColor = "#000";
      duration = Toast.durations.LONG; // Longer duration for warnings
    } else if (type === "error") {
      backgroundColor = "#dc3545"; // Bootstrap red
      textColor = "#fff";
      duration = Toast.durations.LONG; // Longer duration for errors
    }

    // Adjust the duration if the message is longer than 100 characters
    if (message.length > 100) {
      duration = 5000; // Show for 10 seconds if the message is long
    }

    // Display the toast
    Toast.show(message, {
      backgroundColor,
      textColor,
      duration,
      position: Platform.OS === "ios" ? -68 : -64,
      ...props,
      onHidden: () => {
        // Remove the displayed message from the queue
        toastQueue.shift();

        // Set flag to indicate that no toast is currently visible
        isToastVisible = false;

        // Display the next message in the queue
        displayNextToast();
      },
    });

    // Set flag to indicate that a toast is currently visible
    isToastVisible = true;
  }
};

export { showToast };
