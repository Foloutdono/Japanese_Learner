import AuthenticationServices
import Capacitor
import CryptoKit
import Foundation
import UIKit

// 林檎 — Sign in with Apple, on the system's own sheet (plan 295).
//
// Apple's guideline 4.8 asks an iPhone app that offers Google to offer
// an equivalent beside it, and this is it. src/lib/native.js's
// signInWithApple calls authorize() with a raw nonce; Apple is handed
// its SHA-256, which the identity token then carries, and Supabase
// hashes the raw nonce to compare (src/lib/oauth.js). The answer goes
// back as two strings: the identity token, which Supabase turns into a
// session, and the one-use authorization code, which the server keeps
// the means to revoke the grant with (backend/core/apple_signin.py).
//
// Only the email is asked for: the card's name is asked by the
// boarding, in the app's own words. A sheet the learner closes rejects
// with CANCELLED, which the web side reads as "no", not as a fault.
// The capability is the entitlement in App.entitlements, and the App
// ID's Sign In with Apple in the developer account (docs/release.md).
@objc(TsujiAppleSignInPlugin)
public class TsujiAppleSignInPlugin: CAPPlugin, CAPBridgedPlugin,
    ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "TsujiAppleSignInPlugin"
    public let jsName = "TsujiAppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    // The call waiting on the sheet, and the sheet's controller, held
    // until it answers. One at a time: a second tap supersedes the first.
    private var pending: CAPPluginCall?
    private var controller: ASAuthorizationController?

    @objc func authorize(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce"), !nonce.isEmpty else {
            call.reject("a nonce is required", "NO_NONCE")
            return
        }
        DispatchQueue.main.async {
            self.pending?.reject("superseded", "CANCELLED")
            self.pending = call
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.email]
            request.nonce = TsujiAppleSignInPlugin.sha256(nonce)
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.controller = controller
            controller.performRequests()
        }
    }

    static func sha256(_ text: String) -> String {
        SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func take() -> CAPPluginCall? {
        let call = pending
        pending = nil
        controller = nil
        return call
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window {
            return window
        }
        return ASPresentationAnchor()
    }

    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = take() else { return }
        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = credential.identityToken,
            let token = String(data: tokenData, encoding: .utf8)
        else {
            call.reject("no identity token", "NO_TOKEN")
            return
        }
        let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        call.resolve(["identityToken": token, "authorizationCode": code])
    }

    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithError error: Error) {
        guard let call = take() else { return }
        if let refusal = error as? ASAuthorizationError, refusal.code == .canceled {
            call.reject("cancelled", "CANCELLED")
        } else {
            call.reject(error.localizedDescription, "FAILED")
        }
    }
}
