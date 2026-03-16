/// Transaction state machine per Doc 04.
/// Enforces valid transitions only; rejects illegal jumps.
/// No hidden jumps, every transition logged via callback.
import Foundation

public struct TransactionStateTransition: Sendable {
    public let from: TransactionState
    public let to: TransactionState
    public let timestampUtc: String

    public init(from: TransactionState, to: TransactionState, timestampUtc: String? = nil) {
        self.from = from
        self.to = to
        self.timestampUtc = timestampUtc ?? ISO8601DateFormatter().string(from: Date())
    }
}

public final class TransactionStateMachine: @unchecked Sendable {
    public private(set) var currentState: TransactionState
    private let onTransition: ((TransactionStateTransition) -> Void)?

    /// Valid transitions per Doc 04 canonical state graph
    private static let validTransitions: [TransactionState: Set<TransactionState>] = [
        .created: [.pendingDevice],
        .pendingDevice: [.cardPresented, .cardRead, .authorizing, .refundPending],
        .cardPresented: [.cardRead],
        .cardRead: [.authorizing],
        .authorizing: [.approved, .declined, .cancelled, .timedOut, .failed],
        .approved: [.reversalPending, .refundPending, .settlementPending],
        .reversalPending: [.reversed],
        .refundPending: [.refunded],
        .settlementPending: [.settled]
    ]

    public init(initialState: TransactionState = .created, onTransition: ((TransactionStateTransition) -> Void)? = nil) {
        self.currentState = initialState
        self.onTransition = onTransition
    }

    /// Attempt transition. Returns true if valid, false if rejected.
    @discardableResult
    public func transition(to newState: TransactionState) -> Bool {
        let allowed = Self.validTransitions[currentState] ?? []
        guard allowed.contains(newState) else {
            return false
        }
        let transition = TransactionStateTransition(from: currentState, to: newState)
        currentState = newState
        onTransition?(transition)
        return true
    }

    /// Attempt transition; throws PathError if invalid.
    public func transitionOrThrow(to newState: TransactionState) throws {
        guard transition(to: newState) else {
            throw PathError(
                code: .protocolMismatch,
                message: "Invalid state transition from \(currentState.rawValue) to \(newState.rawValue)",
                recoverable: false
            )
        }
    }

    /// Whether the current state is terminal (no further transitions expected)
    public var isInTerminalState: Bool {
        switch currentState {
        case .declined, .cancelled, .timedOut, .failed, .reversed, .refunded, .settled:
            return true
        case .approved:
            return false
        default:
            return false
        }
    }

    /// Whether the transaction has reached a successful outcome
    public var isApproved: Bool {
        currentState == .approved || currentState == .refunded || currentState == .reversed || currentState == .settled
    }
}
