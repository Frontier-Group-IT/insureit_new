module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      require('./plugins/ios-typography'),
      ['module-resolver', { root: ['./'], alias: { '@': './' } }],
    ],
  };
};
