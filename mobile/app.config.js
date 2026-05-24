module.exports = {
  expo: {
    name: 'Cairn',
    slug: 'cairn',
    version: '1.0.0',
    scheme: 'cairn',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    android: {
      package: 'com.cairn.app.slakhwani',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.cairn.app.slakhwani',
      infoPlist: {
        NSCameraUsageDescription: 'Cairn uses your camera to scan fiducial markers.',
        NSLocationWhenInUseUsageDescription: 'Cairn uses your location to show nearby markers on the map.',
        NSPhotoLibraryUsageDescription: 'Cairn needs photo access to upload marker photos.',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-system-ui',
      'expo-secure-store',
      'expo-splash-screen',
      [
        'react-native-vision-camera',
        {
          cameraPermissionText: 'Cairn uses your camera to scan Ring Tag markers.',
          enableFrameProcessors: true,
          enableCodeScanner: false,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Cairn uses your location to show nearby markers.',
        },
      ],
      '@rnmapbox/maps',
      [
        'expo-media-library',
        {
          photosPermission: 'Cairn saves Ring Tag images to your photo library.',
          savePhotosPermission: 'Cairn saves Ring Tag images to your photo library.',
          isAccessMediaLocationEnabled: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};
