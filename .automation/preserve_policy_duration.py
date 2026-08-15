from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text()

old_helper = '''function policyExpiryFrom(start:string){if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(start))return"";const[y,m,d]=start.split("-").map(Number);const expiry=new Date(Date.UTC(y+1,m-1,d));expiry.setUTCDate(expiry.getUTCDate()-1);return expiry.toISOString().slice(0,10);}\n'''
new_helper = '''function policyExpiryFrom(start:string){if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(start))return"";const[y,m,d]=start.split("-").map(Number);const expiry=new Date(Date.UTC(y+1,m-1,d));expiry.setUTCDate(expiry.getUTCDate()-1);return expiry.toISOString().slice(0,10);}\nfunction shiftedPolicyEnd(newStart:string,oldStart:string,oldEnd:string){if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(newStart)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(oldStart)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(oldEnd))return policyExpiryFrom(newStart);const oldStartMs=new Date(`${oldStart}T00:00:00Z`).getTime(),oldEndMs=new Date(`${oldEnd}T00:00:00Z`).getTime();if(oldEndMs<oldStartMs)return policyExpiryFrom(newStart);const durationDays=Math.round((oldEndMs-oldStartMs)/86400000);const next=new Date(`${newStart}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+durationDays);return next.toISOString().slice(0,10);}\n'''
if text.count(old_helper) != 1:
    raise SystemExit(f'Expected policyExpiryFrom helper once, found {text.count(old_helper)}')
text = text.replace(old_helper, new_helper, 1)

old_action = '''    if(action==="use_suggested_start"&&(businessConflict.type==="coverage_overlap"||businessConflict.type==="coverage_gap")){const start=businessConflict.suggestedStartDate;setForm(current=>({...current,validFrom:start,validUpto:policyExpiryFrom(start)}));setBusinessConflict(null);goToSection(2);return;}'''
new_action = '''    if(action==="use_suggested_start"&&(businessConflict.type==="coverage_overlap"||businessConflict.type==="coverage_gap")){const start=businessConflict.suggestedStartDate;setForm(current=>({...current,validFrom:start,validUpto:shiftedPolicyEnd(start,current.validFrom,current.validUpto)}));setBusinessConflict(null);goToSection(2);return;}'''
if text.count(old_action) != 1:
    raise SystemExit(f'Expected suggested-start action once, found {text.count(old_action)}')
text = text.replace(old_action, new_action, 1)

path.write_text(text)
print('Preserved original policy duration when shifting renewal start date')
