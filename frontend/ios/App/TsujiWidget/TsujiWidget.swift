import SwiftUI
import WidgetKit

// ── 発車案内 — the day's train on the lock and home screens (plan 156) ──
// The iPhone half of the widget the canvas drew (the Android half is
// android/.../TrainWidget.java), redrawn in plan 293 as the owner picked
// on the canvas "Tsuji — widgets & notifications": on the home screen
// the board C -- the mark and the learner's hour, the count over its
// minutes and new cards, a word the learner already knows (never one due
// this week) past a hairline, the lines' stripe, and Depart as the app's
// own gate (components/ui/GateButton.jsx); on the lock screen A's -- the
// count in a ring split by line, the word on its own in the rectangle,
// the hour and the count on the inline line.
//
// Everything it prints comes from the JSON the app stored in the shared
// App Group (App/TsujiWidgetPlugin.swift, src/lib/ahead.js's
// widgetPayload): a count for now and one for the turn of each day
// ahead, the lanes of now, the words, the hour, and every label already
// in the learner's language. A tap opens the gate, Depart the run
// (src/lib/platform.js's openPath).

private let appGroup = "group.app.tsuji"   // TsujiWidgetPlugin.appGroup
private let storeKey = "train"             // TsujiWidgetPlugin.storeKey
private let wordEvery: TimeInterval = 3 * 60 * 60
private let openToday = URL(string: "app.tsuji://open/today")!
private let openRun = URL(string: "app.tsuji://open/run")!

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
    static let line = Color(hex: 0x2d2b2e)     // --surface-line on the panel
    static let gold = Color(hex: 0xc99a3e)     // --accent2 / --gate-gold
    static let onFill = Color(hex: 0x1c1811)   // --text-on-fill
    // The gate (GateButton): its gold lit from the crest, the reader's
    // sumi and lamp, the hairline between the reader and the word.
    static let crest = Color(hex: 0xf3cb68)    // --gate-gold-crest
    static let lit = Color(hex: 0xe6bd62)      // --gate-gold-lit
    static let lamp = Color(hex: 0xe0b04f)     // --gate-lamp
    static let readerLit = Color(hex: 0x2e271e) // bg-panel 86% into gate-gold-lit
    static let gateLine = Color(hex: 0xbf9238) // gate-gold 60% into gate-gold-deep

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

// ── The mark (brand/mark.svg, DESIGN.md "The idea") ────────────
// 辻 with one dot on 辶, drawn rather than set: the font has only the
// two-dot form. Its road is the pass's metal, the rest the ground's ink.
// The outlines are the SVG's own, in its 1000-unit box.
private struct MarkPart: Shape {
    let road: Bool

    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / 1000
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * scale, y: rect.minY + y * scale)
        }
        var p = Path()
        if road {
            p.move(to: pt(286, 751))
            p.addQuadCurve(to: pt(339, 789), control: pt(312, 775))
            p.addQuadCurve(to: pt(401.5, 810), control: pt(366, 803))
            p.addQuadCurve(to: pt(486.5, 819.5), control: pt(437, 817))
            p.addQuadCurve(to: pt(607, 822), control: pt(536, 822))
            p.addQuadCurve(to: pt(727.5, 822), control: pt(662, 822))
            p.addQuadCurve(to: pt(861, 821), control: pt(793, 822))
            p.addQuadCurve(to: pt(992, 818), control: pt(929, 820))
            p.addLine(to: pt(992, 829))
            p.addQuadCurve(to: pt(900, 953), control: pt(909, 850))
            p.addQuadCurve(to: pt(809.5, 953), control: pt(860, 953))
            p.addQuadCurve(to: pt(707, 953), control: pt(759, 953))
            p.addQuadCurve(to: pt(608, 953), control: pt(655, 953))
            p.addQuadCurve(to: pt(483.5, 945), control: pt(536, 953))
            p.addQuadCurve(to: pt(393.5, 917), control: pt(431, 937))
            p.addQuadCurve(to: pt(328, 860), control: pt(356, 897))
            p.addQuadCurve(to: pt(275, 765), control: pt(300, 823))
            p.addQuadCurve(to: pt(222.5, 830.5), control: pt(251, 796))
            p.addQuadCurve(to: pt(165.5, 896.5), control: pt(194, 865))
            p.addQuadCurve(to: pt(114, 951), control: pt(137, 928))
            p.addQuadCurve(to: pt(108, 967), control: pt(113, 961))
            p.addQuadCurve(to: pt(95, 977), control: pt(103, 973))
            p.addLine(to: pt(22, 819))
            p.addQuadCurve(to: pt(101.5, 796), control: pt(56, 810))
            p.addQuadCurve(to: pt(195.5, 765.5), control: pt(147, 782))
            p.addQuadCurve(to: pt(286, 735), control: pt(244, 749))
            p.closeSubpath()
        } else {
            p.move(to: pt(329, 341))
            p.addLine(to: pt(771, 341))
            p.addLine(to: pt(843, 241))
            p.addQuadCurve(to: pt(856, 252), control: pt(843, 241))
            p.addQuadCurve(to: pt(889.5, 280), control: pt(869, 263))
            p.addQuadCurve(to: pt(931.5, 316.5), control: pt(910, 297))
            p.addQuadCurve(to: pt(971, 353), control: pt(953, 336))
            p.addQuadCurve(to: pt(962, 365), control: pt(970, 361))
            p.addQuadCurve(to: pt(943, 369), control: pt(954, 369))
            p.addLine(to: pt(337, 369))
            p.closeSubpath()
            p.move(to: pt(567, 31))
            p.addLine(to: pt(747, 48))
            p.addQuadCurve(to: pt(738.5, 65.5), control: pt(746, 58))
            p.addQuadCurve(to: pt(710, 76), control: pt(731, 73))
            p.addLine(to: pt(710, 740))
            p.addQuadCurve(to: pt(692, 756), control: pt(710, 746))
            p.addQuadCurve(to: pt(647.5, 774.5), control: pt(674, 766))
            p.addQuadCurve(to: pt(593, 783), control: pt(621, 783))
            p.addLine(to: pt(567, 783))
            p.closeSubpath()
            p.move(to: pt(286, 513))
            p.addLine(to: pt(286, 749))
            p.addLine(to: pt(147, 822))
            p.addLine(to: pt(147, 494))
            p.addLine(to: pt(30, 494))
            p.addLine(to: pt(24, 466))
            p.addLine(to: pt(130, 466))
            p.addLine(to: pt(198, 377))
            p.addLine(to: pt(339, 490))
            p.addQuadCurve(to: pt(320, 503), control: pt(332, 497))
            p.addQuadCurve(to: pt(286, 513), control: pt(308, 509))
            p.closeSubpath()
            p.move(to: pt(66, 56))
            p.addQuadCurve(to: pt(202, 85), control: pt(152, 62))
            p.addQuadCurve(to: pt(272.5, 138.5), control: pt(252, 108))
            p.addQuadCurve(to: pt(291, 198.5), control: pt(293, 169))
            p.addQuadCurve(to: pt(269.5, 248.5), control: pt(289, 228))
            p.addQuadCurve(to: pt(220, 272), control: pt(250, 269))
            p.addQuadCurve(to: pt(155, 252), control: pt(190, 275))
            p.addQuadCurve(to: pt(134.5, 182.5), control: pt(149, 217))
            p.addQuadCurve(to: pt(100.5, 116.5), control: pt(120, 148))
            p.addQuadCurve(to: pt(59, 61), control: pt(81, 85))
            p.closeSubpath()
        }
        return p
    }
}

private struct Mark: View {
    var rest: Color = Ink.paper

    var body: some View {
        ZStack {
            MarkPart(road: false).fill(rest)
            MarkPart(road: true).fill(Ink.gold)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
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
        /// The minutes and the new cards (plan 293); absent from what an
        /// older app stored.
        let meta: String?
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

    /// The learner's departure hour, '' without one (plan 293).
    let hour: String?
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

    /// The gallery's train, before the app has handed the widget one: in
    /// the phone's language, the figures the canvas drew.
    static var sample: Train {
        let french = Gallery.french
        return Train(
            hour: "07:30",
            labels: Labels(title: Gallery.name, clear: french ? "Voie libre" : "Line clear",
                           depart: french ? "Embarquer" : "Depart"),
            points: [Point(from: 0, total: 23, unit: french ? "cartes" : "cards", minutes: "12 min",
                           meta: french ? "12 min · 5 nouvelles" : "12 min · 5 new")],
            lanes: [Lane(line: "vocab", n: 12), Lane(line: "kanji", n: 6),
                    Lane(line: "grammar", n: 3), Lane(line: "kana", n: 2)],
            words: [Word(jp: "電車", reading: "でんしゃ", meaning: "train")]
        )
    }
}

struct TrainEntry: TimelineEntry {
    let date: Date
    let hour: String
    let labels: Train.Labels?
    let point: Train.Point?
    /// The lanes of now; empty once a day ahead is showing.
    let lanes: [Train.Lane]
    let word: Train.Word?

    static func at(_ date: Date, _ train: Train?) -> TrainEntry {
        let index = train?.pointIndex(at: date)
        return TrainEntry(
            date: date,
            hour: train?.hour ?? "",
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
        TrainEntry.at(Date(), Train.sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (TrainEntry) -> Void) {
        let train = Train.load() ?? (context.isPreview ? Train.sample : nil)
        completion(TrainEntry.at(Date(), train))
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

/// The lock screen's line: the hour and the count, as a departure
/// board's row says it, or the count and its minutes without an hour.
private func inlineLine(_ entry: TrainEntry) -> String {
    guard let point = entry.point else { return "辻" }
    if point.total > 0, !entry.hour.isEmpty {
        return "辻 \(entry.hour) · \(point.total) \(point.unit)"
    }
    return "辻 \(countLine(entry))"
}

private extension View {
    /// iOS 17 draws a widget's ground itself, with its own margins, and
    /// blanks a widget that does not say what it is; before, the widget
    /// keeps the same margin by hand (`inset`, the home screen's 16).
    @ViewBuilder func ground(_ color: Color, inset: CGFloat = 0) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { color }
        } else {
            padding(inset).background(color)
        }
    }
}

// ── The lock screen (A) ──────────────────────────────────────
/// The day's count in a ring, the ring cut into the lines' shares with a
/// gap between, in the lock screen's one ink.
private struct Circular: View {
    let entry: TrainEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            if let point = entry.point {
                if point.total > 0 {
                    LaneRing(lanes: entry.lanes)
                    Text("\(point.total)")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                        .padding(.horizontal, 10)
                } else {
                    Image(systemName: "checkmark")
                        .font(.system(size: 20, weight: .bold))
                }
            } else {
                Mark(rest: .primary).padding(18)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(countLine(entry).isEmpty ? "Tsuji" : countLine(entry))
        .ground(.clear)
    }
}

private struct LaneRing: View {
    let lanes: [Train.Lane]

    private struct Arc {
        let from: CGFloat
        let to: CGFloat
    }

    /// Each lane's share of the ring, a gap of a fortieth between; one
    /// lane, or none (a day ahead), is the whole ring.
    private var arcs: [Arc] {
        let shares = lanes.map { max(0, $0.n) }.filter { $0 > 0 }
        let sum = shares.reduce(0, +)
        guard shares.count > 1, sum > 0 else { return [Arc(from: 0, to: 1)] }
        let gap: CGFloat = 0.025
        let room = 1 - gap * CGFloat(shares.count)
        var at: CGFloat = 0
        return shares.map { n -> Arc in
            let length = room * CGFloat(n) / CGFloat(sum)
            defer { at += length + gap }
            return Arc(from: at, to: at + length)
        }
    }

    var body: some View {
        GeometryReader { geo in
            let width = max(3, min(geo.size.width, geo.size.height) * 0.07)
            ZStack {
                ForEach(Array(arcs.enumerated()), id: \.offset) { _, arc in
                    Circle()
                        .trim(from: arc.from, to: arc.to)
                        .stroke(style: StrokeStyle(lineWidth: width, lineCap: .butt))
                        .rotationEffect(.degrees(-90))
                }
            }
            .padding(width / 2 + 2)
        }
        .accessibilityHidden(true)
    }
}

/// A word the learner knows, on its own: the word, its reading over its
/// meaning, as the lock screen's word widgets set them.
private struct Rectangular: View {
    let entry: TrainEntry

    var body: some View {
        HStack(spacing: 10) {
            if let word = entry.word {
                Text(word.jp)
                    .font(.system(size: 34, weight: .bold, design: .serif))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                VStack(alignment: .leading, spacing: 0) {
                    if !word.reading.isEmpty {
                        Text(word.reading).font(.system(size: 12)).tracking(1.4).lineLimit(1)
                    }
                    Text(word.meaning).font(.headline).lineLimit(1)
                }
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    Text(entry.hour.isEmpty ? (entry.labels?.title ?? "辻") : entry.hour)
                        .font(.headline).lineLimit(1)
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
        Text(inlineLine(entry))
            .ground(.clear)
    }
}

// ── The home screen (C) ──────────────────────────────────────
private struct Stripe: View {
    let lanes: [Train.Lane]

    var body: some View {
        GeometryReader { geo in
            let sum = max(1, lanes.reduce(0) { $0 + max(0, $1.n) })
            let gap: CGFloat = 3
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

/// The card scanner's mark (GateButton's ScanMark): a card in a
/// scanner's frame, its stripe across it, in a 24-unit box.
private struct ScanMark: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 24
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * s, y: rect.minY + y * s)
        }
        var p = Path()
        // The frame's four corners.
        p.move(to: pt(3, 8))
        p.addArc(tangent1End: pt(3, 3), tangent2End: pt(8, 3), radius: 2.5 * s)
        p.addLine(to: pt(8, 3))
        p.move(to: pt(16, 3))
        p.addArc(tangent1End: pt(21, 3), tangent2End: pt(21, 8), radius: 2.5 * s)
        p.addLine(to: pt(21, 8))
        p.move(to: pt(21, 16))
        p.addArc(tangent1End: pt(21, 21), tangent2End: pt(16, 21), radius: 2.5 * s)
        p.addLine(to: pt(16, 21))
        p.move(to: pt(8, 21))
        p.addArc(tangent1End: pt(3, 21), tangent2End: pt(3, 16), radius: 2.5 * s)
        p.addLine(to: pt(3, 16))
        // The card and its stripe.
        p.addRoundedRect(in: CGRect(origin: pt(7, 8.5), size: CGSize(width: 10 * s, height: 7 * s)),
                         cornerSize: CGSize(width: 1.2 * s, height: 1.2 * s))
        p.move(to: pt(7, 11))
        p.addLine(to: pt(17, 11))
        return p
    }
}

/// Depart, as the app's gate (GateButton, DESIGN.md "The gate button"):
/// a gold pill lit from above, a sumi reader at its left end holding the
/// scanner's mark, a hairline between the reader and the word.
private struct Gate: View {
    let label: String
    var height: CGFloat = 32

    var body: some View {
        let reader = height - 6
        ZStack {
            Capsule().fill(LinearGradient(
                gradient: Gradient(stops: [.init(color: Ink.crest, location: 0),
                                           .init(color: Ink.lit, location: 0.45),
                                           .init(color: Ink.gold, location: 1)]),
                startPoint: .top, endPoint: .bottom))
            Capsule().strokeBorder(
                LinearGradient(gradient: Gradient(colors: [Color.white.opacity(0.5), .clear]),
                               startPoint: .top, endPoint: .center),
                lineWidth: 1)
            HStack(spacing: 8) {
                ZStack {
                    Circle().fill(RadialGradient(
                        gradient: Gradient(colors: [Ink.readerLit, Ink.sumi]),
                        center: UnitPoint(x: 0.4, y: 0.35), startRadius: 0, endRadius: reader * 0.7))
                    ScanMark()
                        .stroke(Ink.lamp, style: StrokeStyle(lineWidth: reader * 0.56 / 12, lineCap: .round, lineJoin: .round))
                        .frame(width: reader * 0.56, height: reader * 0.56)
                }
                .frame(width: reader, height: reader)
                Capsule().fill(Ink.gateLine).frame(width: 1.3, height: height / 2)
                Spacer(minLength: 0)
            }
            .padding(.leading, 3)
            Text(label)
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(Ink.onFill)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .padding(.horizontal, reader + 12)
        }
        .frame(height: height)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityAddTraits(.isButton)
    }
}

/// The mark and the learner's hour, or the title without one.
private struct Head: View {
    let entry: TrainEntry

    var body: some View {
        HStack(spacing: 6) {
            Mark().frame(width: 14, height: 14)
            Text(entry.hour.isEmpty ? (entry.labels?.title ?? "") : entry.hour)
                .font(.system(size: 12, weight: .bold).monospacedDigit())
                .foregroundColor(Ink.soft)
                .lineLimit(1)
        }
        .frame(height: 14)
    }
}

private struct WordBlock: View {
    let word: Train.Word

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !word.reading.isEmpty {
                Text(word.reading).font(.system(size: 11)).tracking(1.3).foregroundColor(Ink.soft).lineLimit(1)
            }
            Text(word.jp)
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundColor(Ink.paper)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text(word.meaning).font(.system(size: 12, weight: .semibold)).foregroundColor(Ink.paper).lineLimit(1)
        }
    }
}

/// The count over its minutes and new cards: the medium's figures. The
/// small has them on one line under a larger count.
private struct Figures: View {
    let entry: TrainEntry
    let small: Bool

    var body: some View {
        if let point = entry.point, point.total > 0 {
            if small {
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(point.total)")
                        .font(.system(size: 44, weight: .bold).monospacedDigit())
                        .foregroundColor(Ink.paper)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(point.minutes.isEmpty ? point.unit : "\(point.unit) · \(point.minutes)")
                        .font(.system(size: 12))
                        .foregroundColor(Ink.soft)
                        .lineLimit(1)
                }
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("\(point.total)")
                            .font(.system(size: 32, weight: .bold).monospacedDigit())
                            .foregroundColor(Ink.paper)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                        Text(point.unit).font(.system(size: 15)).foregroundColor(Ink.soft).lineLimit(1)
                    }
                    let meta = point.meta ?? point.minutes
                    if !meta.isEmpty {
                        Text(meta).font(.system(size: 12)).foregroundColor(Ink.soft).lineLimit(1)
                    }
                }
            }
        } else if entry.point != nil {
            Text(entry.labels?.clear ?? "")
                .font(.system(size: 17, weight: .bold))
                .foregroundColor(Ink.paper)
                .lineLimit(1)
        }
    }
}

private struct Board: View {
    let entry: TrainEntry
    let wide: Bool

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .ground(Ink.sumi, inset: 16)
    }

    @ViewBuilder private var content: some View {
        if entry.point == nil {
            // Signed out, or the app not opened since it was installed.
            Mark().frame(width: 40, height: 40)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if wide {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Head(entry: entry)
                        Figures(entry: entry, small: false)
                    }
                    Spacer(minLength: 0)
                    if let word = entry.word {
                        // The hairline before the word, as tall as the word.
                        WordBlock(word: word)
                            .frame(width: 94, alignment: .leading)
                            .padding(.leading, 14)
                            .overlay(alignment: .leading) { Rectangle().fill(Ink.line).frame(width: 1) }
                    }
                }
                Spacer(minLength: 4)
                if !entry.lanes.isEmpty {
                    Stripe(lanes: entry.lanes).frame(height: 6)
                }
                if let point = entry.point, point.total > 0, let depart = entry.labels?.depart {
                    Link(destination: openRun) {
                        Gate(label: depart)
                    }
                    .padding(.top, 8)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                Head(entry: entry)
                Spacer(minLength: 0)
                Figures(entry: entry, small: true)
                if !entry.lanes.isEmpty {
                    Stripe(lanes: entry.lanes).frame(height: 6).padding(.top, 10)
                }
            }
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
    static let french = Locale.preferredLanguages.first?.hasPrefix("fr") ?? false
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
