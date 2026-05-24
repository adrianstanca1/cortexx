import Capacitor
import UIKit

/// Cortexx — Deep link router plugin.
///
/// Intercepts cortexx:// custom scheme URLs and cortexbuildpro.com Universal Links,
/// then forwards them to the web layer as Capacitor events.
///
/// Supported routes:
///   cortexx://project/:id        → opens project detail
///   cortexx://task/:id           → opens task detail
///   cortexx://invoice/:id        → opens invoice
///   cortexx://action/task        → opens new task sheet
///   cortexx://action/receipt     → opens receipt scanner
///   cortexx://action/ai          → opens Cortex AI
///   cortexx://action/clock       → opens check-in
///
/// JS usage:
///   Capacitor.Plugins.CortexxDeepLink.addListener('deepLink', (data) => {
///     const { url, path, params } = data;
///     // route inside the app
///   });
@objc(CortexxDeepLinkPlugin)
public class CortexxDeepLinkPlugin: CAPPlugin {

    override public func load() {
        // Listen for URL open events forwarded from AppDelegate / SceneDelegate
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleOpenURL(_:)),
            name: NSNotification.Name("CAPNotificationOpenURL"),
            object: nil
        )
    }

    @objc private func handleOpenURL(_ notification: Notification) {
        guard let url = notification.object as? URL else { return }
        let parsed = parseURL(url)
        notifyListeners("deepLink", data: parsed)
    }

    @objc func getLastDeepLink(_ call: CAPPluginCall) {
        // Returns the last deep link that launched the app (if any)
        if let url = UserDefaults.standard.url(forKey: "cortexx_last_deep_link") {
            call.resolve(parseURL(url))
        } else {
            call.resolve(["url": "", "path": "", "params": [:]])
        }
    }

    // MARK: - URL parser

    private func parseURL(_ url: URL) -> [String: Any] {
        var params: [String: String] = [:]

        if let components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            components.queryItems?.forEach { item in
                params[item.name] = item.value ?? ""
            }
        }

        // Store for next launch
        UserDefaults.standard.set(url, forKey: "cortexx_last_deep_link")

        return [
            "url": url.absoluteString,
            "scheme": url.scheme ?? "",
            "host": url.host ?? "",
            "path": url.path,
            "params": params
        ]
    }
}
