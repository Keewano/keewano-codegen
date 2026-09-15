// The plugin an Android project applies to get the generator. It carries no
// executable itself: the binaries are published as their own artifacts, one per
// platform, and the plugin resolves the one this build host can run. Bundling every
// one of them would put hundreds of megabytes into every consumer's cache to
// use one of them.
plugins {
    `kotlin-dsl`
    `maven-publish`
}

group = "com.keewano"

// Stamped by the release build from package.json, the same single source the npm
// package and the Python wheels take it from. The default is what that file says
// between releases.
version = providers.gradleProperty("keewanoVersion").getOrElse("0.0.0")

repositories {
    mavenCentral()
}

dependencies {
    /**
     * Compile-only: at run time these classes come from the consumer's own
     * Kotlin plugin, and the references are guarded by `plugins.withId`, so a
     * project that applies no Kotlin plugin never loads them.
     */
    compileOnly("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24")
    testImplementation(kotlin("test"))
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}

gradlePlugin {
    plugins {
        create("keewanoCodegen") {
            id = "com.keewano.codegen"
            implementationClass = "com.keewano.codegen.KeewanoCodegenPlugin"
            displayName = "Keewano custom-events codegen"
            description = "Generates the Keewano custom-events module from the definitions file."
        }
    }
}
