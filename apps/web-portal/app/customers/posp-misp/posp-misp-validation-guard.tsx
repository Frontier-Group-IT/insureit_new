"use client";

import { useEffect } from "react";

type PartnerType = "posp" | "misp";

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MOBILE = /^(?:\+91)?[6-9][0-9]{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN = /^[0-9]{6}$/;
const AADHAAR = /^[0-9]{12}$/;
const ACCOUNT = /^[0-9]{6,20}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function PospMispValidationGuard({ formId, partnerType }: { formId: string; partnerType: PartnerType }) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    let invalidHandled = false;

    const validate = () => {
      const result = firstValidationError(new FormData(form), partnerType, orderedControlNames(form));
      if (!result) {
        clearFormErrors(form);
        return true;
      }
      showFieldError(form, result.field, result.message, true);
      return false;
    };

    const submit = (event: SubmitEvent) => {
      invalidHandled = false;
      if (!validate()) event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.closest("[data-posp-misp-submit]")) return;
      invalidHandled = false;
      if (!validate()) event.preventDefault();
    };
    const invalid = (event: Event) => {
      event.preventDefault();
      if (invalidHandled) return;
      const field = event.target;
      if (!isControl(field) || !field.name) return;
      invalidHandled = true;
      const message = validationErrorForField(field.name, new FormData(form), partnerType) ?? field.validationMessage;
      showFieldError(form, field.name, message, true);
    };
    const blur = (event: FocusEvent) => {
      const field = event.target;
      if (!isControl(field) || !field.name) return;
      field.dataset.validationTouched = "true";
      setFieldError(form, field.name, validationErrorForField(field.name, new FormData(form), partnerType));
    };
    const input = (event: Event) => {
      const field = event.target;
      if (!isControl(field) || !field.name) return;
      if (field instanceof HTMLInputElement && field.dataset.transform === "uppercase") field.value = field.value.toUpperCase().replace(/\s/g, "");
      if (field.dataset.validationTouched !== "true" && !hasFieldError(form, field.name)) return;
      setFieldError(form, field.name, validationErrorForField(field.name, new FormData(form), partnerType));
    };

    form.addEventListener("submit", submit);
    form.addEventListener("click", click, true);
    form.addEventListener("invalid", invalid, true);
    form.addEventListener("blur", blur, true);
    form.addEventListener("input", input);
    form.addEventListener("change", input);
    return () => {
      form.removeEventListener("submit", submit);
      form.removeEventListener("click", click, true);
      form.removeEventListener("invalid", invalid, true);
      form.removeEventListener("blur", blur, true);
      form.removeEventListener("input", input);
      form.removeEventListener("change", input);
    };
  }, [formId, partnerType]);

  return null;
}

function orderedControlNames(form: HTMLFormElement) {
  return Array.from(form.elements).flatMap((element) => isControl(element) && element.name && !element.disabled && element.type !== "hidden" ? [element.name] : []);
}

function firstValidationError(data: FormData, partnerType: PartnerType, names: string[]) {
  for (const name of names) {
    const message = validationErrorForField(name, data, partnerType);
    if (message) return { field: name, message };
  }
  return null;
}

function validationErrorForField(name: string, data: FormData, partnerType: PartnerType) {
  const isMisp = partnerType === "misp";
  const value = text(data, name);
  if (requiredFields(partnerType).has(name) && !value) return requiredMessage(name, isMisp);
  if (!value) return null;
  if ((name === "pan_number" || name === "dp_pan_number") && !PAN.test(compactUpper(value))) return `${labelFor(name, isMisp)} must use PAN format ABCDE1234F.`;
  if ((name === "applicant_phone" || name === "dp_phone") && !MOBILE.test(compactPhone(value))) return `${labelFor(name, isMisp)} must be a valid Indian mobile number.`;
  if ((name === "applicant_email" || name === "dp_email") && !EMAIL.test(value.toLowerCase())) return `${labelFor(name, isMisp)} must be a valid email address.`;
  if (name === "postal_code" && !PIN.test(digits(value))) return "PIN Code must contain exactly 6 digits.";
  if (name === "aadhaar_number" && !AADHAAR.test(digits(value))) return `${labelFor(name, isMisp)} must contain exactly 12 digits.`;
  if (name === "bank_account_number" && !ACCOUNT.test(digits(value))) return "Account Number must contain 6 to 20 digits.";
  if (name === "bank_ifsc_code" && !IFSC.test(compactUpper(value))) return "IFSC Code must use format ABCD0123456.";
  if (name === "gst_number" && !GST.test(compactUpper(value))) return "GST Number must be a valid 15-character GSTIN.";
  if (name === "date_of_birth" && Number.isNaN(Date.parse(value))) return `${labelFor(name, isMisp)} must be a valid date.`;
  return null;
}

function requiredFields(partnerType: PartnerType) {
  const common = ["associate_employee_id", "pan_number", "address", "city", "state", "postal_code", "date_of_birth", "aadhaar_number", "bank_id", "bank_account_number", "bank_ifsc_code"];
  return new Set(partnerType === "misp" ? [...common, "misp_name", "oem_name", "dp_first_name", "dp_last_name", "dp_phone", "dp_email", "dp_pan_number", "gst_number"] : [...common, "pos_first_name", "pos_last_name", "applicant_phone", "applicant_email"]);
}

function showFieldError(form: HTMLFormElement, name: string, message: string, clearPrevious: boolean) {
  if (clearPrevious) clearFormErrors(form);
  const field = form.elements.namedItem(name);
  if (!isControl(field)) return;
  const error = field.closest<HTMLElement>("[data-field-container]")?.querySelector<HTMLElement>("[data-field-error]");
  field.setAttribute("aria-invalid", "true");
  if (error) {
    error.textContent = message;
    error.hidden = false;
    field.setAttribute("aria-describedby", error.id);
  }
  requestAnimationFrame(() => {
    field.focus({ preventScroll: true });
    field.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function setFieldError(form: HTMLFormElement, name: string, message: string | null) {
  if (message) showFieldError(form, name, message, false);
  else clearFieldError(form, name);
}

function clearFieldError(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (!isControl(field)) return;
  const error = field.closest<HTMLElement>("[data-field-container]")?.querySelector<HTMLElement>("[data-field-error]");
  field.removeAttribute("aria-invalid");
  field.removeAttribute("aria-describedby");
  if (error) {
    error.textContent = "";
    error.hidden = true;
  }
}

function clearFormErrors(form: HTMLFormElement) {
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[aria-invalid='true']").forEach((field) => {
    if (field.name) clearFieldError(form, field.name);
  });
}

function hasFieldError(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  return isControl(field) && field.getAttribute("aria-invalid") === "true";
}

function isControl(value: unknown): value is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return value instanceof HTMLInputElement || value instanceof HTMLSelectElement || value instanceof HTMLTextAreaElement;
}

function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function compactUpper(value: string) {
  return value.replace(/\s/g, "").toUpperCase();
}

function compactPhone(value: string) {
  const digitsOnly = digits(value);
  if (digitsOnly.length > 10 && digitsOnly.startsWith("91")) return `+91${digitsOnly.slice(-10)}`;
  return value.replace(/\s/g, "");
}

function requiredMessage(name: string, isMisp: boolean) {
  if (name === "associate_employee_id") return "Please select RM Name.";
  if (name === "bank_id") return "Please select Bank Name.";
  if (name === "oem_name") return "Please select OEM Name.";
  return `${labelFor(name, isMisp)} is required.`;
}

function labelFor(name: string, isMisp: boolean) {
  const labels: Record<string, string> = {
    associate_employee_id: "RM Name",
    pan_number: isMisp ? "MISP PAN" : "PAN Number",
    misp_name: "MISP Name",
    pos_first_name: "POS First Name",
    pos_middle_name: "POS Middle Name",
    pos_last_name: "POS Last Name",
    oem_name: "OEM Name",
    address: "Address",
    city: "City",
    state: "State",
    postal_code: "PIN Code",
    applicant_phone: "Mobile Number",
    applicant_email: "Email",
    date_of_birth: isMisp ? "DP Date of Birth" : "Date of Birth",
    aadhaar_number: isMisp ? "DP Aadhaar Number" : "Aadhaar Number",
    dp_first_name: "DP First Name",
    dp_middle_name: "DP Middle Name",
    dp_last_name: "DP Last Name",
    dp_phone: "DP Contact",
    dp_email: "DP Email",
    dp_pan_number: "DP PAN No",
    bank_id: "Bank Name",
    bank_account_number: "Account Number",
    bank_ifsc_code: "IFSC Code",
    gst_number: "GST Number",
  };
  return labels[name] ?? name.replaceAll("_", " ");
}
