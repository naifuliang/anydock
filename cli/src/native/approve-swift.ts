// Source of the native macOS approval panel. The CLI compiles it with swiftc on first use (see approve.ts).
// Approving requires the Mac's owner (Touch ID, Apple Watch, or the login password) via LocalAuthentication, so an agent
// driving the screen (computer use) can click the button but can't complete the approval.
// Prints exactly one of: approve <signature> | approve-session <signature> | deny | timeout | unavailable
// "approve" carries a P-256 signature over --message (base64) made with this Mac's Secure Enclave key (--key), which
// only signs after Touch ID or the password. The server accepts an agent's approval only with that signature.
// Also: anydock-approve keygen <path>  → creates the Secure Enclave key at <path>, prints its public key (base64 X9.63).
export const APPROVE_SWIFT = String.raw`
import AppKit
import SwiftUI
import LocalAuthentication
import CryptoKit
import Security

if CommandLine.arguments.count >= 3 && CommandLine.arguments[1] == "keygen" {
  guard SecureEnclave.isAvailable,
        let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, [.privateKeyUsage, .userPresence], nil),
        let key = try? SecureEnclave.P256.Signing.PrivateKey(accessControl: access) else {
    print("unavailable"); exit(2)
  }
  let path = CommandLine.arguments[2]
  // The blob is only usable by this Mac's Secure Enclave, and only after Touch ID or the password.
  guard FileManager.default.createFile(atPath: path, contents: key.dataRepresentation, attributes: [.posixPermissions: 0o600]) else {
    print("unavailable"); exit(2)
  }
  print(key.publicKey.x963Representation.base64EncodedString())
  exit(0)
}

func arg(_ name: String, _ fallback: String = "") -> String {
  let a = CommandLine.arguments
  if let i = a.firstIndex(of: "--" + name), i + 1 < a.count { return a[i + 1] }
  return fallback
}
let summary = arg("summary", "Your agent wants to do something")
let agent = arg("agent", "agent")
let rule = arg("rule", "ask me")
let timeoutSeconds = Double(arg("timeout", "120")) ?? 120
let keyPath = arg("key")
let message = Data(base64Encoded: arg("message")) ?? Data()
// Optional: a second message to sign when the person approves for the whole agent session.
let sessionMessage = Data(base64Encoded: arg("message-session")) ?? Data()

// Sign with the Secure Enclave key, reusing the context the person just authenticated (no second prompt).
func sign(_ ctx: LAContext, _ data: Data) -> String? {
  guard let blob = FileManager.default.contents(atPath: keyPath),
        let key = try? SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob, authenticationContext: ctx),
        let sig = try? key.signature(for: data) else { return nil }
  return sig.rawRepresentation.base64EncodedString()
}

let accent = Color(red: 0.17, green: 0.35, blue: 1.0)
var finished = false
func finish(_ result: String) {
  if finished { return }
  finished = true
  print(result)
  fflush(stdout)
  DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { exit(0) }
}

enum Phase { case idle, authenticating, approved, denied }

final class Model: ObservableObject {
  @Published var phase: Phase = .idle
  @Published var shake: CGFloat = 0
  @Published var remaining: Double = timeoutSeconds
  @Published var message: String = ""
}

struct Shake: GeometryEffect {
  var amount: CGFloat
  var animatableData: CGFloat { get { amount } set { amount = newValue } }
  func effectValue(size: CGSize) -> ProjectionTransform {
    ProjectionTransform(CGAffineTransform(translationX: 7 * sin(amount * .pi * 4), y: 0))
  }
}

struct Blur: NSViewRepresentable {
  func makeNSView(context: Context) -> NSVisualEffectView {
    let v = NSVisualEffectView()
    v.material = .popover
    v.blendingMode = .behindWindow
    v.state = .active
    return v
  }
  func updateNSView(_ v: NSVisualEffectView, context: Context) {}
}

struct ApprovalView: View {
  @ObservedObject var model: Model
  @State private var appeared = false
  var onClose: (String) -> Void

  func approve() { approve(session: false) }
  func approveSession() { approve(session: true) }
  func approve(session: Bool) {
    model.phase = .authenticating
    model.message = ""
    let ctx = LAContext()
    ctx.localizedFallbackTitle = "Use Password…"
    var err: NSError?
    guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else {
      model.phase = .idle
      model.message = "This Mac can't verify you right now."
      return
    }
    ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: (session ? "allow for this agent session: " : "approve your agent's request: ") + summary) { ok, _ in
      DispatchQueue.main.async {
        if ok, let signature = sign(ctx, session ? sessionMessage : message) {
          withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { model.phase = .approved }
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { onClose((session ? "approve-session " : "approve ") + signature) }
        } else if ok {
          model.phase = .idle
          model.message = "This Mac's approval key is missing. Run: anydock setup"
        } else {
          model.phase = .idle
          model.message = "Not verified — nothing was approved."
          withAnimation(.linear(duration: 0.45)) { model.shake += 1 }
        }
      }
    }
  }

  func deny() {
    withAnimation(.easeOut(duration: 0.2)) { model.phase = .denied }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { onClose("deny") }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 10) {
        ZStack {
          RoundedRectangle(cornerRadius: 9).fill(model.phase == .approved ? Color.green.opacity(0.15) : accent.opacity(0.12)).frame(width: 34, height: 34)
          Image(systemName: model.phase == .approved ? "checkmark" : "key.fill")
            .font(.system(size: 15, weight: .semibold))
            .foregroundColor(model.phase == .approved ? .green : accent)
            .scaleEffect(model.phase == .approved ? 1.15 : 1)
        }
        VStack(alignment: .leading, spacing: 1) {
          Text(model.phase == .approved ? "Approved" : "Your agent is asking")
            .font(.system(size: 13.5, weight: .semibold))
          Text("AnyDock · " + agent).font(.system(size: 11.5)).foregroundColor(.secondary)
        }
        Spacer()
        if model.phase == .idle || model.phase == .authenticating {
          Text(String(Int(model.remaining)) + "s").font(.system(size: 11, design: .monospaced)).foregroundColor(.secondary)
        }
      }
      Text(summary)
        .font(.system(size: 13))
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 11).padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.primary.opacity(0.05)))
      if !model.message.isEmpty {
        Text(model.message).font(.system(size: 11.5)).foregroundColor(.red)
      }
      HStack(spacing: 8) {
        Label("Your rule: " + rule, systemImage: "lock.shield").font(.system(size: 11.5)).foregroundColor(.secondary)
          .lineLimit(2).layoutPriority(-1)
        Spacer()
        Button("Deny", action: deny).keyboardShortcut(.cancelAction).controlSize(.large).fixedSize()
          .disabled(model.phase != .idle)
        if !sessionMessage.isEmpty {
          Button("This session", action: approveSession).controlSize(.large).fixedSize()
            .help("Allow this kind of action for the rest of this agent session")
            .disabled(model.phase != .idle)
        }
        Button(action: approve) {
          HStack(spacing: 5) {
            if model.phase == .authenticating { ProgressView().controlSize(.small) } else { Image(systemName: "touchid") }
            Text("Approve")
          }
        }
        .buttonStyle(.borderedProminent).tint(accent).controlSize(.large)
        .keyboardShortcut(.defaultAction)
        .disabled(model.phase != .idle)
      }
    }
    .padding(16)
    .frame(width: 404)
    .background(Blur())
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.primary.opacity(0.08)))
    .modifier(Shake(amount: model.shake))
    .scaleEffect(appeared ? 1 : 0.94)
    .opacity(appeared ? (model.phase == .denied ? 0 : 1) : 0)
    .offset(y: appeared ? 0 : -10)
    .onAppear { withAnimation(.spring(response: 0.38, dampingFraction: 0.8)) { appeared = true } }
  }
}

final class KeyPanel: NSPanel {
  override var canBecomeKey: Bool { true }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  var panel: KeyPanel!
  let model = Model()

  func applicationDidFinishLaunching(_ n: Notification) {
    let view = ApprovalView(model: model) { result in
      self.panel.orderOut(nil)
      finish(result)
    }
    let host = NSHostingView(rootView: view.padding(20))
    host.frame.size = host.fittingSize
    panel = KeyPanel(contentRect: NSRect(origin: .zero, size: host.fittingSize), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    panel.contentView = host
    panel.isFloatingPanel = true
    panel.level = .statusBar
    panel.backgroundColor = .clear
    panel.isOpaque = false
    panel.hasShadow = false
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    if let screen = NSScreen.main {
      let f = screen.visibleFrame
      panel.setFrameTopLeftPoint(NSPoint(x: f.maxX - host.fittingSize.width + 4, y: f.maxY + 4))
    }
    panel.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    NSSound(named: NSSound.Name("Tink"))?.play()

    Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
      self.model.remaining -= 1
      if self.model.remaining <= 0 {
        t.invalidate()
        self.panel.orderOut(nil)
        finish("timeout")
      }
    }
  }
}

if !LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) {
  print("unavailable")
  exit(0)
}
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
`;
