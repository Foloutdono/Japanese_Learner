import Capacitor
import UIKit

// The bridge, with the app's own plugin registered on it (plan 156).
// Capacitor finds the npm plugins through Swift Package Manager; a
// plugin that lives in the app target has to be handed over here.
class TsujiBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(TsujiWidgetPlugin())
    }
}
