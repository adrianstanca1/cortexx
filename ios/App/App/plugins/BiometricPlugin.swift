import Capacitor
import LocalAuthentication

/// Cortexx — Native biometric unlock plugin.
///
/// Exposed to JavaScript as `window.CortexxNative.biometric.*`
/// via the Capacitor bridge.
///
/// Usage from JS:
///   const result = await Capacitor.Plugins.CortexxBiometric.authenticate({ reason: "Unlock Cortexx" });
///   if (result.success) { /* unlock */ }
@objc(CortexxBiometricPlugin)
public class CortexxBiometricPlugin: CAPPlugin {

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        var biometryType = "none"
        if available {
            switch context.biometryType {
            case .faceID:  biometryType = "faceID"
            case .touchID: biometryType = "touchID"
            default:       biometryType = "none"
            }
        }

        call.resolve([
            "isAvailable": available,
            "biometryType": biometryType,
            "errorCode": error?.code ?? 0
        ])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Unlock Cortexx"
        let context = LAContext()
        context.localizedFallbackTitle = "Use Passcode"

        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: reason
        ) { success, error in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["success": true])
                } else {
                    let code = (error as? LAError)?.code.rawValue ?? -1
                    call.resolve([
                        "success": false,
                        "errorCode": code,
                        "errorMessage": error?.localizedDescription ?? "Authentication failed"
                    ])
                }
            }
        }
    }

    @objc func authenticateWithPasscodeFallback(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Unlock Cortexx"
        let context = LAContext()
        context.localizedFallbackTitle = "Use Passcode"

        context.evaluatePolicy(
            .deviceOwnerAuthentication,   // allows passcode fallback
            localizedReason: reason
        ) { success, error in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["success": true])
                } else {
                    let code = (error as? LAError)?.code.rawValue ?? -1
                    call.resolve([
                        "success": false,
                        "errorCode": code,
                        "errorMessage": error?.localizedDescription ?? "Authentication failed"
                    ])
                }
            }
        }
    }
}
