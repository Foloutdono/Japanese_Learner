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
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;

import java.util.HashMap;
import java.util.Map;

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
 *
 * Redrawn in plan 293 (the owner's pick C of the canvas "Tsuji — widgets
 * & notifications"): the mark and the learner's hour head it, the count
 * stands over its minutes and new cards, the word past a hairline, and
 * Depart is the app's gate. It is drawn at the size the launcher gives:
 * the wide board, or the 2x2's without the word (widget_train_narrow),
 * each without Depart when too short to hold it. A tap opens the gate,
 * Depart the run.
 */
public class TrainWidget extends AppWidgetProvider {

    private static final String PREFS = "tsuji_widget";
    private static final String KEY = "data";
    private static final long WORD_EVERY_MS = 3L * 60 * 60 * 1000;
    // The deep links the web app reads (src/lib/platform.js's openPath).
    private static final Uri OPEN_TODAY = Uri.parse("app.tsuji://open/today");
    private static final Uri OPEN_RUN = Uri.parse("app.tsuji://open/run");
    // Where the board changes, in dp: narrower than this, the word goes;
    // shorter than this, Depart does (a tap on the board still opens the
    // gate).
    private static final float WIDE_DP = 250f;
    private static final float TALL_DP = 160f;
    // The smallest it may be resized to (widget_train_info.xml).
    private static final float LEAST_W_DP = 180f;
    private static final float LEAST_H_DP = 110f;

    /** The lines' pigments, index.css's --line-* in the dark theme: the
     *  widget is drawn on sumi whatever the phone's theme. */
    private static int lineColor(String line) {
        switch (line) {
            case "kana": return Color.parseColor("#b84f3c");
            case "vocab": return Color.parseColor("#3e7ba6");
            case "kanji": return Color.parseColor("#7b68a3");
            case "grammar": return Color.parseColor("#608045");
            case "personal": return Color.parseColor("#a15d6e");
            default: return Color.parseColor("#575060");
        }
    }

    static void store(Context context, String data) {
        prefs(context).edit().putString(KEY, data == null ? "" : data).apply();
    }

    static void redrawAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TrainWidget.class));
        for (int id : ids) manager.updateAppWidget(id, viewsFor(context, manager, id));
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, viewsFor(context, manager, id));
    }

    /** Resized: drawn again for the new size (before Android 12, which
     *  picks among the sizes viewsFor handed it by itself). */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        manager.updateAppWidget(id, viewsFor(context, manager, id));
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** The board for each size it may be drawn at. From Android 12 the
     *  launcher is handed all four and draws the largest that fits, as
     *  the widget is resized; before, the size it last reported, read in
     *  portrait (the narrowest width, the tallest height). */
    private static RemoteViews viewsFor(Context context, AppWidgetManager manager, int id) {
        JSONObject data = load(context);
        // Drawn once, shared by every size.
        Bitmap stripe = data == null ? null : stripe(data.optJSONArray("lanes"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Map<SizeF, RemoteViews> sizes = new HashMap<>();
            sizes.put(new SizeF(LEAST_W_DP, LEAST_H_DP), render(context, data, stripe, false, false));
            sizes.put(new SizeF(LEAST_W_DP, TALL_DP), render(context, data, stripe, false, true));
            sizes.put(new SizeF(WIDE_DP, LEAST_H_DP), render(context, data, stripe, true, false));
            sizes.put(new SizeF(WIDE_DP, TALL_DP), render(context, data, stripe, true, true));
            return new RemoteViews(sizes);
        }
        Bundle options = manager.getAppWidgetOptions(id);
        int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, (int) WIDE_DP);
        int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, (int) TALL_DP);
        return render(context, data, stripe, width >= WIDE_DP, height >= TALL_DP);
    }

    private static JSONObject load(Context context) {
        String raw = prefs(context).getString(KEY, "");
        if (raw == null || raw.isEmpty()) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return null;
        }
    }

    private static RemoteViews render(Context context, JSONObject data, Bitmap lanes, boolean wide, boolean tall) {
        RemoteViews views = new RemoteViews(
            context.getPackageName(), wide ? R.layout.widget_train : R.layout.widget_train_narrow);
        views.setOnClickPendingIntent(R.id.widget_root, open(context, OPEN_TODAY, 0));
        views.setOnClickPendingIntent(R.id.widget_depart, open(context, OPEN_RUN, 1));

        if (data == null) {
            // Signed out, or the app not opened since it was installed:
            // the mark and the name alone, and a tap opens the app.
            views.setTextViewText(R.id.widget_hour, context.getString(R.string.app_name));
            views.setViewVisibility(R.id.widget_figures, View.GONE);
            if (wide) {
                views.setViewVisibility(R.id.widget_meta, View.GONE);
                views.setViewVisibility(R.id.widget_word, View.GONE);
            }
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

        // The learner's hour beside the mark, or the title without one.
        String hour = data.optString("hour", "");
        views.setTextViewText(R.id.widget_hour, hour.isEmpty() && labels != null ? labels.optString("title") : hour);
        views.setViewVisibility(R.id.widget_figures, View.VISIBLE);
        if (total > 0) {
            String minutes = point.optString("minutes", "");
            String unit = point.optString("unit", "");
            String meta = point.optString("meta", minutes);
            views.setTextViewText(R.id.widget_count, String.valueOf(total));
            views.setViewVisibility(R.id.widget_count, View.VISIBLE);
            if (wide) {
                views.setTextViewText(R.id.widget_unit, unit);
                views.setTextViewText(R.id.widget_meta, meta);
                views.setViewVisibility(R.id.widget_meta, meta.isEmpty() ? View.GONE : View.VISIBLE);
            } else {
                // The 2x2 has one line for both: "23 · 12 min".
                views.setTextViewText(R.id.widget_unit, minutes.isEmpty() ? unit : "· " + minutes);
            }
            views.setTextViewText(R.id.widget_depart_label, labels == null ? "" : labels.optString("depart"));
            views.setViewVisibility(R.id.widget_depart, tall ? View.VISIBLE : View.GONE);
        } else {
            views.setViewVisibility(R.id.widget_count, View.GONE);
            views.setTextViewText(R.id.widget_unit, labels == null ? "" : labels.optString("clear"));
            if (wide) views.setViewVisibility(R.id.widget_meta, View.GONE);
            views.setViewVisibility(R.id.widget_depart, View.GONE);
        }

        // The stripe is the lanes of now: once the day ahead is showing,
        // the app has not said what it holds line by line.
        Bitmap stripe = at == 0 ? lanes : null;
        if (stripe != null) {
            views.setImageViewBitmap(R.id.widget_stripe, stripe);
            views.setViewVisibility(R.id.widget_stripe, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_stripe, View.GONE);
        }

        if (!wide) return views;
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

    /** One bar a lane, as long as its share of the run, a gap between:
     *  drawn at 100 to the stripe's 6dp height, so the gap is half its
     *  height, as the canvas drew it (3dp under 6dp). */
    private static Bitmap stripe(JSONArray lanes) {
        if (lanes == null || lanes.length() == 0) return null;
        int sum = 0;
        for (int i = 0; i < lanes.length(); i++) {
            JSONObject lane = lanes.optJSONObject(i);
            if (lane != null) sum += Math.max(0, lane.optInt("n", 0));
        }
        if (sum == 0) return null;
        final int width = 1200;
        final int height = 24;
        final int gap = 12;
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

    /** A door of the app -- the gate, or the run -- through the same
     *  links the app reads from any source. Each its own request code, so
     *  the two intents stay two. */
    private static PendingIntent open(Context context, Uri link, int code) {
        Intent intent = new Intent(Intent.ACTION_VIEW, link, context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
