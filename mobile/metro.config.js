// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// The app shares pure-TypeScript rules with the website (task permissions,
// statuses, labels) instead of copying them. `@shared/*` maps to the website's
// `lib/` folder (see tsconfig.json), which lives outside this project, so Metro
// has to watch it. Only import files with no Prisma or Next.js dependencies.
config.watchFolders = [path.resolve(__dirname, '../lib')];

// withUniwindConfig must stay the outermost wrapper.
module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
