import Capacitor
import Foundation
import WidgetKit

// 発車案内 — the widget's figures, handed over by the web app (plan 155).
//
// The app plans them while it is open (src/lib/ahead.js's widgetPayload)
// and calls update() with the JSON; the widget extension reads it back
// from the App Group both targets share (App.entitlements,
// TsujiWidget.entitlements) and is asked to redraw. The JSON carries
// every word the widget prints, already in the learner's language. An
// empty string is a signed-out device: the widget empties.
@objc(TsujiWidgetPlugin)
public class TsujiWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TsujiWidgetPlugin"
    public let jsName = "TsujiWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    // Read by TsujiWidget/TsujiWidget.swift under the same two names.
    static let appGroup = "group.app.tsuji"
    static let storeKey = "train"

    @objc func update(_ call: CAPPluginCall) {
        let data = call.getString("data") ?? ""
        UserDefaults(suiteName: TsujiWidgetPlugin.appGroup)?.set(data, forKey: TsujiWidgetPlugin.storeKey)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
