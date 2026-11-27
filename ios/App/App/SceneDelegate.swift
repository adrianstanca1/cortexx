import UIKit
import Capacitor

/// Scene lifecycle + link delivery.
///
/// Capacitor's `ApplicationDelegateProxy` owns the open-URL contract: it posts
/// `CapacitorOpenURLNotification` / `CapacitorOpenUniversalLinkNotification`
/// with the dictionary payload the `@capacitor/app` plugin reads, and records
/// `lastURL` for `getLaunchUrl()`. The App plugin subscribes in `load()` and
/// delivers `appUrlOpen` with `retainUntilConsumed: true`, so a link posted
/// once the bridge exists is never lost.
///
/// Once a scene delegate is present UIKit stops calling the app delegate's
/// `application(_:open:)` / `application(_:continue:)`, so every link has to be
/// forwarded from here or `appUrlOpen` never fires.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    private var pendingURLs: [URL] = []
    private var pendingActivities: [NSUserActivity] = []
    private var deliveredLaunchLinks = false

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        // A launch from cortexx:// or a universal link arrives here, not in the
        // app delegate. Hold them until the bridge exists — posting before the
        // App plugin has subscribed would reach no observer at all.
        pendingURLs = connectionOptions.urlContexts.map { $0.url }
        pendingActivities = connectionOptions.userActivities.filter {
            $0.activityType == NSUserActivityTypeBrowsingWeb && $0.webpageURL != nil
        }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // The view controller has loaded and the bridge's plugins subscribe by
        // now, so launch links can be forwarded exactly once.
        guard !deliveredLaunchLinks else { return }
        deliveredLaunchLinks = true

        for url in pendingURLs {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }
        pendingURLs = []

        for activity in pendingActivities {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                continue: activity,
                restorationHandler: { _ in }
            )
        }
        pendingActivities = []
    }

    // MARK: - Universal Links delivered at scene connection time

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }

    // MARK: - Custom URL scheme delivered at scene connection time

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [:])
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}
    func sceneWillEnterForeground(_ scene: UIScene) {}
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
