plugins {
    kotlin("jvm") version "2.0.21"
    id("application")
}

group = "com.github.madbrain.recettelang"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.eclipse.lsp4j:org.eclipse.lsp4j:0.24.0")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}

kotlin {
    jvmToolchain(17)
}

application {
    mainClass = "com.github.madbrain.recettelang.MainKt"
}

tasks.named<JavaExec>("run") {
    standardInput = System.`in`
}
