import Capacitor
import UIKit

// The bridge, with the app's own plugins registered on it: the widget's
// (plan 156) and Sign in with Apple's (plan 321).
// Capacitor finds the npm plugins through Swift Package Manager; a
// plugin that lives in the app target has to be handed over here.
class TsujiBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(TsujiWidgetPlugin())
        bridge?.registerPluginInstance(TsujiAppleSignInPlugin())
    }
}
