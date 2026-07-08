import { useContext } from "react";
import { ThemeContext } from "./ThemeContext";
import { Platform } from "react-native";
import { screenDimension } from "../utils/ScreenUtils";

export const useThemeStyles = () => {
  const { theme } = useContext(ThemeContext); // Get active theme

  // Return an object containing styles for each screen
  return {
    // Common
    common: {
      container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        padding: "4%",
      },
      header: {
        headerStyle: {
          backgroundColor: theme.secondary,
        },
        headerTintColor: theme.contrastOnSecondary,
        headerTitleStyle: {
          fontWeight: "bold",
        },
      },
      loadingText: {
        color: theme.primary,
        fontWeight: "bold",
      },
    },

    // Home Screen
    home: {
      container: {
        flex: 1,
        backgroundColor: "#f7f8fa",
      },
      headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
      },
      headerRight: {
        paddingVertical: 8,
      },
      userPhoto: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: theme.contrastOnSecondary,
        marginRight: 12,
        ...Platform.select({
          ios: {
            width: 32,
            height: 32,
            borderRadius: 16,
          },
        }),
      },
      userName: {
        color: theme.contrastOnSecondary,
        fontWeight: "bold",
        fontSize: 16,
        textDecorationLine: "underline",
      },
      logoContainer: {
        paddingTop: 18,
        paddingBottom: 12,
        justifyContent: "center",
        alignItems: "center",
      },
      main: {
        flex: 1,
        width: "100%",
      },
      mainContent: {
        paddingHorizontal: 20,
        paddingBottom: 28,
      },
      card: {
        minHeight: 72,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.card.backgroundColor,
        padding: 14,
        borderWidth: 1,
        borderColor: "#edf0f4",
        borderRadius: 12,
        elevation: 2,
        shadowColor: "#111827",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        ...Platform.select({
          ios: {
            shadowOpacity: 0,
            shadowRadius: 0,
          },
        }),
      },
      pressedCard: {
        borderColor: "#1d5cff",
        backgroundColor: "#f8fbff",
      },
      cardTouchable: {
        width: "100%",
        marginBottom: 12,
        ...Platform.select({
          ios: {
            backgroundColor: theme.card.backgroundColor,
            borderRadius: 12,
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: 7 },
            shadowOpacity: 0.16,
            shadowRadius: 14,
          },
        }),
      },
      cardIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: "#f2f4f7",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
      },
      pressedCardIconContainer: {
        backgroundColor: "#eef3ff",
      },
      cardContent: {
        flex: 1,
        paddingRight: 10,
      },
      cardText: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#697282",
      },
      pressedCardText: {
        color: "#1d5cff",
      },
      cardDescription: {
        color: "#9aa2af",
        fontSize: 14,
        fontWeight: "600",
        marginTop: 3,
      },
      cardBadge: {
        position: "absolute",
        top: 8,
        right: 36,
        minWidth: 24,
        height: 24,
        borderRadius: 8,
        paddingHorizontal: 6,
        backgroundColor: "#ffd33d",
        alignItems: "center",
        justifyContent: "center",
      },
      cardBadgeText: {
        color: "#000",
        fontSize: 12,
        fontWeight: "bold",
      },
      newBadge: {
        position: "absolute",
        top: 10,
        right: 12,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: "#2f6bff",
      },
      newBadgeText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "bold",
      },
    },

    // User Preference Screen
    user: {
      container: {
        flex: 1,
        backgroundColor: theme.container.backgroundColor,
      },
      headerRightContainer: {
        width: screenDimension.width / 2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
      },
      headerLeftContainer: {
        maxWidth: screenDimension.width / 2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
      },
      headerTitle: {
        color: theme.contrastOnSecondary,
        fontSize: screenDimension.width > 400 ? 18 : 16,
        fontWeight: "bold",
      },
      preferenceContainer: {
        padding: "2%",
      },
      logoutButtonText: {
        textDecorationLine: "underline",
        fontSize: 16,
        fontWeight: "bold",
        letterSpacing: 0.5,
        color: "#000",
        alignSelf: "center",
      },
      sectionContainer: {
        marginVertical: "4%",
        padding: "4%",
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        elevation: 5,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 2,
      },
      saveButtonContainer: {
        flex: 1,
        alignItems: "flex-end",
      },
      toggleContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "2%",
      },
      toggleLabel: {
        fontSize: 16,
        flex: 1,
        paddingRight: 12,
      },
      preferenceToggleButton: {
        minHeight: 36,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 18,
        backgroundColor: "#eef2f7",
        borderWidth: 1,
        borderColor: "#d8e0ea",
        paddingLeft: 12,
        paddingRight: 7,
      },
      preferenceToggleText: {
        color: "#111827",
        fontSize: 13,
        fontWeight: "700",
        marginRight: 8,
      },
      preferenceToggleIndicator: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: "#9aa2af",
      },
      preferenceToggleIndicatorActive: {
        backgroundColor: theme.secondary,
      },
      userInfoContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 16,
        marginBottom: "2%",
      },
      userInfoLabel: {
        marginRight: 5,
        fontSize: 16,
      },
      userInfo: {
        fontWeight: "bold",
      },
      buttonLabelWhite: {
        color: "#FFFFFF",
      },
      note: {
        fontSize: 12,
        color: "#0000FF",
        marginTop: 10,
      },
      pickerLabel: {
        fontSize: 14,
        marginBottom: 5,
        fontWeight: "bold",
      },
    },
  };
};
