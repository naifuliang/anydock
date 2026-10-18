// Source of the native macOS artifact window (`anydock open`). The CLI compiles it with swiftc on first use.
// It shows the artifact page signed in with this Mac's AnyDock sign-in — the token arrives on stdin (never argv) and is
// handed to the page, so there's no second login. Downloads (exports) land in ~/Downloads; other sites open in the
// default browser; Present goes full screen.
// Usage: anydock-viewer --url <artifact page> --title <title>   (token on stdin)
export const VIEWER_SWIFT = String.raw`
import AppKit
import WebKit

let argv = CommandLine.arguments
func arg(_ n: String) -> String? { if let i = argv.firstIndex(of: "--" + n), i + 1 < argv.count { return argv[i + 1] }; return nil }
let start: URL = URL(string: arg("url") ?? "") ?? { print("usage: --url <url>"); exit(64) }()
let windowTitle = arg("title") ?? "AnyDock"
let token = (String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

func sameOrigin(_ u: URL) -> Bool { u.scheme == start.scheme && u.host == start.host && u.port == start.port }

final class Viewer: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
  var window: NSWindow!
  var web: WKWebView!

  func applicationDidFinishLaunching(_ n: Notification) {
    let cfg = WKWebViewConfiguration()
    let quoted = (try? String(data: JSONSerialization.data(withJSONObject: [token]), encoding: .utf8)) ?? "[\"\"]"
    cfg.userContentController.addUserScript(WKUserScript(source: "window.__ANYDOCK_TOKEN = " + quoted + "[0];", injectionTime: .atDocumentStart, forMainFrameOnly: true))
    cfg.preferences.isElementFullscreenEnabled = true
    web = WKWebView(frame: .zero, configuration: cfg)
    web.navigationDelegate = self
    web.uiDelegate = self
    web.allowsBackForwardNavigationGestures = true
    window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1200, height: 840), styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
    window.title = windowTitle
    window.contentView = web
    window.center()
    window.setFrameAutosaveName("AnyDockViewer")
    window.collectionBehavior = [.fullScreenPrimary]
    load(start)
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func load(_ u: URL) {
    var req = URLRequest(url: u)
    if !token.isEmpty { req.setValue("Bearer " + token, forHTTPHeaderField: "Authorization") }
    web.load(req)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }

  func webView(_ w: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let u = action.request.url else { return decisionHandler(.cancel) }
    if action.shouldPerformDownload { return decisionHandler(.download) }
    if u.scheme == "blob" || u.scheme == "data" || u.scheme == "about" { return decisionHandler(.allow) }
    let main = action.targetFrame?.isMainFrame ?? true
    if !main { return decisionHandler(.allow) } // the app iframe runs on its own origin
    if !sameOrigin(u) { NSWorkspace.shared.open(u); return decisionHandler(.cancel) }
    // Same site: carry the sign-in on page loads (links, reloads), like a signed-in browser would.
    if !token.isEmpty && action.request.value(forHTTPHeaderField: "Authorization") == nil && u.fragment == nil {
      decisionHandler(.cancel); load(u); return
    }
    decisionHandler(.allow)
  }

  func webView(_ w: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
  func webView(_ w: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
  func webView(_ w: WKWebView, decidePolicyFor r: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
    decisionHandler(r.canShowMIMEType ? .allow : .download)
  }

  func download(_ d: WKDownload, decideDestinationUsing r: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
    let dir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
    var dest = dir.appendingPathComponent(suggestedFilename)
    var n = 1
    while FileManager.default.fileExists(atPath: dest.path) {
      let base = (suggestedFilename as NSString).deletingPathExtension, ext = (suggestedFilename as NSString).pathExtension
      dest = dir.appendingPathComponent(base + " (" + String(n) + ")" + (ext.isEmpty ? "" : "." + ext)); n += 1
    }
    completionHandler(dest)
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { NSWorkspace.shared.activateFileViewerSelecting([dest]) }
  }

  // window.open / target=_blank: same site in this window, others in the default browser.
  func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let u = action.request.url { if sameOrigin(u) { load(u) } else { NSWorkspace.shared.open(u) } }
    return nil
  }

  func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
    let a = NSAlert(); a.messageText = message; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
    completionHandler(a.runModal() == .alertFirstButtonReturn)
  }
  func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
    let a = NSAlert(); a.messageText = message; a.runModal(); completionHandler()
  }
}

// A real menu bar, so ⌘C / ⌘V / ⌘A / ⌘Z work in the editors and ⌘W / ⌘Q close.
func buildMenu() {
  let bar = NSMenu()
  let appItem = NSMenuItem(); bar.addItem(appItem)
  let appMenu = NSMenu()
  appMenu.addItem(withTitle: "Quit AnyDock", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
  appItem.submenu = appMenu
  let editItem = NSMenuItem(); bar.addItem(editItem)
  let edit = NSMenu(title: "Edit")
  edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
  edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
  edit.addItem(.separator())
  edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
  edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
  edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
  edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
  editItem.submenu = edit
  let winItem = NSMenuItem(); bar.addItem(winItem)
  let win = NSMenu(title: "Window")
  win.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
  win.addItem(withTitle: "Reload", action: #selector(WKWebView.reload(_:)), keyEquivalent: "r")
  winItem.submenu = win
  NSApp.mainMenu = bar
}

let app = NSApplication.shared
let viewer = Viewer()
app.delegate = viewer
app.setActivationPolicy(.regular)
buildMenu()
app.run()
`;
