from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import requests


@dataclass(frozen=True)
class PanVerificationJob:
    id: str
    application_id: str
    onboarding_profile_id: str | None
    partner_type: str
    pan_number: str
    attempt_count: int


class InsureItPanVerificationClient:
    """HTTP client used by IIB_POS_PAN_Checker - (N_M) connected mode."""

    def __init__(self, base_url: str, worker_key: str, device_name: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.worker_key = worker_key.strip()
        self.device_name = device_name.strip()[:120]
        self.timeout = timeout
        if not self.base_url or not self.worker_key:
            raise ValueError("InsureIt URL and worker key are required")

    def claim_jobs(self, limit: int = 20) -> list[PanVerificationJob]:
        payload = self._post(
            "/api/internal/pan-verification/claim",
            {"limit": max(1, min(limit, 100)), "device": self.device_name},
        )
        return [
            PanVerificationJob(
                id=str(row["id"]),
                application_id=str(row["application_id"]),
                onboarding_profile_id=(str(row["onboarding_profile_id"]) if row.get("onboarding_profile_id") else None),
                partner_type=str(row["partner_type"]),
                pan_number=str(row["pan_number"]).strip().upper(),
                attempt_count=int(row.get("attempt_count") or 1),
            )
            for row in payload.get("jobs", [])
        ]

    def complete_job(self, job_id: str, status: str, result_message: str | None = None) -> None:
        if status not in {"matched", "not_found", "invalid"}:
            raise ValueError("Unsupported successful result status")
        self._post(
            "/api/internal/pan-verification/complete",
            {
                "jobId": job_id,
                "status": status,
                "resultMessage": result_message,
                "device": self.device_name,
            },
        )

    def fail_job(self, job_id: str, error: str) -> None:
        self._post(
            "/api/internal/pan-verification/complete",
            {
                "jobId": job_id,
                "status": "failed",
                "error": error[:1000],
                "device": self.device_name,
            },
        )

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        response = requests.post(
            f"{self.base_url}{path}",
            json=body,
            headers={"x-pan-worker-key": self.worker_key},
            timeout=self.timeout,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("Unexpected InsureIt response")
        return payload
