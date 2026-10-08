const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const appDirectory = path.join(__dirname, '..', '..', 'apps', 'mobile-app');
const expo = JSON.parse(fs.readFileSync(path.join(appDirectory, 'app.json'), 'utf8')).expo;
const servicesPath = path.resolve(appDirectory, expo.android.googleServicesFile || '');
const firebase = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));

test('Expo Android references the supplied Firebase client configuration', () => {
  assert.equal(expo.android.package, 'com.insureit.mobile');
  assert.equal(expo.android.googleServicesFile, './google-services.json');
  assert.equal(firebase.project_info.project_id, 'insureit-customer-auth');
  const androidClients = firebase.client.filter(client =>
    client.client_info?.android_client_info?.package_name === expo.android.package
  );
  assert.equal(androidClients.length, 1);
  assert.equal(androidClients[0].client_info.mobilesdk_app_id, '1:637733440182:android:272f433664571de5293417');
});
test('Firebase Android client config contains no Firebase Admin credentials', () => {
  assert.equal(firebase.private_key, undefined);
  assert.equal(firebase.private_key_id, undefined);
  assert.equal(firebase.client_email, undefined);
});
