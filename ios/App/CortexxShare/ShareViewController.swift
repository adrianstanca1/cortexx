import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

/// Cortexx Share Extension
///
/// Allows users to share photos, PDFs, and URLs from other apps directly into Cortexx.
/// The shared item is saved to the App Group container, then the main app reads it on next launch.
///
/// Supported types:
///   - Images (JPEG/PNG) → added to Receipt Scanner or Snag photo picker
///   - PDFs              → added to Documents
///   - URLs              → added to RFI / Links
///   - Text              → added to Notes / Tasks
class ShareViewController: UIViewController {

    private let appGroupID = "group.com.cortexbuild.app"
    private let mainAppScheme = "cortexx"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.09, alpha: 1)
        processSharedItems()
    }

    private func processSharedItems() {
        guard let extensionContext = extensionContext,
              let inputItems = extensionContext.inputItems as? [NSExtensionItem] else {
            completeRequest()
            return
        }

        let group = DispatchGroup()
        var savedItems: [[String: String]] = []

        for item in inputItems {
            for provider in (item.attachments ?? []) {
                if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { data, _ in
                        defer { group.leave() }
                        if let url = data as? URL, let saved = self.saveToShared(url: url, type: "image") {
                            savedItems.append(saved)
                        } else if let image = data as? UIImage, let saved = self.saveImageToShared(image) {
                            savedItems.append(saved)
                        }
                    }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.pdf.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.pdf.identifier, options: nil) { data, _ in
                        defer { group.leave() }
                        if let url = data as? URL, let saved = self.saveToShared(url: url, type: "pdf") {
                            savedItems.append(saved)
                        }
                    }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { data, _ in
                        defer { group.leave() }
                        if let url = data as? URL {
                            savedItems.append(["type": "url", "value": url.absoluteString])
                        }
                    }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { data, _ in
                        defer { group.leave() }
                        if let text = data as? String {
                            savedItems.append(["type": "text", "value": text])
                        }
                    }
                }
            }
        }

        group.notify(queue: .main) {
            self.persistSharedItems(savedItems)
            self.openMainApp()
            self.completeRequest()
        }
    }

    private func saveToShared(url: URL, type: String) -> [String: String]? {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else { return nil }

        let dest = container
            .appendingPathComponent("SharedInbox", isDirectory: true)
            .appendingPathComponent(url.lastPathComponent)

        try? FileManager.default.createDirectory(
            at: dest.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try? FileManager.default.copyItem(at: url, to: dest)
        return ["type": type, "path": dest.path, "name": url.lastPathComponent]
    }

    private func saveImageToShared(_ image: UIImage) -> [String: String]? {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ),
        let data = image.jpegData(compressionQuality: 0.85) else { return nil }

        let filename = "shared_\(Int(Date().timeIntervalSince1970)).jpg"
        let dest = container
            .appendingPathComponent("SharedInbox", isDirectory: true)
            .appendingPathComponent(filename)

        try? FileManager.default.createDirectory(
            at: dest.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try? data.write(to: dest)
        return ["type": "image", "path": dest.path, "name": filename]
    }

    private func persistSharedItems(_ items: [[String: String]]) {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else { return }

        let queueFile = container.appendingPathComponent("shared_queue.json")
        var queue: [[String: String]] = []

        if let existing = try? Data(contentsOf: queueFile),
           let decoded = try? JSONSerialization.jsonObject(with: existing) as? [[String: String]] {
            queue = decoded
        }

        queue.append(contentsOf: items)

        if let data = try? JSONSerialization.data(withJSONObject: queue) {
            try? data.write(to: queueFile)
        }
    }

    private func openMainApp() {
        guard let url = URL(string: "\(mainAppScheme)://share/inbox") else { return }
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url, options: [:], completionHandler: nil)
                return
            }
            responder = responder?.next
        }
    }

    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}
