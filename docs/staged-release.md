This release is staged for application compatibility verification. Its files and tag are immutable; promotion changes only GitHub release metadata and the marketplace catalogs.

Do not promote the catalog until the application's pinned contract tests pass and its compatible production deployment reaches READY. The published channel remains on the previous version during verification.

Version 0.1.30 preserves recorded zero effort in the Progress card. It requires
the compatible application producer that omits average RPE when no sample
exists, minimum commit `7531e230ba379ba8ad2f9936b508114f0c0dba0d`.
The application must deploy that producer together with this release's pin.
Confirm the exact application deployment is READY and the minimum commit is
reachable before promoting. Public catalogs and channels remain on 0.1.29
throughout staging.
