/// Device info per function catalog and C7 resolution.
import Foundation

public struct DeviceInfo: Codable, Equatable, Sendable {
    public let model: String
    public let firmware: String
    public let serial: String?
    public let protocolVersion: String

    public init(
        model: String,
        firmware: String,
        serial: String? = nil,
        protocolVersion: String
    ) {
        self.model = model
        self.firmware = firmware
        self.serial = serial
        self.protocolVersion = protocolVersion
    }
}
