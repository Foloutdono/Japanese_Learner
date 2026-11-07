# R8's rules for the release build (minifyEnabled in build.gradle): the
# code is shrunk, optimised and renamed, so the shipped DEX carries what
# the app runs and not the names it was written with.
#
# What must keep its name is kept by rules that come with it: Capacitor's
# consumer rules keep every plugin (a class the bridge loads by the name
# in capacitor.plugins.json, TsujiWidgetPlugin included) and its
# @PluginMethod methods; AGP's proguard-android-optimize.txt keeps the
# @JavascriptInterface bridge and the manifest's components are kept by
# the manifest. A new class reached by reflection gets its rule here.

# Every renamed class in one package, so the package tree says nothing
# either.
-repackageclasses

# Debug, verbose and info logging is taken out of the release.
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# Crash reports keep their line numbers, the file names go: the mapping
# R8 writes goes into the bundle, and Play turns the traces back.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
