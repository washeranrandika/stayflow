/**
 * StayFlow Mobile – Premium Animated Splash & App Boot Screen
 * Features 60fps native animated logo spring, glow pulse, progress fill,
 * dynamic status step transitions, and smooth fade-out navigation.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Image,
  StatusBar,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { Sparkles, ShieldCheck } from "lucide-react-native";

const { width, height } = Dimensions.get("window");

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

  // Animation values
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const textTranslateY = useRef(new Animated.Value(24)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const screenFade = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;

  // Status subtitle state
  const [bootStatus, setBootStatus] = useState("Initializing StayFlow Engine...");
  const [isReadyToNavigate, setIsReadyToNavigate] = useState(false);

  useEffect(() => {
    initialize();

    // 1. Entrance choreography
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(textTranslateY, {
            toValue: 0,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(badgeScale, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    // 2. Looping Glow Pulse behind logo
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(pulseScale, {
          toValue: 1.45,
          duration: 1800,
          easing: Easing.out(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: 1800,
          easing: Easing.out(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 3. Progress bar animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1400,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // 4. Sequential status text updates
    const t1 = setTimeout(() => setBootStatus("Verifying Security Credentials..."), 450);
    const t2 = setTimeout(() => setBootStatus("Syncing Property & Room Engine..."), 900);
    const t3 = setTimeout(() => {
      setBootStatus("Welcome to StayFlow");
      setIsReadyToNavigate(true);
    }, 1350);

    return () => {
      pulseLoop.stop();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Handle navigation once loading finishes and min display time completes
  useEffect(() => {
    if (!isLoading && isReadyToNavigate) {
      Animated.timing(screenFade, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (isAuthenticated) {
          router.replace("/(tabs)/dashboard");
        } else {
          router.replace("/login");
        }
      });
    }
  }, [isLoading, isReadyToNavigate, isAuthenticated]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenFade }]}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" translucent />

      {/* Ambient background glow orbs */}
      <View style={styles.topOrb} />
      <View style={styles.bottomOrb} />

      {/* Main Center Content */}
      <View style={styles.centerContainer}>
        {/* Animated Glow Pulse Ring */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
            },
          ]}
        />

        {/* Brand Logo with Elevation & Border */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require("../assets/icon.jpg")}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Brand Typography */}
        <Animated.View
          style={[
            styles.brandTextContainer,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <View style={styles.titleRow}>
            <Text style={styles.brandTitle}>StayFlow</Text>
            <Animated.View style={[styles.pmsBadge, { transform: [{ scale: badgeScale }] }]}>
              <Sparkles size={11} color="#60a5fa" />
              <Text style={styles.pmsBadgeText}>PMS</Text>
            </Animated.View>
          </View>
          <Text style={styles.brandSubtitle}>Hotel & Property Management System</Text>
        </Animated.View>
      </View>

      {/* Bottom Loading Progress Indicator */}
      <Animated.View style={[styles.bottomContainer, { opacity: textOpacity }]}>
        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
        </View>

        <Text style={styles.statusText}>{bootStatus}</Text>

        <View style={styles.securityRow}>
          <ShieldCheck size={13} color="#475569" />
          <Text style={styles.securityText}>Encrypted & Multi-Tenant PMS</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090d16",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: height * 0.08,
  },

  // Ambient Glow Orbs
  topOrb: {
    position: "absolute",
    top: -height * 0.1,
    right: -width * 0.2,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  bottomOrb: {
    position: "absolute",
    bottom: -height * 0.1,
    left: -width * 0.2,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    backgroundColor: "rgba(99, 102, 241, 0.10)",
  },

  // Center Content
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: "#3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  logoWrapper: {
    width: 104,
    height: 104,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "#1e293b",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },

  // Brand Typography
  brandTextContainer: {
    alignItems: "center",
    marginTop: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  pmsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(37, 99, 235, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pmsBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#93c5fd",
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
    marginTop: 6,
    letterSpacing: 0.2,
  },

  // Bottom Loading Area
  bottomContainer: {
    width: "80%",
    alignItems: "center",
    gap: 12,
  },
  progressBarTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 3,
    shadowColor: "#60a5fa",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#cbd5e1",
    letterSpacing: 0.1,
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  securityText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
