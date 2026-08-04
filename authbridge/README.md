# AuthBridge Detailed RC API Test

This script follows the exact three-request flow supplied in the AuthBridge Postman collection:

1. Encrypt the plain request.
2. Submit `requestData` to Detailed RC service code 372.
3. Decrypt the returned `responseData`.

## Run on Windows

1. Open PowerShell in this folder.
2. Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Test-AuthBridgeRC.ps1
```

3. Enter a valid vehicle registration number.

You can also pass the registration number directly:

```powershell
.\Test-AuthBridgeRC.ps1 -RcNumber "HR46D1668"
```

The decrypted response is displayed and saved under:

```text
authbridge-test-output
```

## Notes

- The script uses `test@insureit.in` as the supplied UAT username.
- The dashboard password is not sent because the supplied Postman collection does not use it.
- Each call gets a unique `transID`.
- The timeout is 20 seconds, matching AuthBridge's recommendation.
- Do not share the saved response publicly because it may contain personal vehicle-owner information.
- Do not commit generated `authbridge-test-output` response files.
