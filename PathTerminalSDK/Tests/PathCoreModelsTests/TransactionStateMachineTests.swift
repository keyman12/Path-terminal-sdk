import XCTest
@testable import PathCoreModels

final class TransactionStateMachineTests: XCTestCase {
    func testInitialStateIsCreated() {
        let sm = TransactionStateMachine()
        XCTAssertEqual(sm.currentState, .created)
    }

    func testValidSaleFlow() {
        let sm = TransactionStateMachine()
        XCTAssertTrue(sm.transition(to: .pendingDevice))
        XCTAssertTrue(sm.transition(to: .cardPresented))
        XCTAssertTrue(sm.transition(to: .cardRead))
        XCTAssertTrue(sm.transition(to: .authorizing))
        XCTAssertTrue(sm.transition(to: .approved))
        XCTAssertEqual(sm.currentState, .approved)
        XCTAssertTrue(sm.isApproved)
    }

    func testValidSaleFlowDeclined() {
        let sm = TransactionStateMachine()
        sm.transition(to: .pendingDevice)
        sm.transition(to: .cardPresented)
        sm.transition(to: .cardRead)
        sm.transition(to: .authorizing)
        XCTAssertTrue(sm.transition(to: .declined))
        XCTAssertTrue(sm.isInTerminalState)
    }

    func testValidRefundFlowFromPendingDevice() {
        let sm = TransactionStateMachine()
        sm.transition(to: .pendingDevice)
        XCTAssertTrue(sm.transition(to: .refundPending))
        XCTAssertTrue(sm.transition(to: .refunded))
        XCTAssertEqual(sm.currentState, .refunded)
        XCTAssertTrue(sm.isApproved)
    }

    func testValidReversalFlow() {
        let sm = TransactionStateMachine()
        sm.transition(to: .pendingDevice)
        sm.transition(to: .cardPresented)
        sm.transition(to: .cardRead)
        sm.transition(to: .authorizing)
        sm.transition(to: .approved)
        XCTAssertTrue(sm.transition(to: .reversalPending))
        XCTAssertTrue(sm.transition(to: .reversed))
        XCTAssertEqual(sm.currentState, .reversed)
    }

    func testInvalidTransitionFromCreatedToApproved() {
        let sm = TransactionStateMachine()
        XCTAssertFalse(sm.transition(to: .approved))
        XCTAssertEqual(sm.currentState, .created)
    }

    func testInvalidTransitionFromCreatedToCardRead() {
        let sm = TransactionStateMachine()
        XCTAssertFalse(sm.transition(to: .cardRead))
        XCTAssertEqual(sm.currentState, .created)
    }

    func testInvalidTransitionFromApprovedToCreated() {
        let sm = TransactionStateMachine()
        sm.transition(to: .pendingDevice)
        sm.transition(to: .cardPresented)
        sm.transition(to: .cardRead)
        sm.transition(to: .authorizing)
        sm.transition(to: .approved)
        XCTAssertFalse(sm.transition(to: .created))
        XCTAssertEqual(sm.currentState, .approved)
    }

    func testInvalidTransitionFromDeclinedToApproved() {
        let sm = TransactionStateMachine()
        sm.transition(to: .pendingDevice)
        sm.transition(to: .authorizing)
        sm.transition(to: .declined)
        XCTAssertFalse(sm.transition(to: .approved))
        XCTAssertEqual(sm.currentState, .declined)
    }

    func testTransitionCallbackFired() {
        var transitions: [TransactionStateTransition] = []
        let sm = TransactionStateMachine { transitions.append($0) }
        sm.transition(to: .pendingDevice)
        sm.transition(to: .cardPresented)
        XCTAssertEqual(transitions.count, 2)
        XCTAssertEqual(transitions[0].from, .created)
        XCTAssertEqual(transitions[0].to, .pendingDevice)
        XCTAssertEqual(transitions[1].from, .pendingDevice)
        XCTAssertEqual(transitions[1].to, .cardPresented)
    }

    func testTransitionOrThrowValid() throws {
        let sm = TransactionStateMachine()
        try sm.transitionOrThrow(to: .pendingDevice)
        XCTAssertEqual(sm.currentState, .pendingDevice)
    }

    func testTransitionOrThrowInvalid() {
        let sm = TransactionStateMachine()
        XCTAssertThrowsError(try sm.transitionOrThrow(to: .approved)) { error in
            XCTAssertTrue(error is PathError)
            let pathError = error as? PathError
            XCTAssertEqual(pathError?.code, .protocolMismatch)
        }
    }

    func testAllTerminalOutcomes() {
        let terminalOutcomes: [TransactionState] = [.declined, .cancelled, .timedOut, .failed]
        for outcome in terminalOutcomes {
            let sm = TransactionStateMachine()
            sm.transition(to: .pendingDevice)
            sm.transition(to: .authorizing)
            XCTAssertTrue(sm.transition(to: outcome), "Should allow transition to \(outcome)")
            XCTAssertTrue(sm.isInTerminalState)
        }
    }
}
