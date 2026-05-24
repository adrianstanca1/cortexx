import Capacitor
import UIKit

/// Cortexx — Enhanced haptics plugin.
///
/// Supplements @capacitor/haptics with Cortexx-specific patterns
/// (success, warning, error, selection, heavy impact).
///
/// JS usage:
///   Capacitor.Plugins.CortexxHaptics.impact({ style: 'medium' });
///   Capacitor.Plugins.CortexxHaptics.notification({ type: 'success' });
///   Capacitor.Plugins.CortexxHaptics.selection();
@objc(CortexxHapticsPlugin)
public class CortexxHapticsPlugin: CAPPlugin {

    @objc func impact(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "medium"
        DispatchQueue.main.async {
            let feedbackStyle: UIImpactFeedbackGenerator.FeedbackStyle
            switch style {
            case "light":   feedbackStyle = .light
            case "heavy":   feedbackStyle = .heavy
            case "rigid":   feedbackStyle = .rigid
            case "soft":    feedbackStyle = .soft
            default:        feedbackStyle = .medium
            }
            let generator = UIImpactFeedbackGenerator(style: feedbackStyle)
            generator.prepare()
            generator.impactOccurred()
            call.resolve()
        }
    }

    @objc func notification(_ call: CAPPluginCall) {
        let type = call.getString("type") ?? "success"
        DispatchQueue.main.async {
            let feedbackType: UINotificationFeedbackGenerator.FeedbackType
            switch type {
            case "warning": feedbackType = .warning
            case "error":   feedbackType = .error
            default:        feedbackType = .success
            }
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(feedbackType)
            call.resolve()
        }
    }

    @objc func selection(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let generator = UISelectionFeedbackGenerator()
            generator.prepare()
            generator.selectionChanged()
            call.resolve()
        }
    }

    /// Cortexx-specific patterns: "taskComplete", "invoiceSent", "checkIn", "snagRaised"
    @objc func pattern(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "taskComplete"
        DispatchQueue.main.async {
            switch name {
            case "taskComplete":
                // Double tap — success
                let g = UINotificationFeedbackGenerator()
                g.notificationOccurred(.success)
            case "invoiceSent":
                // Light then medium
                let g1 = UIImpactFeedbackGenerator(style: .light)
                g1.impactOccurred()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                    let g2 = UIImpactFeedbackGenerator(style: .medium)
                    g2.impactOccurred()
                }
            case "checkIn":
                // Heavy single
                let g = UIImpactFeedbackGenerator(style: .heavy)
                g.impactOccurred()
            case "snagRaised":
                // Warning
                let g = UINotificationFeedbackGenerator()
                g.notificationOccurred(.warning)
            default:
                let g = UIImpactFeedbackGenerator(style: .medium)
                g.impactOccurred()
            }
            call.resolve()
        }
    }
}
