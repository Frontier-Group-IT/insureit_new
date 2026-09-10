module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],

    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],

          alias: {
            '^@/components/ui$': './components/customer-aware-ui',
            '@': './',
            '^expo-document-picker$': './lib/claim-video-document-picker',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
