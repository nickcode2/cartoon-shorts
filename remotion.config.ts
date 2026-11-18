import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Stop file noise (Finder .DS_Store, rendered output, audio work files) from triggering Studio rebuilds mid-render.
Config.overrideWebpackConfig((config) => ({
  ...config,
  watchOptions: {
    ...config.watchOptions,
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.DS_Store',
      '**/out/**',
      '**/audio/**',
      '**/scripts/**',
      '**/references/**',
      '**/characters/**',
      '**/.claude/**',
    ],
  },
}));
