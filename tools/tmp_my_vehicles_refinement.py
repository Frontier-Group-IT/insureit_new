from pathlib import Path
from PIL import Image, ImageDraw

assets = Path("apps/mobile-app/assets/vehicles")
assets.mkdir(parents=True, exist_ok=True)
W, H = 900, 420
navy = "#173E70"
blue = "#3E78B6"
pale = "#EDF5FF"
muted = "#AFC7DF"
dark = "#172B4D"
white = "#FFFFFF"

# Bus sketch
img = Image.new("RGBA", (W, H), (255, 255, 255, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((72, 108, 826, 316), radius=42, fill=pale, outline=navy, width=10)
d.polygon([(735, 108), (826, 150), (826, 246), (735, 246)], fill="#DDEEFF", outline=navy)
d.line((735, 112, 735, 247), fill=navy, width=8)
x = 120
for _ in range(6):
    d.rounded_rectangle((x, 137, x + 82, 216), radius=10, fill=white, outline=muted, width=5)
    x += 98
d.rounded_rectangle((132, 235, 242, 295), radius=8, fill="#DCEBFA", outline=blue, width=5)
d.line((265, 257, 700, 257), fill=blue, width=7)
d.line((265, 278, 700, 278), fill=muted, width=5)
for cx in (220, 690):
    d.ellipse((cx - 55, 270, cx + 55, 380), fill=dark, outline=navy, width=7)
    d.ellipse((cx - 26, 299, cx + 26, 351), fill="#D9E3EE", outline=white, width=5)
d.rounded_rectangle((788, 180, 838, 214), radius=9, fill="#F6C85F", outline=navy, width=5)
img.save(assets / "bus sketch.png")

# Bike sketch
img = Image.new("RGBA", (W, H), (255, 255, 255, 0))
d = ImageDraw.Draw(img)
for cx in (250, 680):
    d.ellipse((cx - 104, 188, cx + 104, 396), outline=navy, width=12)
    d.ellipse((cx - 74, 218, cx + 74, 366), outline=muted, width=5)
d.line((250, 292, 410, 202, 530, 296, 250, 292), fill=blue, width=13, joint="curve")
d.line((410, 202, 476, 302), fill=navy, width=11)
d.line((530, 296, 620, 184), fill=navy, width=12)
d.line((620, 184, 680, 292), fill=blue, width=11)
d.line((612, 177, 650, 135), fill=navy, width=9)
d.line((638, 137, 705, 132), fill=navy, width=8)
d.rounded_rectangle((350, 160, 477, 194), radius=13, fill="#DDEEFF", outline=navy, width=7)
d.polygon([(445, 190), (536, 202), (563, 251), (490, 265), (425, 224)], fill=pale, outline=navy)
d.ellipse((439, 232, 520, 313), fill="#E2EAF3", outline=navy, width=7)
d.rounded_rectangle((322, 127, 425, 157), radius=11, fill=dark, outline=navy, width=5)
d.line((320, 148, 276, 198), fill=navy, width=8)
d.line((533, 298, 570, 326), fill=navy, width=7)
d.line((469, 303, 433, 334), fill=navy, width=7)
img.save(assets / "bike sketch.png")

# JCB / backhoe-loader style construction sketch
img = Image.new("RGBA", (W, H), (255, 255, 255, 0))
d = ImageDraw.Draw(img)
yellow = "#F7C948"
yellow2 = "#FFE8A3"
for cx, r in ((300, 82), (655, 64)):
    cy = 318
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=dark, outline=navy, width=8)
    d.ellipse((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), fill="#D8E1EA", outline=white, width=5)
d.rounded_rectangle((260, 210, 665, 306), radius=22, fill=yellow, outline=navy, width=9)
d.polygon([(400, 208), (432, 100), (568, 100), (618, 210)], fill=yellow2, outline=navy)
d.polygon([(446, 118), (548, 118), (584, 202), (421, 202)], fill="#DCEEFF", outline=navy)
d.line((500, 118, 500, 201), fill=muted, width=6)
d.line((625, 218, 742, 168, 812, 220), fill=yellow, width=30)
d.line((625, 218, 742, 168, 812, 220), fill=navy, width=7)
d.polygon([(790, 212), (862, 235), (842, 295), (774, 278)], fill=yellow2, outline=navy)
d.line((276, 218, 180, 152, 118, 210), fill=yellow, width=27)
d.line((276, 218, 180, 152, 118, 210), fill=navy, width=7)
d.line((120, 207, 83, 285), fill=yellow, width=23)
d.line((120, 207, 83, 285), fill=navy, width=6)
d.polygon([(58, 280), (115, 281), (100, 326), (42, 320)], fill=yellow2, outline=navy)
d.rounded_rectangle((565, 236, 646, 267), radius=10, fill=yellow2, outline=navy, width=5)
d.line((360, 228, 360, 291), fill=blue, width=5)
d.line((390, 228, 390, 291), fill=blue, width=5)
img.save(assets / "jcb sketch.png")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected fragment missing: {label}")
    return text.replace(old, new, 1)


vehicles_path = Path("apps/mobile-app/app/customer/vehicles.tsx")
text = vehicles_path.read_text()

text = replace_once(
    text,
    "const truckSketch = require('../../assets/vehicles/truck sketch.png');\nconst carSketch = require('../../assets/vehicles/car sketch.png');",
    "const truckSketch = require('../../assets/vehicles/truck sketch.png');\nconst carSketch = require('../../assets/vehicles/car sketch.png');\nconst busSketch = require('../../assets/vehicles/bus sketch.png');\nconst bikeSketch = require('../../assets/vehicles/bike sketch.png');\nconst jcbSketch = require('../../assets/vehicles/jcb sketch.png');",
    "vehicle sketch imports",
)
text = replace_once(
    text,
    "        const vehicleImage = isPrivateVehicle(vehicle) ? carSketch : truckSketch;",
    "        const vehicleImage = vehicleSketchFor(vehicle);",
    "vehicle image selector",
)

old_right = '''              <View style={styles.rightPane}>
                <InfoBlock
                  icon="shield-car"
                  iconBg="#EAF3FF"
                  iconColor={palette.navy}
                  label="Insurance Company"
                  value={insurer?.name ?? 'Insurance company pending'}
                  logo={insurerLogo}
                  badge={externalPolicy ? 'External' : undefined}
                />
                <InfoBlock
                  icon="file-document-outline"
                  iconBg="#EAF8F1"
                  iconColor="#12805C"
                  label="Policy Number"
                  value={policy?.policy_no ?? '-'}
                  statusActive={active}
                />
                <InfoBlock
                  icon="calendar-alert"
                  iconBg="#FFECEF"
                  iconColor="#E84C88"
                  label="Policy Expiry Date"
                  value={policy ? formatDate(policy.end_date) : '-'}
                />
                {!active ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={(event) => {
                      event.stopPropagation();
                      router.push({ pathname: '/customer/add-policy', params: { vehicleId: vehicle.id } });
                    }}
                    style={styles.inlineAddPolicy}
                  >
                    <MaterialCommunityIcons name="shield-plus-outline" size={14} color="#0A43A3" />
                    <Text style={styles.inlineAddPolicyText}>Add policy</Text>
                  </Pressable>
                ) : null}
              </View>'''
new_right = '''              <View style={styles.rightPane}>
                {policy ? (
                  <>
                    <InfoBlock
                      icon="shield-car"
                      iconBg="#EAF3FF"
                      iconColor={palette.navy}
                      label="Insurance Company"
                      value={insurer?.name ?? 'Insurance company pending'}
                      logo={insurerLogo}
                      badge={externalPolicy ? 'External' : undefined}
                    />
                    <InfoBlock
                      icon="file-document-outline"
                      iconBg="#EAF8F1"
                      iconColor="#12805C"
                      label="Policy Number"
                      value={policy.policy_no}
                      statusActive={active}
                    />
                    <InfoBlock
                      icon="calendar-alert"
                      iconBg="#FFECEF"
                      iconColor="#E84C88"
                      label="Policy Expiry Date"
                      value={formatDate(policy.end_date)}
                    />
                  </>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add policy for ${vehicle.vehicle_no}`}
                    onPress={(event) => {
                      event.stopPropagation();
                      router.push({ pathname: '/customer/add-policy', params: { vehicleId: vehicle.id } });
                    }}
                    style={({ pressed }) => [styles.policyEmptyState, pressed && styles.policyEmptyStatePressed]}
                  >
                    <View style={styles.policyEmptyIcon}>
                      <MaterialCommunityIcons name="shield-plus-outline" size={31} color="#0A43A3" />
                    </View>
                    <Text style={styles.policyEmptyTitle}>Add policy</Text>
                    <Text style={styles.policyEmptyText}>No policy information available</Text>
                    <View style={styles.policyEmptyButton}>
                      <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
                      <Text style={styles.policyEmptyButtonText}>Add now</Text>
                    </View>
                  </Pressable>
                )}
              </View>'''
text = replace_once(text, old_right, new_right, "policy pane")

old_private = '''function isPrivateVehicle(vehicle: Vehicle) {
  return (vehicle.vehicle_type ?? '').toLowerCase().includes('private');
}'''
new_private = '''function vehicleClassCode(vehicle: Vehicle) {
  const normalized = (vehicle.vehicle_type ?? '').trim().toUpperCase();
  if (normalized === 'PCP' || normalized.startsWith('PCP ')) return 'PCP';
  if (normalized === 'TWP' || normalized.startsWith('TWP ') || normalized.includes('TWO WHEEL') || normalized.includes('MOTORCYCLE') || normalized.includes('BIKE')) return 'TWP';
  if (normalized === 'PCV' || normalized.startsWith('PCV ') || normalized.includes('PASSENGER') || normalized.includes('BUS')) return 'PCV';
  if (normalized === 'MISD' || normalized.startsWith('MISD ') || normalized.includes('MISCELLANEOUS')) return 'MISD';
  if (normalized === 'CPM' || normalized.startsWith('CPM ') || normalized.includes('PLANT') || normalized.includes('MACHINERY')) return 'CPM';
  if (normalized === 'GCV' || normalized.startsWith('GCV ') || normalized.includes('GOODS')) return 'GCV';
  if (normalized.includes('PRIVATE') || normalized.includes('CAR')) return 'PCP';
  return normalized || 'GCV';
}

function vehicleSketchFor(vehicle: Vehicle) {
  switch (vehicleClassCode(vehicle)) {
    case 'PCP': return carSketch;
    case 'PCV': return busSketch;
    case 'TWP': return bikeSketch;
    case 'MISD':
    case 'CPM': return jcbSketch;
    default: return truckSketch;
  }
}

function isPrivateVehicle(vehicle: Vehicle) {
  return vehicleClassCode(vehicle) === 'PCP';
}'''
text = replace_once(text, old_private, new_private, "vehicle class helper")

old_styles = """  inlineAddPolicy: { alignSelf: 'flex-end', minHeight: 24, borderRadius: 8, borderWidth: 1, borderColor: '#B8D4F7', backgroundColor: '#F2F7FF', paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  inlineAddPolicyText: { color: '#0A43A3', fontSize: 9.4, lineHeight: 12, fontWeight: '900' },"""
new_styles = """  policyEmptyState: { flex: 1, minHeight: 144, borderRadius: 14, backgroundColor: '#F5F9FF', borderWidth: 1, borderColor: '#CFE0F5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 10 },
  policyEmptyStatePressed: { backgroundColor: '#EAF3FF', transform: [{ scale: 0.985 }] },
  policyEmptyIcon: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#E4F0FF', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  policyEmptyTitle: { color: palette.navy, fontSize: 13.5, lineHeight: 17, fontWeight: '900' },
  policyEmptyText: { color: '#718096', fontSize: 9.5, lineHeight: 12, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  policyEmptyButton: { minHeight: 29, borderRadius: 9, backgroundColor: '#0A43A3', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 7 },
  policyEmptyButtonText: { color: '#FFFFFF', fontSize: 10, lineHeight: 13, fontWeight: '900' },"""
text = replace_once(text, old_styles, new_styles, "policy empty styles")
if "inlineAddPolicy" in text:
    raise SystemExit("Old inline Add Policy row remains")
vehicles_path.write_text(text)

add_path = Path("apps/mobile-app/app/customer/add-vehicle.tsx")
add = add_path.read_text()
add = replace_once(
    add,
    "import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';",
    "import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';",
    "ScrollView import",
)
add = replace_once(
    add,
    "  const selectedContext = contexts.find((context) => context.customer_id === selectedCustomerId) ?? null;\n",
    "",
    "selected context",
)
add = replace_once(
    add,
    "    if (!vehicleNo.trim()) return setMessage('Enter the RC number.');\n    if (!make.trim()) return setMessage('Select the vehicle manufacturer.');",
    "    if (!vehicleNo.trim()) return setMessage('Enter the RC number.');\n    if (!vehicleType) return setMessage('Select the vehicle class.');\n    if (!make.trim()) return setMessage('Select the vehicle manufacturer.');",
    "vehicle class validation",
)
add = replace_once(
    add,
    '''      <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>VEHICLE ONBOARDING</Text><Text style={styles.compactTitle}>Add Vehicle</Text><Text style={styles.modalSub}>Add the vehicle now; optional details can be completed later.</Text></View><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.modalClose}><MaterialCommunityIcons name="close" size={20} color={palette.navy} /></Pressable></View>''',
    '''      <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>VEHICLE ONBOARDING</Text><Text style={styles.compactTitle}>Add Vehicle</Text></View><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.modalClose}><MaterialCommunityIcons name="close" size={20} color={palette.navy} /></Pressable></View>''',
    "helper text removal",
)
old_accounts = '''        {contexts.length > 1 ? <AccountDropdown contexts={contexts} selectedCustomerId={selectedCustomerId} open={accountOpen} onToggle={() => setAccountOpen((value) => !value)} onSelect={(customerId) => { setSelectedCustomerId(customerId); setAccountOpen(false); }} /> : null}
        {selectedContext && contexts.length <= 1 ? <View style={styles.accountPill}><MaterialCommunityIcons name="office-building-outline" size={17} color="#0A43A3" /><View style={styles.flex}><Text style={styles.accountPillLabel}>Add for</Text><Text style={styles.accountPillTitle}>{customerAccountTitle(selectedContext)}</Text></View></View> : null}'''
new_accounts = '''        {contexts.length > 1 ? <AccountDropdown contexts={contexts} selectedCustomerId={selectedCustomerId} open={accountOpen} onToggle={() => setAccountOpen((value) => !value)} onSelect={(customerId) => { setSelectedCustomerId(customerId); setAccountOpen(false); }} /> : null}'''
add = replace_once(add, old_accounts, new_accounts, "single account Add for")
add = replace_once(
    add,
    '''            <View style={styles.column}><InputField required icon="calendar-blank-outline" label="Manufacturing year" keyboardType="number-pad" value={year} onChangeText={(value) => setYear(value.replace(/\D/g, '').slice(0, 4))} /></View>''',
    '''            <View style={styles.column}><YearDropdown value={year} onSelect={setYear} /></View>''',
    "year input",
)
add = replace_once(
    add,
    '''          <VehicleTypeDropdown value={vehicleType} onSelect={setVehicleType} />''',
    '''          <VehicleTypeDropdown required value={vehicleType} onSelect={setVehicleType} />''',
    "required vehicle class call",
)
old_dropdown = '''function VehicleTypeDropdown({ value, onSelect }: { value: string; onSelect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = vehicleClasses.find((item) => item.value === value);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Vehicle class</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpen((current) => !current)} style={styles.selectButton}>
        <View style={styles.selectIcon}><MaterialCommunityIcons name="truck-outline" size={18} color="#0A43A3" /></View>
        <Text style={[styles.selectValue, !selected && styles.placeholder]}>{selected?.label ?? 'Select class (optional)'}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} />
      </Pressable>
      {open ? <View style={styles.selectMenu}>{vehicleClasses.map((item) => <Pressable key={item.value} onPress={() => { onSelect(item.value); setOpen(false); }} style={[styles.selectOption, value === item.value && styles.selectOptionActive]}><Text style={[styles.selectOptionText, value === item.value && styles.selectOptionTextActive]}>{item.label}</Text>{value === item.value ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>)}</View> : null}
    </View>
  );
}'''
new_dropdown = '''function VehicleTypeDropdown({ value, onSelect, required = false }: { value: string; onSelect: (value: string) => void; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = vehicleClasses.find((item) => item.value === value);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Vehicle class{required ? ' *' : ''}</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpen((current) => !current)} style={styles.selectButton}>
        <View style={styles.selectIcon}><MaterialCommunityIcons name="truck-outline" size={18} color="#0A43A3" /></View>
        <Text style={[styles.selectValue, !selected && styles.placeholder]}>{selected?.label ?? 'Select class'}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} />
      </Pressable>
      {open ? <View style={styles.selectMenu}>{vehicleClasses.map((item) => <Pressable key={item.value} onPress={() => { onSelect(item.value); setOpen(false); }} style={[styles.selectOption, value === item.value && styles.selectOptionActive]}><Text style={[styles.selectOptionText, value === item.value && styles.selectOptionTextActive]}>{item.label}</Text>{value === item.value ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}</Pressable>)}</View> : null}
    </View>
  );
}

function YearDropdown({ value, onSelect }: { value: string; onSelect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const maxYear = new Date().getFullYear() + 1;
  const years = useMemo(() => Array.from({ length: maxYear - 1949 }, (_, index) => String(maxYear - index)), [maxYear]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Manufacturing year *</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpen((current) => !current)} style={styles.selectButton}>
        <View style={styles.selectIcon}><MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#0A43A3" /></View>
        <Text style={[styles.selectValue, !value && styles.placeholder]}>{value || 'Select year'}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={21} color={palette.navy} />
      </Pressable>
      {open ? (
        <View style={styles.yearMenu}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
            {years.map((item) => (
              <Pressable key={item} onPress={() => { onSelect(item); setOpen(false); }} style={[styles.selectOption, value === item && styles.selectOptionActive]}>
                <Text style={[styles.selectOptionText, value === item && styles.selectOptionTextActive]}>{item}</Text>
                {value === item ? <MaterialCommunityIcons name="check-circle" size={17} color={palette.navy} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}'''
add = replace_once(add, old_dropdown, new_dropdown, "vehicle class/year dropdowns")
style_marker = "  selectMenu: { borderRadius: 13, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },"
if style_marker not in add:
    raise SystemExit("selectMenu style marker not found")
add = add.replace(
    style_marker,
    style_marker + "\n  yearMenu: { maxHeight: 228, borderRadius: 13, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' },",
    1,
)

if "Add the vehicle now; optional details can be completed later." in add:
    raise SystemExit("Helper copy still present")
if "Select class (optional)" in add:
    raise SystemExit("Vehicle class still optional")
if 'accountPillLabel}>Add for' in add:
    raise SystemExit("Single-account Add for still present")
add_path.write_text(add)
