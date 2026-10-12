import fs from "node:fs";
import assert from "node:assert/strict";
const menu=fs.readFileSync("components/customer-portal/customer-header-actions.tsx","utf8");
const layout=fs.readFileSync("app/customer/(protected)/layout.tsx","utf8");
const employee=fs.readFileSync("components/user-menu.tsx","utf8");
for(const token of [
  'Camera','Change profile photo','image/jpeg,image/png,image/webp',
  'MAX_AVATAR_BYTES = 2 * 1024 * 1024','window.localStorage.getItem(avatarKey(userId))',
  'window.localStorage.setItem(avatarKey(userId), result)',
  'reader.readAsDataURL(file)','fileInputRef.current?.click()',
  'href="/customer/profile"','/api/customer/auth/session',
]) assert.ok(menu.includes(token), `Customer camera regression failed: ${token}`);
assert.ok(menu.includes('insureit:user-avatar:'), "Use employee-compatible avatar storage key");
assert.ok(layout.includes('userId={user.id}'), "Avatar must scope to authenticated user, not customer account");
assert.ok(employee.includes('MAX_AVATAR_BYTES = 2 * 1024 * 1024'), "Employee profile photo reference altered");
assert.ok(!menu.includes('supabase.storage'), "Do not silently turn browser-local photos into remote uploads");
console.log("Customer profile camera regression passed");
