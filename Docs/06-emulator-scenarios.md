# 06. Emulator and Scenario Plan

## Role
The emulator is:
- partner integration target
- support reproduction target
- regression harness
- training device
- demo tool

## Current base
Runs on Raspberry Pi Pico 2 W with BLE and optional NFC. Sale exists already.

## Required scenario engine
Move to named scenario files:
- sale_approved.json
- sale_declined.json
- refund_approved.json
- refund_declined.json
- terminal_busy.json
- timeout_during_auth.json
- disconnect_during_auth.json
- reversal_required.json
- receipt_unavailable.json

## Regression rule
Every production issue should create:
- a scenario file
- an automated test
- a support note / runbook entry
