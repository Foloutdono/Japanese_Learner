package app.tsuji;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * 発車案内 — the day's train on the home screen (plan 156).
 *
 * Android phones have no lock-screen widgets, so the widget the iPhone
 * wears on its lock screen lives here on the home screen: the cards the
 * gate holds and what they take, a stripe of the lines they come from,
 * a word the learner already knows, and Depart. Everything it prints
 * comes from the JSON TsujiWidgetPlugin stored (src/lib/ahead.js's
 * widgetPayload): a count for now and one for the turn of each day
 * ahead, so a widget left alone for a day still shows the day's train.
 *
 * The word changes every WORD_EVERY_MS without the app: the system
 * redraws the widget on the period widget_train_info.xml sets, and the
 * word is picked from the clock.
 */
public class TrainWidget extends AppWidgetProvider {

    private static final String PREFS = "tsuji_widget";
    private static final String KEY = "data";
    private static final long WORD_EVERY_MS = 3L * 60 * 60 * 1000;
    // The deep link the web app reads (src/lib/platform.js's openPath).
    private static final Uri OPEN_TODAY = Uri.parse("app.tsuji://open/today");

    /** The lines' pigments, index.css's --line-* in the dark theme: the
     *  widget is drawn on sumi whatever the phone's theme. */
    private static int lineColor(String line) {
        switch (line) {
            case "kana": return Color.parseColor("#c1442c");
            case "vocab": return Color.parseColor("#3f6d8e");
            case "kanji": return Color.parseColor("#7c6a9c");
            case "grammar": return Color.parseColor("#6b8a4a");
            case "personal": return Color.parseColor("#9c4a5e");
            default: return Color.parseColor("#575060");
        }
    }

    static void store(Context context, String data) {
        prefs(context).edit().putString(KEY, data == null ? "" : data).apply();
    }

    static void redrawAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TrainWidget.class));
        if (ids.length == 0) return;
        RemoteViews views = render(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews views = render(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static RemoteViews render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_train);
        views.setOnClickPendingIntent(R.id.widget_root, openToday(context));
        views.setOnClickPendingIntent(R.id.widget_depart, openToday(context));

        JSONObject data = null;
        String raw = prefs(context).getString(KEY, "");
        if (raw != null && !raw.isEmpty()) {
            try {
                data = new JSONObject(raw);
            } catch (JSONException e) {
                data = null;
            }
        }
        if (data == null) {
            // Signed out, or the app not opened since it was installed:
            // the name alone, and a tap opens the app.
            views.setTextViewText(R.id.widget_title, context.getString(R.string.app_name));
            views.setViewVisibility(R.id.widget_figures, View.GONE);
            views.setViewVisibility(R.id.widget_word, View.GONE);
            views.setViewVisibility(R.id.widget_stripe, View.GONE);
            views.setViewVisibility(R.id.widget_depart, View.GONE);
            return views;
        }

        long now = System.currentTimeMillis();
        JSONObject labels = data.optJSONObject("labels");
        JSONArray points = data.optJSONArray("points");
        int at = pointAt(points, now);
        JSONObject point = at < 0 ? null : points.optJSONObject(at);
        int total = point == null ? 0 : point.optInt("total", 0);

        views.setTextViewText(R.id.widget_title, labels == null ? "" : labels.optString("title"));
        views.setViewVisibility(R.id.widget_figures, View.VISIBLE);
        if (total > 0) {
            views.setTextViewText(R.id.widget_count, String.valueOf(total));
            String minutes = point.optString("minutes", "");
            String unit = point.optString("unit", "");
            views.setTextViewText(R.id.widget_unit, minutes.isEmpty() ? unit : unit + " · " + minutes);
            views.setViewVisibility(R.id.widget_count, View.VISIBLE);
            views.setTextViewText(R.id.widget_depart, labels == null ? "" : labels.optString("depart"));
            views.setViewVisibility(R.id.widget_depart, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_count, View.GONE);
            views.setTextViewText(R.id.widget_unit, labels == null ? "" : labels.optString("clear"));
            views.setViewVisibility(R.id.widget_depart, View.GONE);
        }

        // The stripe is the lanes of now: once the day ahead is showing,
        // the app has not said what it holds line by line.
        Bitmap stripe = at == 0 ? stripe(data.optJSONArray("lanes")) : null;
        if (stripe != null) {
            views.setImageViewBitmap(R.id.widget_stripe, stripe);
            views.setViewVisibility(R.id.widget_stripe, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_stripe, View.GONE);
        }

        JSONObject word = wordAt(data.optJSONArray("words"), now);
        if (word != null) {
            views.setTextViewText(R.id.widget_jp, word.optString("jp"));
            views.setTextViewText(R.id.widget_reading, word.optString("reading"));
            views.setViewVisibility(R.id.widget_reading, word.optString("reading").isEmpty() ? View.GONE : View.VISIBLE);
            views.setTextViewText(R.id.widget_meaning, word.optString("meaning"));
            views.setViewVisibility(R.id.widget_word, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_word, View.GONE);
        }
        return views;
    }

    /** The index of the last point that has begun -- now's count, or a
     *  day ahead's once its midnight has passed -- or -1 for none. */
    private static int pointAt(JSONArray points, long now) {
        if (points == null || points.length() == 0) return -1;
        int found = 0;
        for (int i = 0; i < points.length(); i++) {
            JSONObject p = points.optJSONObject(i);
            if (p != null && p.optLong("from", Long.MAX_VALUE) <= now) found = i;
        }
        return found;
    }

    private static JSONObject wordAt(JSONArray words, long now) {
        if (words == null || words.length() == 0) return null;
        int index = (int) ((now / WORD_EVERY_MS) % words.length());
        return words.optJSONObject(index);
    }

    /** One bar a lane, as long as its share of the run, a gap between. */
    private static Bitmap stripe(JSONArray lanes) {
        if (lanes == null || lanes.length() == 0) return null;
        int sum = 0;
        for (int i = 0; i < lanes.length(); i++) {
            JSONObject lane = lanes.optJSONObject(i);
            if (lane != null) sum += Math.max(0, lane.optInt("n", 0));
        }
        if (sum == 0) return null;
        final int width = 600;
        final int height = 8;
        final int gap = 4;
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        int room = width - gap * (lanes.length() - 1);
        float x = 0;
        for (int i = 0; i < lanes.length(); i++) {
            JSONObject lane = lanes.optJSONObject(i);
            if (lane == null) continue;
            int n = Math.max(0, lane.optInt("n", 0));
            if (n == 0) continue;
            float w = room * (n / (float) sum);
            paint.setColor(lineColor(lane.optString("line")));
            canvas.drawRoundRect(x, 0, x + w, height, height / 2f, height / 2f, paint);
            x += w + gap;
        }
        return bitmap;
    }

    /** The gate, through the same link the app reads from any source. */
    private static PendingIntent openToday(Context context) {
        Intent intent = new Intent(Intent.ACTION_VIEW, OPEN_TODAY, context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
