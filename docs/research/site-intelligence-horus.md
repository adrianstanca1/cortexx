# Site intelligence research carried forward from HORUS

The retired HORUS prototype contained three product ideas that remain relevant to Cortexx without importing its separate Python/MongoDB/React stack or biometric datasets.

## Safe integration targets

1. PPE compliance assistance — optional image/video analysis can flag likely helmet/vest issues for human review and create safety observations. It must not automatically discipline workers or treat model output as ground truth.
2. Equipment/asset movement intelligence — connect device/tag/location events to the canonical Equipment model, lifecycle history and utilization analytics. Prefer explicit site tags, QR/NFC/BLE/UWB/GPS identifiers over person-linked tracking.
3. Site progress intelligence — feed camera/site evidence into existing photos, drawings, programme, tasks and Agent OS analysis with provenance and confidence metadata.

## Not promoted to production

Face-recognition attendance, named-person re-identification and stored biometric reference images are intentionally not merged. They create materially different privacy, employment and compliance obligations and require a dedicated governance/design review before any future implementation. Cortexx continues to use its existing authenticated GPS/manual/QR-style attendance and evidence flows.

## Source preservation

The complete HORUS Git history and refs are preserved in the verified repository-retirement backup recorded in docs/reviews/2026-10-05-repository-retirement.md.
