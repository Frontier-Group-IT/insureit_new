import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=(p)=>readFileSync('apps/partner-app/'+p,'utf8');
const calendar=get('components/policy-intakes/partner-policy-calendar-dialog.tsx');
const dates=get('components/policy-intakes/partner-policy-date-field.tsx');
const onboarding=get('app/policy-intakes/onboarding.tsx');
const partner=get('app/partner-new.tsx');
const caseDetails=get('app/life-health-cases/[id].tsx');

assert.match(calendar,/onPress=\{\(\) => onConfirm\(candidate\)\}/,'Selecting day immediately commits');
assert.match(calendar,/onRequestClose=\{onCancel\}/,'Android back dismisses without saving');
assert.match(calendar,/accessibilityLabel="Dismiss calendar" onPress=\{onCancel\}/,'Outside tap dismisses without saving');
assert.match(calendar,/disabled=\{disabled\}/,'Disabled future dates cannot be selected');
assert.match(calendar,/maximumDate\?: Date/,'Calendar supports date-limit restrictions');
assert.match(calendar,/setYearMode\(false\)/,'Year chooser keeps month/year navigation');
assert.doesNotMatch(calendar,/>CANCEL<|>OK<|onConfirm\(draft\)/,'No calendar confirmation step');
assert.match(dates,/Platform.OS!=='web'\?<PartnerPolicyCalendarDialog/,'Onboarding uses shared calendar for iOS and Android');
assert.match(dates,/onChange\(toIso\(date\)\);setPickerOpen\(false\)/,'Immediate selection persists ISO and dismisses');
assert.match(dates,/displayIndianDate\(value\)/,'Existing Indian date presentation retained');
assert.doesNotMatch(dates,/DateTimePicker|>Done</,'No native Android confirmation or iOS Done action');
assert.match(onboarding,/if\(f.date\)return <PartnerPolicyDateField/,'All product date fields reuse direct selection');
assert.match(onboarding,/onChange=\{v=>update\(f.key,v\)\}/,'Motor date validation update path retained');
assert.match(onboarding,/onChange=\{v=>updateProduct\(f.key,v\)\}/,'Life, Health, and Non Motor date update path retained');
assert.match(partner,/visible=\{Boolean\(dateField\)\}/,'Add Partner uses shared direct-select calendar');
assert.match(partner,/maximumDate=\{new Date\(\)\}/,'Add Partner restricts future dates');
assert.match(partner,/onConfirm=\{date => setSelectedDate\(date\)\}/,'Add Partner maintains DD/MM/YYYY update');
assert.match(caseDetails,/key==='sourcingDate'\?<Pressable/,'Case proposal date uses calendar');
assert.match(caseDetails,/date\?<View style=\{\[styles.fieldBox,styles.issueFieldRow\]\}>/,'Case issuance date fields use calendar');
for(const field of ['issuanceDate','startDate','endDate','pptEndDate','nextInstallmentDate']){
  assert.ok(caseDetails.includes('"' + field + '"'),'Case issue form retains date field '+field);
}
assert.match(caseDetails,/if\(calendarField==='sourcingDate'\)setField\('sourcingDate',year\+'-'\+month\+'-'\+day\)/,'Case proposal date remains ISO');
assert.match(caseDetails,/else if\(calendarField\)setIssued\(calendarField,day\+'\/'\+month\+'\/'\+year\)/,'Case issue date preserves existing derived terms and approval resets');
assert.match(caseDetails,/onConfirm=\{chooseCalendarDay\}/,'Case selection updates immediately');
assert.match(caseDetails,/onCancel=\{\(\)=>setCalendarField\(null\)\}/,'Case calendar supports dismiss without update');
assert.match(caseDetails,/Clear '\+label\+' date'/,'Optional issued dates remain clearable');
console.log('Partner direct-select date fields and preservation contracts passed.');
