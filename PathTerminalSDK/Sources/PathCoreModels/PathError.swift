/// Error taxonomy per Doc 04 (13 categories).
/// Canonical codes for mapping adapter-specific errors.
import Foundation

public enum PathErrorCode: String, Codable, Equatable, Sendable {
    case validation
    case connectivity
    case capability
    case terminalBusy = "terminal_busy"
    case timeout
    case userCancelled = "user_cancelled"
    case decline
    case terminalFault = "terminal_fault"
    case adapterFault = "adapter_fault"
    case protocolMismatch = "protocol_mismatch"
    case recoveryRequired = "recovery_required"
    case configurationError = "configuration_error"
    case unsupportedOperation = "unsupported_operation"
}

public struct PathError: Codable, Equatable, Sendable, Error {
    public let code: PathErrorCode
    public let message: String
    public let adapterErrorCode: String?
    public let recoverable: Bool

    public init(
        code: PathErrorCode,
        message: String,
        adapterErrorCode: String? = nil,
        recoverable: Bool = false
    ) {
        self.code = code
        self.message = message
        self.adapterErrorCode = adapterErrorCode
        self.recoverable = recoverable
    }
}

extension PathError: LocalizedError {
    public var errorDescription: String? { message }
}
