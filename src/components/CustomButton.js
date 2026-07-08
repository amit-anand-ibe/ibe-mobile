import React, { useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import {
  FontAwesome,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";

import { disableOpacity } from "../styles/common";

/**
 * CustomButton component renders a customizable button with an optional icon.
 *
 * @param {Object} props - Component props.
 * @param {function} props.onPress - Callback function invoked when the button is pressed.
 * @param {string} props.label - The text label displayed on the button.
 * @param {Object} props.icon - Object containing information about the icon to be displayed,
 *                               including the name, library, size, and color.
 *                               Example: { name: "star", library: "FontAwesome", size: 18, color: "white" }
 * @param {boolean} [props.backgroundColor=true] - Boolean indicating whether to apply background color to the button.
 *                                                  Defaults to true.
 * @param {boolean} [props.disabled=false] - Boolean indicating whether the button is disabled.
 * @param {Object} [props.style] - Additional styles to be applied to the button.
 * @param {Object} [props.labelStyle] - Additional styles to be applied to the button label.
 * @param {function} [props.onLongPress] - Callback function invoked when the button is long-pressed.
 * @param {string} [props.accessibilityLabel] - A descriptive label for screen readers, enhancing accessibility for users with visual impairments.
 * @param {string} [props.accessibilityRole] - Defines the role of the button for accessibility purposes (e.g., "button"), allowing assistive technologies to convey its function to users.
 * @param {string} [props.testID] - Unique identifier for testing, enabling easy querying of this component in tests.
 * @returns {JSX.Element} - Rendered component.
 */
const CustomButton = ({
  onPress,
  label,
  icon = {}, // Default value to ensure it's always an object
  backgroundColor = true,
  disabled = false,
  style = {}, // Default value to ensure it's always an object
  labelStyle,
  onLongPress,
  accessibilityLabel,
  accessibilityRole,
  testID,
}) => {
  const [pressed, setPressed] = useState(false);
  const isIconOnly = !label;

  /**
   * Callback function invoked when the button is pressed, invokes the onPress callback.
   */
  const handlePress = () => {
    onPress();
  };

  /**
   * Callback function invoked when the button is long-pressed, invokes the onLongPress callback.
   */
  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress();
    }
  };

  // Define the icon component based on the library provided in the icon prop
  let IconComponent;
  switch (icon.library) {
    case "FontAwesome":
      IconComponent = FontAwesome;
      break;
    case "Ionicons":
      IconComponent = Ionicons;
      break;
    case "MaterialCommunityIcons":
      IconComponent = MaterialCommunityIcons;
      break;
    case "MaterialIcons":
      IconComponent = MaterialIcons;
      break;
    default:
      IconComponent = FontAwesome; // Default to FontAwesome
  }

  // Apply opacity to the icon color if disabled
  let iconColor = icon.color || "white";
  const disabledColors = {
    blue: "#000080",
    green: "#008000",
    red: "#800000",
    "#005eb8": "#b0c4de",
  };

  if (disabled && disabledColors[iconColor]) {
    iconColor = disabledColors[iconColor] + disableOpacity;
  }

  return (
    <Pressable
      style={[
        styles.button,
        isIconOnly && styles.iconOnlyButton,
        backgroundColor && {
          opacity: pressed || disabled ? 0.6 : 1,
        },
        style, // Merge additional styles passed via props
      ]}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={handlePress}
      onLongPress={handleLongPress} // Add onLongPress handler
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      testID={testID}
    >
      {/* Icon component */}
      {icon.name && (
        <IconComponent
          name={icon.name}
          size={icon.size || 18}
          color={iconColor}
          style={[
            label && { marginRight: 5 }, // Apply marginRight only if label exists
            style && style.icon,
            { opacity: pressed || disabled ? 0.6 : 1 },
          ]} // Merge icon styles
          accessibilityLabel={`${label} button`}
        />
      )}
      {/* Text label */}
      {!isIconOnly && (
        <Text
          style={[
            styles.buttonLabel,
            !backgroundColor && { color: "black" },
            labelStyle,
            { opacity: pressed || disabled ? 0.6 : 1 },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: "5%",
    paddingHorizontal: "2%",
  },
  iconOnlyButton: {
    minWidth: 40,
    minHeight: 40,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  buttonLabel: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default CustomButton;
