import unittest

from app import detect_parser, extract_policy_section_fields


def values(fields):
    return {field["key"]: field["value"] for field in fields}


class SupportedParserTests(unittest.TestCase):
    def test_digit_commercial_vehicle_schedule(self):
        page = """
        Digit Commercial Vehicle Insurance
        Go Digit General Insurance Ltd. Schedule/Certificate
        Policy No: D221859721
        Digit Commercial Vehicle Comprehensive Policy
        YOUR POLICY DETAILS
        Period of Policy From 27-Aug-2025 17:24:59 To 26-Aug-2026 23:59:59
        YOUR VEHICLE IDV
        Total IDV (`)
        3292441.00
        OWN DAMAGE PREMIUM [A] (`) LIABILITY PREMIUM [B] (`)
        Own Damage Premium (`) 27820.86 Basic Third-Party Liability (`) 7267.00
        PA cover for Owner-Driver (`) --
        Net Premium [A+B] 35087.86
        IGST @ 18% = (`6315.81)
        Total Premium (`) 41403.67
        """
        parser_id = detect_parser(page)
        self.assertEqual(parser_id, "digit_commercial_motor_v1")
        result = values(extract_policy_section_fields([page], parser_id))
        self.assertEqual(result["insurer_name"], "Go Digit General Insurance Ltd.")
        self.assertEqual(result["policy_product"], "Package")
        self.assertEqual(result["policy_number"], "D221859721")
        self.assertEqual(result["policy_start_date"], "2025-08-27")
        self.assertEqual(result["policy_end_date"], "2026-08-26")
        self.assertEqual(result["idv"], "3292441")
        self.assertEqual(result["od_premium"], "27820.86")
        self.assertEqual(result["tp_premium"], "7267")
        self.assertEqual(result["cpa_opted"], "No")
        self.assertEqual(result["cpa_premium"], "0")

    def test_iffco_tokio_commercial_vehicle_schedule(self):
        page = """
        IFFCO-TOKIO GENERAL INSURANCE CO.LTD
        COMMERCIAL VEHICLE CERTIFICATE OF INSURANCE cum SCHEDULE & TAX INVOICE
        Policy #: 1-8N1JSC69 P400 Policy # N8174870
        Period of Insurance From: 29/07/2026 18:16:22
        To: Midnight On 28/07/2027 23:59:59
        Coverage IDV in Rs.
        Package 3391729
        Total Value Net Premium Rs.
        3391729.00 14558.84
        A. Own Damage (Rs.) B. Third Party (Rs.)
        PA Owner Driver CSI Rs 1500000 330.00
        Net (A) 4641.00 Net (B) 7697.00
        Premium/Taxable Value RS. 12338.00
        GST Amount(Rs.) 2220.84
        Gross Premium Payable Rs. 14558.84
        """
        parser_id = detect_parser(page)
        self.assertEqual(parser_id, "iffco_tokio_commercial_motor_v1")
        result = values(extract_policy_section_fields([page], parser_id))
        self.assertEqual(result["insurer_name"], "IFFCO-Tokio General Insurance Co. Ltd.")
        self.assertEqual(result["policy_product"], "Package")
        self.assertEqual(result["policy_number"], "N8174870")
        self.assertEqual(result["policy_start_date"], "2026-07-29")
        self.assertEqual(result["policy_end_date"], "2027-07-28")
        self.assertEqual(result["idv"], "3391729")
        self.assertEqual(result["od_premium"], "4641")
        self.assertEqual(result["tp_premium"], "7697")
        self.assertEqual(result["cpa_opted"], "Yes")
        self.assertEqual(result["cpa_premium"], "330")
        self.assertEqual(result["total_premium"], "12338")
        self.assertEqual(result["tax_amount"], "2220.84")
        self.assertEqual(result["gross_premium"], "14558.84")


if __name__ == "__main__":
    unittest.main()
