// NOTE: This plugin is for Expo SDK 52 only (SDK 53+ generates ReactNativeHostWrapper automatically).
// It is kept here for reference but is NOT added to app.json plugins.
// For SDK 54+, expo-modules-core provides expo.modules.ReactNativeHostWrapper directly.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withInjectHostWrapper(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const srcDir = path.join(
        config.modRequest.projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'emz',
        'app'
      );

      if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
      }

      const filePath = path.join(srcDir, 'ReactNativeHostWrapper.kt');

      // Only write if it doesn't already exist — SDK 54 generates this via expo-modules-core
      if (fs.existsSync(filePath)) {
        console.log('[withInjectHostWrapper] ReactNativeHostWrapper.kt already exists — skipping');
        return config;
      }

      const contents = `package com.emz.app

import android.app.Application
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage

class ReactNativeHostWrapper(application: Application) : ReactNativeHost(application) {

  override fun getUseDeveloperSupport(): Boolean {
    return BuildConfig.DEBUG
  }

  override fun getJSMainModuleName(): String {
    return "index"
  }

  override fun getPackages(): List<ReactPackage> {
    return PackageList(application).packages
  }
}
`;

      fs.writeFileSync(filePath, contents, 'utf8');
      console.log('[withInjectHostWrapper] Wrote ReactNativeHostWrapper.kt → ' + filePath);

      return config;
    },
  ]);
}

module.exports = withInjectHostWrapper;
