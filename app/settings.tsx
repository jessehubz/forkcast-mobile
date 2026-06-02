import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

// ─── Keys ─────────────────────────────────────────────────────────────────────

const NOTIF_KEYS = {
  confirmed: "notif_reservation_confirmed",
  reminder: "notif_reservation_reminder",
  waitlist: "notif_waitlist_opening",
  newBooking: "notif_new_booking",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-[11px] font-bold text-d-text-dim uppercase tracking-[0.8px] mb-4">
      {title}
    </Text>
  );
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-2.5 border-b border-d-border mb-0.5">
      <Text className="text-[14px] text-d-text font-medium flex-1 pr-3">{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.maroon }}
        thumbColor={Colors.cream}
        ios_backgroundColor={Colors.border}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Password modal
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwUpdating, setPwUpdating] = useState(false);

  // Notifications
  const [notifConfirmed, setNotifConfirmed] = useState(true);
  const [notifReminder, setNotifReminder] = useState(true);
  const [notifWaitlist, setNotifWaitlist] = useState(false);
  const [notifNewBooking, setNotifNewBooking] = useState(true);

  // ─── Load profile ─────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("Profile")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data as Profile);
      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setEmail(data.email ?? user.email ?? "");
      setOriginalEmail(data.email ?? user.email ?? "");
    }

    // Load notification preferences
    try {
      const [c, r, w, b] = await Promise.all([
        AsyncStorage.getItem(NOTIF_KEYS.confirmed),
        AsyncStorage.getItem(NOTIF_KEYS.reminder),
        AsyncStorage.getItem(NOTIF_KEYS.waitlist),
        AsyncStorage.getItem(NOTIF_KEYS.newBooking),
      ]);
      if (c !== null) setNotifConfirmed(c === "true");
      if (r !== null) setNotifReminder(r === "true");
      if (w !== null) setNotifWaitlist(w === "true");
      if (b !== null) setNotifNewBooking(b === "true");
    } catch {}

    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ─── Save notification toggle ─────────────────────────────────────────────

  const saveNotif = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, String(value));
    } catch {}
  };

  // ─── Save profile ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("Profile")
        .update({ name: name.trim(), phone: phone.trim() })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      if (email.trim().toLowerCase() !== originalEmail.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) throw emailError;
        setOriginalEmail(email.trim());
        Alert.alert("Check your inbox", "A confirmation email has been sent to your new address.");
      } else {
        Alert.alert("Saved", "Your profile has been updated.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Avatar upload ────────────────────────────────────────────────────────

  const handleChangePhoto = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUploading(true);
      try {
        const uri = result.assets[0].uri;
        const ext = uri.split(".").pop();
        const fileName = `${user.id}.${ext}`;
        const formData = new FormData();
        formData.append("file", { uri, name: fileName, type: `image/${ext}` } as any);
        const { error } = await supabase.storage
          .from("avatars")
          .upload(fileName, formData, { upsert: true });
        if (error) throw error;
        Alert.alert("Done", "Avatar updated.");
      } catch (e: any) {
        Alert.alert("Upload failed", e?.message ?? "Could not upload photo.");
      } finally {
        setAvatarUploading(false);
      }
    }
  };

  // ─── Change password ──────────────────────────────────────────────────────

  const handleUpdatePassword = async () => {
    if (!newPw.trim()) {
      Alert.alert("Error", "Please enter a new password.");
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    if (newPw.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setPwUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwModalVisible(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      Alert.alert("Done", "Your password has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not update password.");
    } finally {
      setPwUpdating(false);
    }
  };

  // ─── Sign out ─────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-d-bg" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.maroonLight} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = profile?.role === "owner";
  const isDiner = profile?.role === "diner";
  const displayName = name || profile?.name || "User";

  return (
    <SafeAreaView className="flex-1 bg-d-bg" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-12"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center px-4 pt-3 pb-2 gap-2.5">
            <TouchableOpacity onPress={() => router.back()} className="p-1" activeOpacity={0.7}>
              <Text className="text-[24px] text-d-text leading-[28px]">←</Text>
            </TouchableOpacity>
            <Text className="text-[20px] font-bold text-d-text">Settings</Text>
          </View>

          {/* ── Account ── */}
          <View className="mx-5 mb-7 bg-d-surface rounded-[16px] border border-d-border p-4">
            <SectionHeader title="Account" />

            {/* Avatar */}
            <View className="items-center mb-5 gap-2">
              <View className="w-16 h-16 rounded-[32px] bg-d-surface-raised border-2 border-d-border items-center justify-center">
                <Text className="text-[22px] font-bold text-d-text">{getInitials(displayName)}</Text>
              </View>
              <TouchableOpacity
                onPress={handleChangePhoto}
                disabled={avatarUploading}
                activeOpacity={0.75}
                className="py-1 px-3"
              >
                {avatarUploading ? (
                  <ActivityIndicator color={Colors.maroonLight} size="small" />
                ) : (
                  <Text className="text-[13px] font-semibold" style={{ color: Colors.maroonLight }}>Change Photo</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Full name */}
            <View className="mb-3.5">
              <Text className="text-[11px] font-semibold text-d-text-sub mb-1.5 uppercase tracking-[0.4px]">Full Name</Text>
              <TextInput
                className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[15px] text-d-text"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={Colors.creamDim}
                autoCapitalize="words"
              />
            </View>

            {/* Phone */}
            <View className="mb-3.5">
              <Text className="text-[11px] font-semibold text-d-text-sub mb-1.5 uppercase tracking-[0.4px]">Phone Number</Text>
              <TextInput
                className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[15px] text-d-text"
                value={phone}
                onChangeText={setPhone}
                placeholder="+63 9XX XXX XXXX"
                placeholderTextColor={Colors.creamDim}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>

            {/* Email */}
            <View className="mb-3.5">
              <Text className="text-[11px] font-semibold text-d-text-sub mb-1.5 uppercase tracking-[0.4px]">Email</Text>
              <TextInput
                className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[15px] text-d-text"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.creamDim}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* Save */}
            <TouchableOpacity
              className={`bg-d-accent rounded-[12px] py-3.5 items-center justify-center min-h-[48px]${saving ? " opacity-50" : ""}`}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text className="text-[15px] font-bold text-white">Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Password ── */}
          <View className="mx-5 mb-7 bg-d-surface rounded-[16px] border border-d-border p-4">
            <SectionHeader title="Password" />
            <TouchableOpacity
              className="flex-row items-center justify-between py-3.5 px-1 rounded-[10px]"
              onPress={() => setPwModalVisible(true)}
              activeOpacity={0.75}
            >
              <Text className="text-[15px] text-d-text font-medium">Change Password</Text>
              <Text className="text-[22px] text-d-text-dim leading-[24px]">›</Text>
            </TouchableOpacity>
          </View>

          {/* ── Notifications ── */}
          <View className="mx-5 mb-7 bg-d-surface rounded-[16px] border border-d-border p-4">
            <SectionHeader title="Notifications" />

            <ToggleRow
              label="Reservation confirmed"
              value={notifConfirmed}
              onChange={(v) => {
                setNotifConfirmed(v);
                saveNotif(NOTIF_KEYS.confirmed, v);
              }}
            />
            <ToggleRow
              label="Reservation reminder (2h before)"
              value={notifReminder}
              onChange={(v) => {
                setNotifReminder(v);
                saveNotif(NOTIF_KEYS.reminder, v);
              }}
            />

            {isDiner && (
              <ToggleRow
                label="Waitlist opening"
                value={notifWaitlist}
                onChange={(v) => {
                  setNotifWaitlist(v);
                  saveNotif(NOTIF_KEYS.waitlist, v);
                }}
              />
            )}

            {isOwner && (
              <ToggleRow
                label="New booking received"
                value={notifNewBooking}
                onChange={(v) => {
                  setNotifNewBooking(v);
                  saveNotif(NOTIF_KEYS.newBooking, v);
                }}
              />
            )}
          </View>

          {/* ── Danger Zone ── */}
          <View className="mx-5 mb-7 bg-d-surface rounded-[16px] border border-d-border p-4">
            <SectionHeader title="Danger Zone" />
            <TouchableOpacity
              className="rounded-[12px] py-3.5 items-center border"
              style={{ backgroundColor: Colors.danger + "22", borderColor: Colors.danger + "55" }}
              onPress={handleSignOut}
              activeOpacity={0.85}
            >
              <Text className="text-[15px] font-bold text-d-danger">Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Password Modal ── */}
      <Modal
        visible={pwModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPwModalVisible(false)}
      >
        <View className="flex-1 bg-black/75 justify-end">
          <View
            className="bg-d-surface rounded-tl-[24px] rounded-tr-[24px] border-t border-d-border p-6"
            style={{ paddingBottom: Platform.OS === "ios" ? 40 : 24 }}
          >
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-[18px] font-bold text-d-text">Change Password</Text>
              <TouchableOpacity onPress={() => setPwModalVisible(false)}>
                <Text className="text-[18px] text-d-text-dim p-1">✕</Text>
              </TouchableOpacity>
            </View>

            <View className="mb-3.5">
              <Text className="text-[11px] font-semibold text-d-text-sub mb-1.5 uppercase tracking-[0.4px]">Current Password</Text>
              <TextInput
                className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[15px] text-d-text"
                value={currentPw}
                onChangeText={setCurrentPw}
                placeholder="••••••••"
                placeholderTextColor={Colors.creamDim}
                secureTextEntry
              />
            </View>

            <View className="mb-3.5">
              <Text className="text-[11px] font-semibold text-d-text-sub mb-1.5 uppercase tracking-[0.4px]">New Password</Text>
              <TextInput
                className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[15px] text-d-text"
                value={newPw}
                onChangeText={setNewPw}
                placeholder="••••••••"
                placeholderTextColor={Colors.creamDim}
                secureTextEntry
              />
            </View>

            <View className="mb-3.5">
              <Text className="text-[11px] font-semibold text-d-text-sub mb-1.5 uppercase tracking-[0.4px]">Confirm New Password</Text>
              <TextInput
                className="bg-d-surface-raised border border-d-border rounded-[12px] px-3.5 py-3 text-[15px] text-d-text"
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder="••••••••"
                placeholderTextColor={Colors.creamDim}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              className={`bg-d-accent rounded-[12px] py-3.5 items-center justify-center min-h-[48px] mt-2${pwUpdating ? " opacity-50" : ""}`}
              onPress={handleUpdatePassword}
              disabled={pwUpdating}
              activeOpacity={0.85}
            >
              {pwUpdating ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text className="text-[15px] font-bold text-white">Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
