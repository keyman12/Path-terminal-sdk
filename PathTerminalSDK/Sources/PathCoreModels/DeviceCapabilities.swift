/// Device capabilities per function catalog and C7 resolution.
import Foundation

public struct DeviceCapabilities: Codable, Equatable, Sendable {
    public let commands: [String]
    public let nfc: Bool
    public let display: Bool
    public let receiptPrint: Bool?

    public init(
        commands: [String],
        nfc: Bool = false,
        display: Bool = false,
        receiptPrint: Bool? = nil
    ) {
        self.commands = commands
        self.nfc = nfc
        self.display = display
        self.receiptPrint = receiptPrint
    }

    public func supports(_ command: String) -> Bool {
        commands.contains(command)
    }
}
