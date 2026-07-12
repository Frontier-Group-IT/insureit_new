# INSUREIT UI Design System

## Product direction

INSUREIT should feel like a modern insurance operations console: precise, trustworthy, fast, dense, and calm. Operational clarity takes priority over decorative dashboards.

## Core principles

1. One visual language across Customers, Vehicles, Policies, Claims, Tasks, and Reports.
2. Neutral surfaces with one primary accent.
3. Dense but readable tables and forms.
4. Status must be communicated with text and icon, not colour alone.
5. Loading patterns must match the scope of the action.
6. Common actions remain visible; secondary actions live in menus.

## Colour tokens

- App background: `#F4F6FA`
- Surface: `#FFFFFF`
- Primary text: `#17203A`
- Secondary text: `#667085`
- Border: `#DDE3EC`
- Primary accent: `#7067E8`
- Accent hover: `#5D55D8`
- Accent soft: `#E9EBFF`
- Success: `#15803D`
- Warning: `#B45309`
- Danger: `#B91C1C`
- Information: `#0369A1`

## Typography

Use Inter throughout.

- Page title: 20px / 600
- Section title: 14px / 600
- Body: 12–13px / 400
- Table header: 10px / 600 / uppercase
- Caption: 10–11px / 400
- Button: 11–12px / 600

## Spacing

Use only the following spacing scale where practical:

`4, 8, 12, 16, 24, 32`

## Radius

- Inputs and buttons: 6px
- Panels and tables: 8–10px
- Modals: 12px
- Status pills: full radius

## Shadows

- Standard surface: `0 1px 2px rgba(15,23,42,.04)`
- Floating menu: `0 12px 28px rgba(15,23,42,.14)`

## Page anatomy

1. Shell navigation
2. Page header with title, description, count, and primary action
3. Toolbar with search and filters on the left, view/export controls on the right
4. Main table or form surface
5. Contextual selection toolbar when rows are selected
6. Pagination or sticky form actions

## Customers list specification

- Content max width: 1480px
- Customer column: 270px
- Partner type: 180px
- Mobile: 155px
- City: 140px
- Fleet: 90px
- Vehicles: 90px
- Status: 130px
- Action: 56px
- Row height: 52px
- Customer name is the primary link
- Legal trade name is secondary text
- Customer code uses muted monospace text
- Add Customer remains visible in the page header
- Export is disabled until rows are selected
- Partner type and status are independent filters

## Add Customer specification

- Form max width: 1240px
- Use one main form workspace with internal section dividers
- Section order: Personal, Address, Identity, GST, Fleet
- Short inputs may use three columns
- Address and document groups use two or three columns depending on width
- Document controls show one of: Pending, Uploading, Uploaded, Rejected
- Selected filename remains visible and replaceable
- GST details remain isolated from identity documents
- Long forms use a sticky action footer

## Loading patterns

- Route navigation: translucent overlay or slim progress bar
- Form save: button pending state plus persistent overlay until redirect or error
- Table refresh: skeleton rows
- Document upload: per-file progress state

## Validation and feedback

- Validate PAN, Aadhaar, GSTIN, phone, and city before final submission
- Keep entered values after validation errors
- Never expose raw database constraint errors
- Use themed toast messages, inline field errors, and confirmation modals

## Accessibility

- Minimum practical click target: 32px for dense desktop controls
- Visible keyboard focus
- Connected labels and controls
- Menus keyboard accessible
- Colour never communicates state by itself
- Loading and save states announced to assistive technology
