import SwiftUI
import WidgetKit

// ── 発車案内 — the day's train on the lock and home screens (plan 156) ──
// The iPhone half of the widget the canvas drew (the Android half is
// android/.../TrainWidget.java). On the lock screen: the count in a
// circle, and a word the learner already knows -- never one due this
// week -- beside the count in a rectangle, the way the lock-screen word
// widgets do; on the home screen, the count and what it takes, the word,
// the lines' stripe and Depart on sumi.
//
// Everything it prints comes from the JSON the app stored in the shared
// App Group (App/TsujiWidgetPlugin.swift, src/lib/ahead.js's
// widgetPayload): a count for now and one for the turn of each day
// ahead, the lanes of now, the words, and every label already in the
// learner's language. A tap opens the gate (src/lib/platform.js's
// openPath).

private let appGroup = "group.app.tsuji"   // TsujiWidgetPlugin.appGroup
private let storeKey = "train"             // TsujiWidgetPlugin.storeKey
private let wordEvery: TimeInterval = 3 * 60 * 60
private let openToday = URL(string: "app.tsuji://open/today")!

// index.css's inks in the dark theme: the board is sumi whatever the
// phone's theme, as the widget gallery shows it.
private extension Color {
    init(hex: UInt32) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xff) / 255,
                  green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255,
                  opacity: 1)
    }
}

private enum Ink {
    static let sumi = Color(hex: 0x100e13)     // --bg-panel
    static let paper = Color(hex: 0xf3ecdf)    // --text-on-panel
    static let soft = Color(hex: 0xb3a488)     // --text-on-panel-soft
    static let gold = Color(hex: 0xc99a3e)     // --accent2, the gate's
    static let onFill = Color(hex: 0x1c1811)   // --text-on-fill

    static func line(_ line: String) -> Color {
        switch line {
        case "kana": return Color(hex: 0xb84f3c)
        case "vocab": return Color(hex: 0x3e7ba6)
        case "kanji": return Color(hex: 0x7b68a3)
        case "grammar": return Color(hex: 0x608045)
        case "personal": return Color(hex: 0xa15d6e)
        default: return Color(hex: 0x575060)
        }
    }
}

// ── What the app stored ──────────────────────────────────────
struct Train: Decodable {
    struct Labels: Decodable {
        let title: String
        let clear: String
        let depart: String
    }
    struct Point: Decodable {
        let from: Double      // ms since the epoch
        let total: Int
        let unit: String
        let minutes: String
    }
    struct Lane: Decodable {
        let line: String
        let n: Int
    }
    struct Word: Decodable {
        let jp: String
        let reading: String
        let meaning: String
    }

    let labels: Labels
    let points: [Point]
    let lanes: [Lane]
    let words: [Word]

    static func load() -> Train? {
        guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: storeKey),
              let data = raw.data(using: .utf8), !data.isEmpty else { return nil }
        return try? JSONDecoder().decode(Train.self, from: data)
    }

    /// The index of the last point that has begun: now's count, or a day
    /// ahead's once its midnight has passed.
    func pointIndex(at date: Date) -> Int? {
        guard !points.isEmpty else { return nil }
        let ms = date.timeIntervalSince1970 * 1000
        var found = 0
        for (index, point) in points.enumerated() where point.from <= ms {
            found = index
        }
        return found
    }

    func word(at date: Date) -> Word? {
        guard !words.isEmpty else { return nil }
        let slot = Int(date.timeIntervalSince1970 / wordEvery)
        return words[slot % words.count]
    }
}

struct TrainEntry: TimelineEntry {
    let date: Date
    let labels: Train.Labels?
    let point: Train.Point?
    /// The lanes of now; empty once a day ahead is showing.
    let lanes: [Train.Lane]
    let word: Train.Word?

    static func at(_ date: Date, _ train: Train?) -> TrainEntry {
        let index = train?.pointIndex(at: date)
        return TrainEntry(
            date: date,
            labels: train?.labels,
            point: index.flatMap { train?.points[$0] },
            lanes: index == 0 ? (train?.lanes ?? []) : [],
            word: train?.word(at: date)
        )
    }
}

// ── The timeline ─────────────────────────────────────────────
// An entry now, one at each change of word for the next day, and one at
// the midnight of each day ahead; the app replaces the lot whenever it
// plans again.
struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> TrainEntry {
        TrainEntry.at(Date(), nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (TrainEntry) -> Void) {
        completion(TrainEntry.at(Date(), Train.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TrainEntry>) -> Void) {
        let now = Date()
        let train = Train.load()
        var dates: Set<Date> = [now]
        let slot = floor(now.timeIntervalSince1970 / wordEvery)
        for step in 1...8 {
            dates.insert(Date(timeIntervalSince1970: (slot + Double(step)) * wordEvery))
        }
        for point in train?.points ?? [] {
            let start = Date(timeIntervalSince1970: point.from / 1000)
            if start > now { dates.insert(start) }
        }
        let entries = dates.sorted().map { TrainEntry.at($0, train) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// ── The words ────────────────────────────────────────────────
private func countLine(_ entry: TrainEntry) -> String {
    guard let point = entry.point else { return "" }
    if point.total == 0 { return entry.labels?.clear ?? "" }
    let head = "\(point.total) \(point.unit)"
    return point.minutes.isEmpty ? head : "\(head) · \(point.minutes)"
}

private extension View {
    /// iOS 17 draws a widget's ground itself, and blanks a widget that
    /// does not say what it is.
    @ViewBuilder func ground(_ color: Color) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { color }
        } else {
            background(color)
        }
    }
}

// ── The lock screen ──────────────────────────────────────────
private struct Circular: View {
    let entry: TrainEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            if let point = entry.point {
                if point.total > 0 {
                    VStack(spacing: 0) {
                        Text("\(point.total)")
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                        Text(point.unit)
                            .font(.system(size: 10, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                } else {
                    Image(systemName: "checkmark")
                        .font(.system(size: 20, weight: .bold))
                        .accessibilityLabel(entry.labels?.clear ?? "")
                }
            } else {
                Text("辻").font(.system(size: 24, weight: .bold, design: .serif))
            }
        }
        .ground(.clear)
    }
}

private struct Rectangular: View {
    let entry: TrainEntry

    var body: some View {
        HStack(spacing: 8) {
            if let word = entry.word {
                Text(word.jp)
                    .font(.system(size: 30, weight: .bold, design: .serif))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                VStack(alignment: .leading, spacing: 0) {
                    Text(word.meaning).font(.headline).lineLimit(1)
                    if !word.reading.isEmpty {
                        Text(word.reading).font(.caption).lineLimit(1)
                    }
                    Text(countLine(entry)).font(.caption2).lineLimit(1).foregroundStyle(.secondary)
                }
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    Text(entry.labels?.title ?? "辻").font(.headline).lineLimit(1)
                    Text(countLine(entry)).font(.caption).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .ground(.clear)
    }
}

private struct Inline: View {
    let entry: TrainEntry

    var body: some View {
        let line = countLine(entry)
        Text(line.isEmpty ? "辻" : "辻 \(line)")
            .ground(.clear)
    }
}

// ── The home screen ──────────────────────────────────────────
private struct Stripe: View {
    let lanes: [Train.Lane]

    var body: some View {
        GeometryReader { geo in
            let sum = max(1, lanes.reduce(0) { $0 + max(0, $1.n) })
            let gap: CGFloat = 2
            let room = max(0, geo.size.width - gap * CGFloat(max(0, lanes.count - 1)))
            HStack(spacing: gap) {
                ForEach(Array(lanes.enumerated()), id: \.offset) { _, lane in
                    Capsule()
                        .fill(Ink.line(lane.line))
                        .frame(width: room * CGFloat(max(0, lane.n)) / CGFloat(sum))
                }
            }
        }
        .accessibilityHidden(true)
    }
}

private struct WordBlock: View {
    let word: Train.Word
    let alignment: HorizontalAlignment

    var body: some View {
        VStack(alignment: alignment, spacing: 1) {
            Text(word.jp)
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundColor(Ink.paper)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            if !word.reading.isEmpty {
                Text(word.reading).font(.system(size: 12)).foregroundColor(Ink.soft).lineLimit(1)
            }
            Text(word.meaning).font(.system(size: 12, weight: .semibold)).foregroundColor(Ink.paper).lineLimit(1)
        }
    }
}

private struct Board: View {
    let entry: TrainEntry
    let wide: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text((entry.labels?.title ?? "Tsuji").uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .tracking(1.6)
                        .foregroundColor(Ink.soft)
                        .lineLimit(1)
                    figures
                }
                if wide, let word = entry.word {
                    Spacer(minLength: 0)
                    WordBlock(word: word, alignment: .trailing)
                }
            }
            Spacer(minLength: 0)
            if !wide, let word = entry.word {
                WordBlock(word: word, alignment: .leading)
            }
            if !entry.lanes.isEmpty {
                Stripe(lanes: entry.lanes).frame(height: 4)
            }
            if wide, let point = entry.point, point.total > 0, let depart = entry.labels?.depart {
                Text(depart)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(Ink.onFill)
                    .frame(maxWidth: .infinity, minHeight: 36)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Ink.gold))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .ground(Ink.sumi)
    }

    @ViewBuilder private var figures: some View {
        if let point = entry.point {
            if point.total > 0 {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(point.total)")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundColor(Ink.paper)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(point.minutes.isEmpty ? point.unit : "\(point.unit) · \(point.minutes)")
                        .font(.system(size: 13))
                        .foregroundColor(Ink.soft)
                        .lineLimit(1)
                }
            } else {
                Text(entry.labels?.clear ?? "")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(Ink.paper)
            }
        } else {
            Text("辻")
                .font(.system(size: 36, weight: .bold, design: .serif))
                .foregroundColor(Ink.gold)
        }
    }
}

struct TrainView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TrainEntry

    var body: some View {
        content.widgetURL(openToday)
    }

    @ViewBuilder private var content: some View {
        switch family {
        case .accessoryCircular: Circular(entry: entry)
        case .accessoryRectangular: Rectangular(entry: entry)
        case .accessoryInline: Inline(entry: entry)
        default: Board(entry: entry, wide: family == .systemMedium)
        }
    }
}

// The gallery's words, in the phone's language: the widget has no JSON
// to read them from before the app has run.
private enum Gallery {
    private static let french = Locale.preferredLanguages.first?.hasPrefix("fr") ?? false
    static let name = french ? "Ton train du jour" : "Today’s train"
    static let about = french
        ? "Les cartes du jour, le temps qu’elles prennent, et un mot que tu connais."
        : "The day’s cards, what they take, and a word you know."
}

struct TrainWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TrainWidget", provider: Provider()) { entry in
            TrainView(entry: entry)
        }
        .configurationDisplayName(Gallery.name)
        .description(Gallery.about)
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .systemSmall, .systemMedium])
    }
}

@main
struct TsujiWidgets: WidgetBundle {
    var body: some Widget {
        TrainWidget()
    }
}
