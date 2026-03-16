/// Discovered BLE device for connection.
/// Maps to EPOS DeviceItem (id, name, rssi).
import Foundation

public struct DiscoveredDevice: Identifiable, Equatable, Sendable, Codable {
    public let id: UUID
    public let name: String
    public let rssi: Int

    public init(id: UUID, name: String, rssi: Int) {
        self.id = id
        self.name = name
        self.rssi = rssi
    }
}
