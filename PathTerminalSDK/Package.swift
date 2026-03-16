// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PathTerminalSDK",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(name: "PathCoreModels", targets: ["PathCoreModels"]),
        .library(name: "PathTerminalSDK", targets: ["PathTerminalSDK"]),
        .library(name: "PathEmulatorAdapter", targets: ["PathEmulatorAdapter"]),
        .library(name: "PathDiagnostics", targets: ["PathDiagnostics"])
    ],
    targets: [
        .target(
            name: "PathCoreModels",
            path: "Sources/PathCoreModels"
        ),
        .target(
            name: "PathTerminalSDK",
            dependencies: ["PathCoreModels", "PathEmulatorAdapter"],
            path: "Sources/PathTerminalSDK"
        ),
        .target(
            name: "PathEmulatorAdapter",
            dependencies: ["PathCoreModels"],
            path: "Sources/PathEmulatorAdapter"
        ),
        .target(
            name: "PathDiagnostics",
            dependencies: ["PathCoreModels"],
            path: "Sources/PathDiagnostics"
        ),
        .testTarget(
            name: "PathCoreModelsTests",
            dependencies: ["PathCoreModels"],
            path: "Tests/PathCoreModelsTests"
        ),
        .testTarget(
            name: "PathTerminalSDKTests",
            dependencies: ["PathTerminalSDK", "PathEmulatorAdapter"],
            path: "Tests/PathTerminalSDKTests"
        ),
        .testTarget(
            name: "PathEmulatorAdapterTests",
            dependencies: ["PathEmulatorAdapter"],
            path: "Tests/PathEmulatorAdapterTests"
        )
    ]
)
