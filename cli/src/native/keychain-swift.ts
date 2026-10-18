// Source of the tiny macOS Keychain helper that holds the AnyDock sign-in token. Compiled with swiftc on first use.
// Items it creates trust only this binary, so other programs (including `security find-generic-password`) can't read
// the token without macOS asking the person for their password. Kept separate from the approval panel and rarely
// changed: a rebuilt binary is a different app to the Keychain.
// Usage: anydock-keychain get|set|delete <service> <account>   (set reads the secret from stdin)
export const KEYCHAIN_SWIFT = String.raw`
import Foundation
import Security

let a = CommandLine.arguments
guard a.count == 4 else { exit(64) }
let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: a[2], kSecAttrAccount as String: a[3]]
switch a[1] {
case "get":
  var q = base
  q[kSecReturnData as String] = true
  q[kSecMatchLimit as String] = kSecMatchLimitOne
  var out: CFTypeRef?
  let s = SecItemCopyMatching(q as CFDictionary, &out)
  if s == errSecSuccess, let d = out as? Data { FileHandle.standardOutput.write(d); exit(0) }
  exit(s == errSecItemNotFound ? 1 : 2)
case "set":
  let d = FileHandle.standardInput.readDataToEndOfFile()
  SecItemDelete(base as CFDictionary)
  var q = base
  q[kSecValueData as String] = d
  q[kSecAttrLabel as String] = "AnyDock sign-in"
  q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
  exit(SecItemAdd(q as CFDictionary, nil) == errSecSuccess ? 0 : 2)
case "delete":
  let s = SecItemDelete(base as CFDictionary)
  exit(s == errSecSuccess || s == errSecItemNotFound ? 0 : 2)
default:
  exit(64)
}
`;
