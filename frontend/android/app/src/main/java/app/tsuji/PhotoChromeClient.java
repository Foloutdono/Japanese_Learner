package app.tsuji;

import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.webkit.ValueCallback;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * 写真 — the analyzer's "choose a photo", through the system photo picker.
 *
 * Capacitor answers a page's <input type=file> with the document picker
 * (ACTION_GET_CONTENT), which browses every file on the device, folders
 * and downloads included, to choose one picture. A pick of images alone
 * (the analyzer's gallery input, src/components/analysis/ImageInput.jsx)
 * goes to Android's photo picker instead: it shows the photos only, and
 * the app is handed the one the learner chose and nothing else, with no
 * media permission (the manifest declares none, as Google Play's photo
 * and video permissions policy asks). Where the system has no photo
 * picker and Play services cannot lend one, androidx opens the document
 * picker by itself.
 *
 * Everything else stays Capacitor's: the camera (an input with capture),
 * and the inputs that want files rather than photos (subtitles, an Anki
 * deck).
 */
public class PhotoChromeClient extends BridgeWebChromeClient {

    private final ActivityResultLauncher<PickVisualMediaRequest> photoPicker;
    private ValueCallback<Uri[]> pending;

    public PhotoChromeClient(Bridge bridge) {
        super(bridge);
        photoPicker = bridge.registerForActivityResult(new PickVisualMedia(), uri -> {
            ValueCallback<Uri[]> callback = pending;
            pending = null;
            // A null uri is a cancel: the page's input stays as it was.
            if (callback != null) callback.onReceiveValue(uri == null ? null : new Uri[] { uri });
        });
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams params) {
        if (
            params.isCaptureEnabled() ||
            params.getMode() != FileChooserParams.MODE_OPEN ||
            !imagesOnly(params.getAcceptTypes())
        ) {
            return super.onShowFileChooser(webView, filePathCallback, params);
        }
        // The WebView opens no second chooser while a callback is left
        // unanswered, so an earlier one is answered (as a cancel) first.
        if (pending != null) pending.onReceiveValue(null);
        pending = filePathCallback;
        try {
            photoPicker.launch(
                new PickVisualMediaRequest.Builder().setMediaType(PickVisualMedia.ImageOnly.INSTANCE).build()
            );
        } catch (ActivityNotFoundException e) {
            pending = null;
            return super.onShowFileChooser(webView, filePathCallback, params);
        }
        return true;
    }

    // image/*, image/png ... and nothing else: an empty accept is any file,
    // and an extension (.jpg) is left to the document picker that reads it.
    private static boolean imagesOnly(String[] types) {
        boolean any = false;
        for (String type : types) {
            if (type == null || type.trim().isEmpty()) continue;
            if (!type.trim().startsWith("image/")) return false;
            any = true;
        }
        return any;
    }
}
