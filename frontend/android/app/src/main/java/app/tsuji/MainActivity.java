package app.tsuji;

import android.os.Bundle;
import android.view.View;
import android.view.ViewParent;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin (plan 156), registered before the bridge
        // starts so the web app finds it on its first call.
        registerPlugin(TsujiWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        closeKeyboardGap();
    }

    // The keyboard's gap. With the keyboard up, Capacitor's SystemBars
    // pads the decor view by the whole IME inset, which runs to the foot
    // of the screen and so already covers the navigation bar, and hands
    // the bar's inset on down. Below Android 15 the window is not edge to
    // edge, and the decor's content root fits system windows: it pads by
    // that inset again. The web view then ended a navigation bar above
    // the keyboard (48dp with three buttons, a Redmi Note 10 Pro), the
    // decor's grey showing through. So the root is told the bottom bar is
    // nothing while the keyboard is up. Edge to edge (Android 15 and up)
    // the root fits nothing, and the web view, which then gets the insets,
    // is told what SystemBars's own CSS already says: no bottom inset
    // while the keyboard is up.
    private void closeKeyboardGap() {
        View decor = getWindow().getDecorView();
        View root = findViewById(android.R.id.content);
        if (root == null) return;
        ViewParent parent = root.getParent();
        while (parent instanceof View && parent != decor) {
            root = (View) parent;
            parent = root.getParent();
        }
        if (parent != decor) return;
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            if (insets.isVisible(WindowInsetsCompat.Type.ime())) {
                int bars = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
                Insets b = insets.getInsets(bars);
                insets = new WindowInsetsCompat.Builder(insets)
                    .setInsets(bars, Insets.of(b.left, b.top, b.right, 0))
                    .build();
            }
            return ViewCompat.onApplyWindowInsets(v, insets);
        });
    }
}
