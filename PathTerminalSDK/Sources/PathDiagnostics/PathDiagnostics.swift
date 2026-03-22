/// Path Diagnostics — re-exports support bundle helpers from ``PathCoreModels``.
import Foundation
import PathCoreModels

public enum PathDiagnostics {
    public static let diagnosticsVersion = "0.1.0"

    /// Pretty-printed JSON for email or clipboard.
    public static func formatSupportBundle(_ snapshot: SupportBundleSnapshotV1) throws -> String {
        try SupportBundleSnapshotV1.encodePrettyString(snapshot)
    }
}
