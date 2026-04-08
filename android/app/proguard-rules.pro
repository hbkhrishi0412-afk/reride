# ReRide / Capacitor — R8 rules for release (mapping.txt → Play Console deobfuscation)

# Readable deobfuscated stack traces (upload mapping.txt with each release)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

-keepattributes Signature, *Annotation*, InnerClasses, EnclosingMethod, Exceptions

# WebView JS bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Capacitor core + Cordova shim
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }

# Community plugins (adjust if you add/remove plugins)
-keep class com.getcapacitor.community.** { *; }

# Google Play / Firebase (used when google-services is applied)
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# OkHttp / Conscrypt (common transitive warnings)
-dontwarn org.conscrypt.**
