// The Swift surface a generated file writes against, written down so it can be
// compiled rather than assumed. It mirrors the SDK as it is today, which is
// why `KeewanoCustomEventSet` carries no `Sendable`: under Swift 6 that makes
// `public static let set` in the generated file a concurrency error, and the
// fix belongs in the SDK, not here.
//
// Mirrors the iOS SDK: Sources/KeewanoSDK/KeewanoCustomEvents.swift
// (KeewanoCustomEventSet, KeewanoCodegen and its overloads) and
// Sources/KeewanoSDK/KeewanoSDK.swift (the type the reporters extend, down to
// its kind and its private initializer). Checked 2026-08-26; npm run
// check:surfaces compares these declarations against that checkout, so a
// rename upstream fails there rather than staying quiet here.
//
// KeewanoSDK is deliberately left without its report* API: the real one carries
// it, but copying it here would not catch a generated wrapper that shadows one.
// Measured: an extension in another module compiles without a word and wins the
// call. RESERVED_EVENT_NAMES and npm run check:reserved are what guard that.
//
// Used by scripts/check-native-vectors.sh; nothing ships from this folder.

public struct KeewanoCustomEventSet {
    public let version: UInt32
    public let eventCount: UInt16
    public let gzipData: [UInt8]

    public init(version: UInt32, eventCount: UInt16, gzipBase64: String) {
        self.version = version
        self.eventCount = eventCount
        self.gzipData = []
    }
}

public final class KeewanoSDK {
    private init() {}
}

public enum KeewanoCodegen {
    public static func reportCustomEvent(_ eventId: Int) {}
    public static func reportCustomEvent(_ eventId: Int, _ value: Int32) {}
    public static func reportCustomEvent(_ eventId: Int, _ value: Int64) {}
    public static func reportCustomEvent(_ eventId: Int, _ value: Bool) {}
    public static func reportCustomEvent(_ eventId: Int, _ value: Float) {}
    public static func reportCustomEvent(_ eventId: Int, _ value: String) {}
    public static func reportCustomEventUShortPair(_ eventId: Int, _ x: Int, _ y: Int) {}
}
