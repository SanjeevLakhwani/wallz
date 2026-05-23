module.exports = {
  expo: {
    name: 'Wallz',
    slug: 'wallz',
    version: '1.0.0',
    scheme: 'wallz',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.wallz.app.slakhwani',
      infoPlist: {
        NSCameraUsageDescription: 'Wallz uses your camera to scan fiducial markers.',
        NSLocationWhenInUseUsageDescription: 'Wallz uses your location to show nearby markers on the map.',
        NSPhotoLibraryUsageDescription: 'Wallz needs photo access to upload marker photos.',
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
      'expo-camera',
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Wallz uses your location to show nearby markers.',
        },
      ],
      '@rnmapbox/maps',
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};
