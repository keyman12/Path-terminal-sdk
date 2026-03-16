# 01. Product Brief

## Product
Path Terminal SDK

## Purpose
Build a protocol-first terminal integration platform for banks, acquirers, and ISVs. The product combines:
- a partner-facing SDK
- a pre-integrated test dongle / emulator
- an MCP server for AI-assisted integration and support
- operational diagnostics and long-tail regression tooling

## Current assets
- The current EPOS demo is an iPad SwiftUI/MVVM app with inventory, cart, category filtering, and payment flow. It is a strong iOS harness for SDK integration testing.
- The current emulator runs on Raspberry Pi Pico 2 W with BLE and optional NFC. Sale exists today, with refund, reversal, cancellation, completion, login, logout, loyalty, and MCP integration already identified as next steps.

## Core value
- one stable integration contract
- one stable test target
- one support model
- one AI-readable tool and docs surface

## Recommended v0.1
- iOS SDK
- sale
- refund
- status
- receipt data
- mock adapter
- emulator adapter
- diagnostics bundle
- MCP resources + sale/refund/status tools
