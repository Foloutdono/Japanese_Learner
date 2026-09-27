package app.tsuji;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 発車案内 — the widget's figures, handed over by the web app (plan 155).
 *
 * The app plans them while it is open (src/lib/ahead.js's widgetPayload)
 * and calls update() with the JSON; the widget reads it back while the
 * app is shut. The JSON carries every word the widget prints, already in
 * the learner's language, so nothing here needs a string of its own. An
 * empty string is a signed-out device: the widget empties.
 */
@CapacitorPlugin(name = "TsujiWidget")
public class TsujiWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data", "");
        TrainWidget.store(getContext(), data);
        TrainWidget.redrawAll(getContext());
        call.resolve();
    }
}
