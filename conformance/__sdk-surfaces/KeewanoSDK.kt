// The Kotlin surface a generated file writes against, written down so it can be
// compiled rather than assumed.
//
// Mirrors the Android SDK: keewano-sdk/src/main/kotlin/com/keewano/sdk/
// KeewanoCodegen.kt (the six bridge overloads) and KeewanoSDK.kt (the object
// the reporters extend). Checked 2026-08-25, the day the SDK published the
// bridge; `npm run check:surfaces` compares these declarations against that
// checkout, so a rename upstream fails there rather than staying quiet here.
//
// The definition set has no type here on purpose: it travels as a JSON asset
// (`keewano_custom_events.json`) the SDK reads at launch, so the generated
// source never constructs it.
//
// Used by scripts/check-native-vectors.sh; nothing ships from this folder.

package com.keewano.sdk

object KeewanoSDK

object KeewanoCodegen {
    @JvmStatic fun reportCustomEvent(eventId: Int) {}
    @JvmStatic fun reportCustomEvent(eventId: Int, value: Int) {}
    @JvmStatic fun reportCustomEvent(eventId: Int, value: Long) {}
    @JvmStatic fun reportCustomEvent(eventId: Int, value: Boolean) {}
    @JvmStatic fun reportCustomEvent(eventId: Int, value: Float) {}
    @JvmStatic fun reportCustomEvent(eventId: Int, value: String) {}
    @JvmStatic fun reportCustomEventUShortPair(eventId: Int, x: Int, y: Int) {}
}
