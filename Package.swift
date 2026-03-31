// swift-tools-version: 5.9
// PathTerminalSDK — root package manifest (sources live in PathTerminalSDK/)
import PackageDescription

let package = Package(
    name: "PathTerminalSDK",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(name: "PathCoreModels",       targets: ["PathCoreModels"]),
        .library(name: "PathTerminalSDK",      targets: ["PathTerminalSDK"]),
        .library(name: "PathEmulatorAdapter",  targets: ["PathEmulatorAdapter"]),
        .library(name: "PathDiagnostics",      targets: ["PathDiagnostics"])
    ],
    targets: [
        .target(
            name: "PathCoreModels",
            path: "PathTerminalSDK/Sources/PathCoreModels"
        ),
        .target(
            name: "PathTerminalSDK",
            dependencies: ["PathCoreModels", "PathEmulatorAdapter"],
            path: "PathTerminalSDK/Sources/PathTerminalSDK"
        ),
        .target(
            name: "PathEmulatorAdapter",
            dependencies: ["PathCoreModels"],
            path: "PathTerminalSDK/Sources/PathEmulatorAdapter"
        ),
        .target(
            name: "PathDiagnostics",
            dependencies: ["PathCoreModels"],
            path: "PathTerminalSDK/Sources/PathDiagnostics"
        ),
        .testTarget(
            name: "PathCoreModelsTests",
            dependencies: ["PathCoreModels"],
            path: "PathTerminalSDK/Tests/PathCoreModelsTests"
        ),
        .testTarget(
            name: "PathTerminalSDKTests",
            dependencies: ["PathTerminalSDK", "PathEmulatorAdapter"],
            path: "PathTerminalSDK/Tests/PathTerminalSDKTests"
        ),
        .testTarget(
            name: "PathEmulatorAdapterTests",
            dependencies: ["PathEmulatorAdapter"],
            path: "PathTerminalSDK/Tests/PathEmulatorAdapterTests"
        )
    ]
)
