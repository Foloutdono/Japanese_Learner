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
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Arrays;
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
 *
 * Settled and glazed in plan 318 (the owner's A, in the colour 5, glass,
 * of the canvas "Tsuji — the home-screen widget, again"): the room a tall
 * launcher gives goes to the middle of the board, the count and the word
 * centred in it, instead of an empty band over Depart; the stripe sits
 * under the count it splits, no line shorter than a bar; and the ground
 * is sumi seen through. Three heights now: the board as drawn (ROOMY_DP
 * and up), the same set tighter where it only just holds Depart, and
 * without Depart (fit).
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
    // Tall enough for the board as drawn (plan 318): the larger count, the
    // room round it and the 40dp gate. Between TALL_DP and this, the same
    // board set tighter.
    private static final float ROOMY_DP = 190f;
    // The smallest it may be resized to (widget_train_info.xml).
    private static final float LEAST_W_DP = 180f;
    private static final float LEAST_H_DP = 110f;

    /** How much height the launcher gave: none to spare for Depart, just
     *  enough for it, or enough for the board as drawn. */
    private enum Height { SHORT, TALL, ROOMY }

    private static Height heightFor(float dp) {
        if (dp >= ROOMY_DP) return Height.ROOMY;
        return dp >= TALL_DP ? Height.TALL : Height.SHORT;
    }

    // The stripe's bitmap, drawn for a column STRIPE_DP wide at
    // STRIPE_PX_PER_DP and stretched to the column it lands in (fitXY):
    // near enough that its gaps and round ends keep their size in dp.
    private static final int STRIPE_DP = 180;
    private static final int STRIPE_PX_PER_DP = 6;
    private static final int STRIPE_HEIGHT_DP = 4;
    private static final int STRIPE_GAP_DP = 2;
    // A line's shortest bar, two and a half times the stripe's height: a
    // line of four cards among three hundred is a short bar, never a dot.
    private static final int STRIPE_LEAST_DP = 10;

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
     *  launcher is handed all six and draws the largest that fits, as
     *  the widget is resized; before, the size it last reported, read in
     *  portrait (the narrowest width, the tallest height). */
    private static RemoteViews viewsFor(Context context, AppWidgetManager manager, int id) {
        JSONObject data = load(context);
        // Drawn once, shared by every size.
        Bitmap stripe = data == null ? null : stripe(data.optJSONArray("lanes"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Map<SizeF, RemoteViews> sizes = new HashMap<>();
            for (boolean wide : new boolean[] {false, true}) {
                float width = wide ? WIDE_DP : LEAST_W_DP;
                sizes.put(new SizeF(width, LEAST_H_DP), render(context, data, stripe, wide, Height.SHORT));
                sizes.put(new SizeF(width, TALL_DP), render(context, data, stripe, wide, Height.TALL));
                sizes.put(new SizeF(width, ROOMY_DP), render(context, data, stripe, wide, Height.ROOMY));
            }
            return new RemoteViews(sizes);
        }
        Bundle options = manager.getAppWidgetOptions(id);
        int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, (int) WIDE_DP);
        int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, (int) TALL_DP);
        return render(context, data, stripe, width >= WIDE_DP, heightFor(height));
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

    private static RemoteViews render(Context context, JSONObject data, Bitmap lanes, boolean wide, Height height) {
        RemoteViews views = new RemoteViews(
            context.getPackageName(), wide ? R.layout.widget_train : R.layout.widget_train_narrow);
        views.setOnClickPendingIntent(R.id.widget_root, open(context, OPEN_TODAY, 0));
        views.setOnClickPendingIntent(R.id.widget_depart, open(context, OPEN_RUN, 1));
        fit(context, views, wide, height);

        if (data == null) {
            // Signed out, or the app not opened since it was installed:
            // the mark and the name alone, and a tap opens the app.
            views.setTextViewText(R.id.widget_hour, context.getString(R.string.app_name));
            views.setViewVisibility(R.id.widget_figures, View.GONE);
            views.setViewVisibility(R.id.widget_meta, View.GONE);
            if (wide) views.setViewVisibility(R.id.widget_word, View.GONE);
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
            views.setTextViewText(R.id.widget_unit, unit);
            // Under the count: the minutes and the new cards on the board,
            // the minutes alone on the 2×2.
            String line = wide ? meta : minutes;
            views.setTextViewText(R.id.widget_meta, line);
            views.setViewVisibility(R.id.widget_meta, line.isEmpty() ? View.GONE : View.VISIBLE);
            views.setTextViewText(R.id.widget_depart_label, labels == null ? "" : labels.optString("depart"));
            views.setViewVisibility(R.id.widget_depart, height == Height.SHORT ? View.GONE : View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_count, View.GONE);
            views.setTextViewText(R.id.widget_unit, labels == null ? "" : labels.optString("clear"));
            views.setViewVisibility(R.id.widget_meta, View.GONE);
            views.setViewVisibility(R.id.widget_depart, View.GONE);
        }

        // The stripe is the lanes of now: once the day ahead is showing,
        // the app has not said what it holds line by line.
        Bitmap stripe = at == 0 ? lanes : null;
        if (stripe != null) {
            views.setImageViewBitmap(R.id.widget_stripe_bars, stripe);
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

    /** The board's measures for the height it was given (plan 318): as
     *  drawn where the launcher leaves room, set tighter where it only
     *  just holds Depart, and without Depart's gap where it does not. The
     *  layouts hold the board as drawn; every gap that changes is a
     *  padding, which RemoteViews sets on every Android the app runs on
     *  (a margin only from Android 12). */
    private static void fit(Context context, RemoteViews views, boolean wide, Height height) {
        boolean roomy = height == Height.ROOMY;
        int side = px(context, wide ? 18 : 16);
        int edge = px(context, roomy ? 16 : 12);
        views.setViewPadding(R.id.widget_root, side, edge, side, edge);
        int foot = height == Height.SHORT ? 0 : roomy ? 12 : 8;
        views.setViewPadding(R.id.widget_body, 0, px(context, roomy ? 4 : 0), 0, px(context, foot));
        views.setTextViewTextSize(R.id.widget_count, TypedValue.COMPLEX_UNIT_SP, roomy ? (wide ? 42 : 40) : 36);
        views.setViewPadding(R.id.widget_meta, 0, px(context, roomy ? 4 : 2), 0, 0);
        views.setViewPadding(R.id.widget_stripe, 0, px(context, roomy ? (wide ? 12 : 10) : 8), 0, 0);
        int gate = px(context, roomy ? 4 : 2);
        views.setViewPadding(R.id.widget_depart, 0, gate, 0, gate);
        if (wide) views.setTextViewTextSize(R.id.widget_jp, TypedValue.COMPLEX_UNIT_SP, roomy ? 32 : 28);
    }

    private static int px(Context context, float dp) {
        return Math.round(dp * context.getResources().getDisplayMetrics().density);
    }

    /** One bar a line, as long as its share of the run, a gap between,
     *  none shorter than STRIPE_LEAST_DP (plan 318). */
    private static Bitmap stripe(JSONArray lanes) {
        if (lanes == null || lanes.length() == 0) return null;
        int[] counts = new int[lanes.length()];
        String[] lines = new String[lanes.length()];
        int k = 0;
        for (int i = 0; i < lanes.length(); i++) {
            JSONObject lane = lanes.optJSONObject(i);
            int n = lane == null ? 0 : Math.max(0, lane.optInt("n", 0));
            if (n == 0) continue;
            counts[k] = n;
            lines[k] = lane.optString("line");
            k++;
        }
        if (k == 0) return null;
        final int width = STRIPE_DP * STRIPE_PX_PER_DP;
        final int height = STRIPE_HEIGHT_DP * STRIPE_PX_PER_DP;
        final int gap = STRIPE_GAP_DP * STRIPE_PX_PER_DP;
        float[] widths = barWidths(
            Arrays.copyOf(counts, k), width - gap * (k - 1), STRIPE_LEAST_DP * STRIPE_PX_PER_DP);
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float x = 0;
        for (int i = 0; i < k; i++) {
            paint.setColor(lineColor(lines[i]));
            canvas.drawRoundRect(x, 0, x + widths[i], height, height / 2f, height / 2f, paint);
            x += widths[i] + gap;
        }
        return bitmap;
    }

    /** Each line's bar: its share of the room, but never under the least.
     *  A line whose share falls short takes the least, the others share
     *  what is left, until none falls short; where even the least cannot
     *  fit every line, each takes an equal part. */
    static float[] barWidths(int[] counts, float room, float least) {
        int k = counts.length;
        float[] widths = new float[k];
        if (k == 0) return widths;
        if (least * k >= room) {
            Arrays.fill(widths, room / k);
            return widths;
        }
        boolean[] held = new boolean[k];
        boolean moved = true;
        while (moved) {
            moved = false;
            float free = room;
            long sum = 0;
            for (int i = 0; i < k; i++) {
                if (held[i]) free -= least;
                else sum += counts[i];
            }
            for (int i = 0; i < k; i++) {
                if (held[i]) {
                    widths[i] = least;
                    continue;
                }
                widths[i] = sum == 0 ? free / k : free * counts[i] / sum;
                if (widths[i] < least) {
                    held[i] = true;
                    moved = true;
                }
            }
        }
        return widths;
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
