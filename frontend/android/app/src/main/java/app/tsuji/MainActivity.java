package app.tsuji;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin (plan 156), registered before the bridge
        // starts so the web app finds it on its first call.
        registerPlugin(TsujiWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
