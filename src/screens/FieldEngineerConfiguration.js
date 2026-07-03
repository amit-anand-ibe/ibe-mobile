import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import CustomBackButton from "../components/CustomBackButton";
import {
  fetchFieldServiceChecklistTemplates,
  fetchFieldServicePolicies,
  fetchFieldServiceReviewTemplates,
} from "../utils/FieldEngineerUtils";

const ConfigurationCard = ({ iconName, title, count, onPress }) => (
  <TouchableOpacity
    style={styles.card}
    onPress={onPress}
    activeOpacity={0.78}
    accessibilityRole="button"
    accessibilityLabel={title}
  >
    <View style={styles.cardIcon}>
      <MaterialCommunityIcons name={iconName} size={24} color="#005eb8" />
    </View>
    <View style={styles.cardText}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardMeta}>{count}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color="#8a94a6" />
  </TouchableOpacity>
);

const FieldEngineerConfiguration = ({ navigation }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    policies: 0,
    checklistTemplates: 0,
    reviewTemplates: 0,
  });

  const headerLeft = useCallback(
    () => (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton navigation={navigation} t={t} />
        <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
          {t("field_engineer_configuration")}
        </Text>
      </View>
    ),
    [navigation, t]
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft,
    });
  }, [headerLeft, navigation]);

  const loadConfigurationSummary = useCallback(
    async ({ forceRefresh = false } = {}) => {
      try {
        const [policies, checklistTemplates, reviewTemplates] =
          await Promise.all([
            fetchFieldServicePolicies({ forceRefresh }),
            fetchFieldServiceChecklistTemplates({ forceRefresh }),
            fetchFieldServiceReviewTemplates({ forceRefresh }),
          ]);

        setSummary({
          policies: policies.length,
          checklistTemplates: checklistTemplates.length,
          reviewTemplates: reviewTemplates.length,
        });
      } catch (error) {
        console.error("Error loading field service configuration:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadConfigurationSummary();
  }, [loadConfigurationSummary]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConfigurationSummary({ forceRefresh: true });
  }, [loadConfigurationSummary]);

  const cards = useMemo(
    () => [
      {
        key: "policies",
        iconName: "shield-check-outline",
        title: t("field_engineer_configuration_policies"),
        count: t("field_engineer_configuration_count", {
          count: summary.policies,
        }),
        routeName: "FieldEngineerPolicies",
      },
      {
        key: "checklists",
        iconName: "format-list-checks",
        title: t("field_engineer_configuration_checklists"),
        count: t("field_engineer_configuration_count", {
          count: summary.checklistTemplates,
        }),
        routeName: "FieldEngineerChecklistTemplates",
      },
      {
        key: "reviews",
        iconName: "file-document-outline",
        title: t("field_engineer_configuration_reviews"),
        count: t("field_engineer_configuration_count", {
          count: summary.reviewTemplates,
        }),
        routeName: "FieldEngineerReviewTemplates",
      },
    ],
    [summary, t]
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#005eb8" />
          </View>
        ) : (
          cards.map((card) => (
            <ConfigurationCard
              key={card.key}
              iconName={card.iconName}
              title={card.title}
              count={card.count}
              onPress={() => {
                if (card.routeName) {
                  navigation.navigate(card.routeName);
                }
              }}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f8fb",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  headerLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "92%",
  },
  headerText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 4,
  },
  loadingContainer: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    minHeight: 78,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#eaf2ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "700",
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#5f6b7a",
    fontWeight: "600",
  },
});

export default FieldEngineerConfiguration;
