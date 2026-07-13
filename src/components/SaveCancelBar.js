import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomButton from "./CustomButton";

/**
 * SaveCancelBar component renders a bar with Save and Cancel buttons.
 *
 * @param {Object} props - Component props.
 * @param {function} props.onSave - Callback function invoked when the Save button is pressed.
 * @param {function} props.onCancel - Callback function invoked when the Cancel button is pressed.
 * @param {string} props.saveLabel - The text label for the Save button.
 * @param {string} props.cancelLabel - The text label for the Cancel button.
 * @param {string} props.saveIcon - The name of the icon for the Save button.
 * @param {string} props.cancelIcon - The name of the icon for the Cancel button.
 * @param {boolean} props.saveDisabled - Whether the Save button is disabled.
 * @param {boolean} props.cancelDisabled - Whether the Cancel button is disabled.
 * @param {boolean} props.isFloating - Determines whether buttons are displayed as floating buttons or not.
 * @param {string} [props.accessibilityLabel] - Optional accessibility label for screen readers to describe the buttons.
 * @param {string} [props.accessibilityRole] - Optional accessibility role to define the component’s purpose for assistive technologies.
 * @param {string} [props.testID] - Optional test identifier for targeting the component in tests.
 * @returns {JSX.Element} - Rendered component.
 */
const SaveCancelBar = ({
  onSave,
  onCancel,
  saveLabel = "",
  cancelLabel = "",
  saveIcon,
  cancelIcon,
  saveDisabled,
  cancelDisabled,
  isFloating = false,
  accessibilityLabel,
  accessibilityRole,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const floatingContainerStyle = [
    styles.floatingContainer,
    { bottom: Math.max(insets.bottom, 24) + 20 },
  ];
  const saveIconProps = isFloating
    ? { name: saveIcon, size: 32 }
    : { name: saveIcon };

  const cancelIconProps = isFloating
    ? { name: cancelIcon, size: 32 }
    : { name: cancelIcon };

  return (
    <View
      style={isFloating ? floatingContainerStyle : styles.barContainer}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      testID={testID}
    >
      {/* Save button */}
      <CustomButton
        onPress={onSave}
        label={saveLabel}
        icon={saveIconProps}
        disabled={saveDisabled}
        style={isFloating ? styles.floatingButton : styles.barButton}
      />
      {/* Separator (only for bar layout) */}
      {!isFloating && <View style={styles.separator} />}
      {/* Cancel button */}
      <CustomButton
        onPress={onCancel}
        label={cancelLabel}
        icon={cancelIconProps}
        disabled={cancelDisabled}
        style={isFloating ? styles.floatingButton : styles.barButton}
      />
    </View>
  );
};

// Styles for the component
const styles = StyleSheet.create({
  barContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#005eb8",
    width: "100%",
  },
  floatingContainer: {
    position: "absolute",
    right: 20,
    alignItems: "center",
  },
  barButton: {
    flex: 1,
  },
  floatingButton: {
    marginBottom: 10,
    width: 50,
    height: 50,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#005eb8",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  separator: {
    height: "100%",
    width: 1,
    backgroundColor: "white",
  },
});

export default SaveCancelBar;
