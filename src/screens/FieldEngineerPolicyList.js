import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import CustomBackButton from "../components/CustomBackButton";
import { fetchFieldServicePolicies } from "../utils/FieldEngineerUtils";

const FieldEngineerPolicyList = ({ navigation }) => {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headerLeft = useCallback(
    () => (
      <View style={styles.headerLeftContainer}>
        <CustomBackButton navigation={navigation} t={t} />
        <Text style={styles.headerText} numberOfLines={1} ellipsizeMode="tail">
          {t("field_engineer_configuration_policies")}
        </Text>
      </View>
    ),
    [navigation, t]
  );

  const headerRight = useCallback(
    () => (
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => navigation.navigate("FieldEngineerPolicyEdit")}
        accessibilityRole="button"
        accessibilityLabel={t("new")}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    ),
    [navigation, t]
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft,
      headerRight,
    });
  }, [headerLeft, headerRight, navigation]);

  const loadPolicies = useCallback(async ({ forceRefresh = false } = {}) => {
    try {
      const data = await fetchFieldServicePolicies({ forceRefresh });
      setPolicies(data);
    } catch (error) {
      console.error("Error loading field service policies:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPolicies({ forceRefresh: true });
    }, [loadPolicies])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPolicies({ forceRefresh: true });
  }, [loadPolicies]);

  const renderPolicy = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("FieldEngineerPolicyEdit", { policy: item })}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={item.name || item.extID}
    >
      <View style={styles.iconBox}>
        <MaterialCommunityIcons
          name="shield-check-outline"
          size={22}
          color="#005eb8"
        />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name || item.extID || t("field_engineer_untitled_policy")}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.defaultPolicy || item.defaultTemplate
            ? t("field_engineer_default_policy")
            : item.taskType || item.customerID || item.projectID || item.extID}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#8a94a6" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#005eb8" />
        </View>
      ) : (
        <FlatList
          data={policies}
          keyExtractor={(item) => `policy-${item.id || item.extID}`}
          renderItem={renderPolicy}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t("field_engineer_no_policies")}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f8fb",
  },
  headerLeftContainer: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "82%",
  },
  headerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 14,
    paddingBottom: 32,
    gap: 10,
  },
  card: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe3ee",
    padding: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#eaf2ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  cardMeta: {
    marginTop: 4,
    color: "#5f6b7a",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe3ee",
  },
  emptyText: {
    color: "#5f6b7a",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default FieldEngineerPolicyList;
