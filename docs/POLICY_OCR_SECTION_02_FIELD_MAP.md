# Policy OCR Section 02 field map

Status: **MAPPED 2026-08-22 / VEHICLE EXTRACTION NOT IMPLEMENTED**

This is the implementation contract for the next OCR phase. It maps the current Policy Onboarding Section 02 form to the payload and database sources that must be used for OCR comparison. Google Document AI remains the reading layer; INSUREIT remains responsible for normalization, comparison, review and any later apply action.

## 1. Visible Section 02 inputs

| Section 02 control | Form state | Onboarding payload | Canonical current storage | Policy-time snapshot | Required comparison rule |
| --- | --- | --- | --- | --- | --- |
| Registration mode | `vehicleRegistrationMode` | `vehicle.registrationMode` | `vehicles.registration_status`; registered rows use `vehicle_no`/`vehicle_no_normalized` | affects `policy_party_snapshots.registration_number` | Enum: `registered` or `unregistered`; do not infer solely from a printed registration number |
| Registration No. | `registrationNo` | `vehicle.registrationNumber` | `vehicles.vehicle_no`, `vehicles.vehicle_no_normalized` | `policy_party_snapshots.registration_number` | Uppercase and remove non-alphanumeric characters before comparison |
| Insured name | `insuredName` | `customer.name` | `customers.contact_name` | `policy_party_snapshots.insured_name` | Case/spacing normalization only; identity field, masked in logs and excluded from training candidates |
| Phone number | `phoneNo` | `customer.phone` | `customers.phone` | `policy_party_snapshots.phone` | Last 10 digits; identity field, never stored in OCR proposal/candidate evidence |
| Class | `vehicleClass` | `vehicle.classCode` and derived `vehicle.classDescription` | `vehicles.vehicle_type`, `vehicle_class_code`, `vehicle_class_description` | `policy_party_snapshots.vehicle_class` stores the description | Compare canonical class code (`PCP`, `TWP`, `GCV`, `PCV`, `MISD`, `CPM`); keep printed description as evidence only |
| Make | `make` | `vehicle.make` | `vehicles.make` | `policy_party_snapshots.make` | Resolve through the active manufacturer/brand/alias master; unknown values require review |
| Model | `model` | `vehicle.model` | `vehicles.model` | `policy_party_snapshots.model` | Normalize case, whitespace and punctuation; do not merge model and variant without an explicit alias rule |
| Fuel type | `fuelType` | `vehicle.fuelType` | `vehicles.fuel_type` | `policy_party_snapshots.fuel_type` | Canonical enum: Petrol, Diesel, CNG, Electric, Hybrid, Bi-Fuel, Other |
| Year of manufacturing | `manufacturingYear` | `vehicle.manufacturingYear` | `vehicles.year` | `policy_party_snapshots.manufacturing_year` | Four-digit integer |
| RTO state | `rtoState` | `vehicle.rtoState` | `vehicles.rto_state` | `policy_party_snapshots.rto_state` | Compare normalized state/code; preserve source text for review |
| RTO name/code | `rtoName` | `vehicle.rtoName` | `vehicles.rto_name` | `policy_party_snapshots.rto_name` | Case/spacing normalization; exact code match when a code is present |
| Capacity | `capacity` | `vehicle.capacity`, plus class-specific payload below | class-specific vehicle column below | `policy_party_snapshots.capacity_value` | Numeric comparison with units removed; never compare CC, GVW and seats as the same measure |
| Chassis number | `chassisNo` | `vehicle.chassisNumber` | `vehicles.chassis_no` | `policy_party_snapshots.chassis_no` | Uppercase alphanumeric exact match; sensitive vehicle identity, masked in logs/candidates |
| Engine number | `engineNo` | `vehicle.engineNumber` | `vehicles.engine_no` | `policy_party_snapshots.engine_no` | Uppercase alphanumeric exact match; sensitive vehicle identity, masked in logs/candidates |

The server currently validates insured name, Indian mobile, class, make, model, fuel, year, capacity, chassis, engine, RTO state and RTO name for every motor onboarding submission. The UI visually marks chassis and engine as required only for an unregistered vehicle, but server validation currently requires both modes. Vehicle extraction must follow the server rule until product validation is deliberately changed.

## 2. Capacity fan-out

The visible `capacity` value is not one database measurement. `buildCreatePayload()` routes it by class:

| Class | UI label | Payload value populated from `capacity` | Vehicle column |
| --- | --- | --- | --- |
| `PCP`, `TWP` | CC | `vehicle.engineCapacity` | `vehicles.engine_capacity_cc` |
| `PCV` | Seating Capacity | `vehicle.seatingCapacity` | `vehicles.seating_capacity` |
| `GCV` | GVW | `vehicle.grossWeight` | `vehicles.gvw_kg` |
| `CPM` | Equipment Capacity | currently also `vehicle.grossWeight` | `vehicles.gvw_kg` |
| `MISD` | Category / CC | no reliable class-specific fan-out without AuthBridge data | snapshot `capacity_value`; possible `engine_capacity_cc`/`gvw_kg` only when supplied by verified RC data |

This class decision must happen before comparing a printed number. A value such as `1497` cannot be labelled as CC, kg or seats without the canonical vehicle class.

## 3. Derived AuthBridge fields already stored by onboarding

Section 02 can also persist fields that are not directly editable in the visible grid. They come from a reviewed AuthBridge RC result and are grouped in the UI as owner address, vehicle identity, technical details, compliance and finance:

- Customer/snapshot: address, city, district, state and pincode.
- Vehicle identity: category, body type, commercial flag, color and manufacture date.
- Technical: engine CC, seating, standing, sleeper, GVW, unladen weight, wheelbase and cylinders.
- Compliance: registration date/status/as-on, emission norm, fitness, road tax, PUC, local permit and national permit fields.
- Finance: financed flag, financer name and blacklist status.

These values map directly from `vehicle.*` payload keys in `buildCreatePayload()` to like-named columns in the `vehicles` update/insert inside `onboard_motor_policy(jsonb)`. They are out of scope for the first vehicle OCR increment. Add them only after the visible-field comparator is proven on reviewed documents.

## 4. Which database value is the OCR ground truth

For a policy-copy comparison, use `policy_party_snapshots` first for fields that it stores. A snapshot represents what was saved when that specific policy was onboarded; the linked `customers` or `vehicles` master row may have changed later. Use the current `vehicles` row only for fields absent from the snapshot, including class code and class-specific numeric capacity columns.

Precedence:

1. `policy_documents.policy_id` identifies the policy for the selected copy.
2. `policy_party_snapshots.policy_id` supplies policy-time insured/vehicle values.
3. `policies.vehicle_id -> vehicles.id` supplies class code and non-snapshot technical fields.
4. `policies.customer_id -> customers.id` is fallback only where no snapshot exists.

No OCR value may overwrite any of these records in the training flow. The UI must display stored value, OCR value, normalized result and confidence, then require human review.

## 5. Resolved schema/history hazard

The migration history contains competing temporary identifiers for unregistered vehicles. `202608210001_new_unregistered_vehicle_prefix.sql` changes the onboarding RPC to construct `NEW-<normalized chassis>`, while the later `202608211501_sync_pending_vehicle_identity.sql` trigger rewrites registration-pending vehicle rows to `PENDING-<normalized chassis>`. `20260821194052_canonical_new_vehicle_prefix.sql` is the forward fix: it restores the `NEW-` trigger/RPC behavior, safely repairs legacy temporary rows and asserts zero `PENDING-` vehicle prefixes. The onboarding snapshot separately remains `REGISTRATION PENDING`.

Vehicle extraction must compare unregistered status through `registration_status = 'registration_pending'` and must not learn `NEW-<chassis>`, legacy `PENDING-<chassis>` or `REGISTRATION PENDING` as a real registration number. The forward migration must be applied and verified in production before adding any auto-apply path.

## 6. Implementation gate for vehicle extraction

The next PR increment should begin with only these review-only proposal keys: registration number/status, class code, make, model, fuel type, manufacturing year, class-aware capacity, chassis number and engine number. Insured name may be displayed masked for comparison, but must remain excluded from training candidates and logs; phone must remain excluded entirely.

Before expanding further:

- add insurer-specific sanitized regressions for each new key;
- keep raw OCR text and real identity values out of source control, logs and approved candidate payloads;
- show confidence and bounded non-PII evidence labels;
- require a reviewer decision and separate owner approval;
- prove that a manual run targets exactly the selected `policy_ocr_training_labels.id`;
- do not write OCR results back to Section 02.

## 7. Source locations

- Visible controls and payload construction: `apps/web-portal/components/policy-unified-form.tsx`
- Server normalization/validation: `apps/web-portal/app/policies/policy-onboarding-actions.ts`
- Vehicle/snapshot schema and onboarding RPC: `supabase/migrations/20260805182000_policy_onboarding_v2.sql`
- Unregistered mode patch: `supabase/migrations/20260812170500_policy_onboarding_unregistered_vehicle_mode.sql`
- Temporary vehicle identity migrations: `supabase/migrations/202608210001_new_unregistered_vehicle_prefix.sql`, `supabase/migrations/202608211501_sync_pending_vehicle_identity.sql`, `supabase/migrations/20260821194052_canonical_new_vehicle_prefix.sql`
- Edit-page readback mapping: `apps/web-portal/app/policies/[id]/edit/page.tsx`
