import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from "react-native";
import PropTypes from "prop-types";
import splashImage from "../assets/images/ibe-splash-white.png";

const SPLASH_IMAGE = splashImage;

const AppSplashScreen = ({ visible, ready, onFinish }) => {
  const rotateValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(1)).current;

  const rotateInterpolate = useMemo(
    () =>
      rotateValue.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      }),
    [rotateValue]
  );

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const rotationLoop = Animated.loop(
      Animated.timing(rotateValue, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    rotationLoop.start();

    return () => {
      rotationLoop.stop();
      rotateValue.stopAnimation();
      rotateValue.setValue(0);
    };
  }, [rotateValue, visible]);

  useEffect(() => {
    if (!visible || !ready) {
      return undefined;
    }

    const fadeTimeout = setTimeout(() => {
      Animated.timing(fadeValue, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onFinish();
        }
      });
    }, 250);

    return () => clearTimeout(fadeTimeout);
  }, [fadeValue, onFinish, ready, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { opacity: fadeValue }]}
    >
      <View style={styles.imageWrapper}>
        <Animated.Image
          source={SPLASH_IMAGE}
          style={[styles.image, { transform: [{ rotate: rotateInterpolate }] }]}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
};

AppSplashScreen.propTypes = {
  onFinish: PropTypes.func.isRequired,
  ready: PropTypes.bool.isRequired,
  visible: PropTypes.bool.isRequired,
};

const imageSource = Image.resolveAssetSource(SPLASH_IMAGE);
const imageAspectRatio =
  imageSource && imageSource.width && imageSource.height
    ? imageSource.width / imageSource.height
    : 1;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#232323",
    justifyContent: "center",
  },
  imageWrapper: {
    width: 220,
    aspectRatio: imageAspectRatio,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

export default AppSplashScreen;
