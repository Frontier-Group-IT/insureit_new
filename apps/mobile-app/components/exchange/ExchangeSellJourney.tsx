import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ExchangeSellableVehicle } from '@/lib/exchange';

type SellCategory = 'Truck' | 'Tipper' | 'Pickup' | 'Bus' | 'Construction';

type SellDraft = {
  registration: string;
  makeModel: string;
  year: string;
  km: string;
  category: SellCategory;
  askingPrice: string;
  sellingMode: 'fixed_price' | 'open_bidding' | 'managed_auction';
  overallCondition: 'excellent' | 'good' | 'fair' | 'needs_attention';
  tyreConditionPercent: string;
  knownIssues: string;
  operatingHours: string;
  bodyCondition: 'good' | 'fair' | 'needs_attention' | 'unknown';
  cabinCondition: 'good' | 'fair' | 'needs_attention' | 'unknown';
  hydraulicCondition: 'good' | 'fair' | 'needs_attention' | 'unknown';
  undercarriageCondition: 'good' | 'fair' | 'needs_attention' | 'unknown';
};

type PhotoSlot = {
  label: string;
  uri: string | null;
  uploaded: boolean;
};

function vehicleIcon(vehicle: ExchangeSellableVehicle) {
  const haystack = `${vehicle.vehicle_type} ${vehicle.vehicle_category ?? ''} ${vehicle.body_type ?? ''}`.toLowerCase();
  if (haystack.includes('bus')) return 'bus' as const;
  if (haystack.includes('pickup')) return 'car-pickup' as const;
  if (haystack.includes('jcb') || haystack.includes('construction')) return 'tractor' as const;
  if (haystack.includes('tipper') || haystack.includes('dumper')) return 'dump-truck' as const;
  return 'truck-outline' as const;
}

function categoryIcon(category: SellCategory) {
  if (category === 'Tipper') return 'dump-truck' as const;
  if (category === 'Pickup') return 'car-pickup' as const;
  if (category === 'Bus') return 'bus' as const;
  if (category === 'Construction') return 'tractor' as const;
  return 'truck-outline' as const;
}

function formatPrice(value: string) {
  const amount = Number(value || 0);
  if (!amount) return 'Not set';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(amount % 10000000 ? 2 : 0)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(amount % 100000 ? 2 : 0)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function ExchangeSellJourney({
  draft,
  draftSaved,
  sellableVehicles,
  selectedVehicleId,
  photos,
  busy,
  refreshing,
  onRefresh,
  onSelectVehicle,
  onUpdate,
  onPhotoPress,
  onPreview,
  onSave,
  onAddVehicle,
}: {
  draft: SellDraft;
  draftSaved: boolean;
  sellableVehicles: ExchangeSellableVehicle[];
  selectedVehicleId: string | null;
  photos: PhotoSlot[];
  busy: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectVehicle: (vehicle: ExchangeSellableVehicle) => void;
  onUpdate: (key: keyof SellDraft, value: string) => void;
  onPhotoPress: (index: number) => void;
  onPreview: () => void;
  onSave: () => void;
  onAddVehicle: () => void;
}) {
  const [step, setStep] = useState(0);
  const selectedVehicle = useMemo(
    () => sellableVehicles.find((vehicle) => vehicle.vehicle_id === selectedVehicleId) ?? null,
    [selectedVehicleId, sellableVehicles],
  );
  const uploadedCount = photos.filter((photo) => photo.uploaded).length;
  const canContinueVehicle = Boolean(selectedVehicleId);
  const canContinueDetails = Boolean(draft.km.trim() && Number(draft.km) >= 0 && draft.askingPrice.trim() && Number(draft.askingPrice) > 0);
  const canReview = canContinueVehicle && canContinueDetails;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>SELL ON EXCHANGE</Text>
        <Text style={styles.title}>Sell your commercial vehicle</Text>
        <Text style={styles.subtitle}>Start with a vehicle already in your InsureIT fleet. We keep known details linked, so you only add what is missing.</Text>
      </View>

      <Progress step={step} />

      {step === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select from your fleet</Text>
          <Text style={styles.cardCopy}>Choose the vehicle you want to list. Vehicles with an active Exchange listing are locked.</Text>

          <View style={styles.fleetList}>
            {sellableVehicles.map((vehicle) => {
              const active = selectedVehicleId === vehicle.vehicle_id;
              return (
                <Pressable
                  key={vehicle.vehicle_id}
                  disabled={vehicle.has_active_listing}
                  onPress={() => onSelectVehicle(vehicle)}
                  style={({ pressed }) => [
                    styles.fleetRow,
                    active && styles.fleetRowActive,
                    vehicle.has_active_listing && styles.fleetRowDisabled,
                    pressed && !vehicle.has_active_listing && styles.pressed,
                  ]}
                >
                  <View style={styles.vehicleIconWrap}>
                    <MaterialCommunityIcons name={vehicleIcon(vehicle)} size={28} color="#164BB8" />
                  </View>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.vehicleTitle}>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_type}</Text>
                    <Text style={styles.vehicleMeta}>{vehicle.vehicle_no} • {vehicle.year || 'Year pending'}</Text>
                    <Text style={styles.vehicleMeta}>{[vehicle.city, vehicle.state].filter(Boolean).join(', ') || 'Location on file'}</Text>
                  </View>
                  {vehicle.has_active_listing ? (
                    <View style={styles.listedPill}><Text style={styles.listedPillText}>LISTED</Text></View>
                  ) : (
                    <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={active ? '#164BB8' : '#A1ACBA'} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {!sellableVehicles.length ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="truck-outline" size={24} color="#164BB8" />
              <Text style={styles.emptyTitle}>No fleet vehicle is available</Text>
              <Text style={styles.emptyCopy}>Add or verify the vehicle through the existing Fleet onboarding flow, then return to Exchange.</Text>
            </View>
          ) : null}

          <Pressable onPress={onAddVehicle} style={({ pressed }) => [styles.addVehicleButton, pressed && styles.pressed]}>
            <View style={styles.addVehicleIcon}><MaterialCommunityIcons name="plus" size={20} color="#164BB8" /></View>
            <View style={styles.flex}>
              <Text style={styles.addVehicleTitle}>Add another vehicle</Text>
              <Text style={styles.addVehicleCopy}>Use the existing RC / ownership / fleet onboarding flow, then come back here to list it.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#164BB8" />
          </Pressable>

          <View style={styles.notice}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#164BB8" />
            <Text style={styles.noticeText}>This phase lists vehicles already linked to your customer account. Manual vehicle creation will be added later.</Text>
          </View>

          <PrimaryButton
            label="Continue"
            disabled={!canContinueVehicle || busy}
            onPress={() => setStep(1)}
          />
        </View>
      ) : null}

      {step === 1 ? (
        <>
          <SelectedVehicleSummary vehicle={selectedVehicle} draft={draft} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vehicle condition & price</Text>
            <Text style={styles.cardCopy}>Known identity stays locked to the fleet record. Add the current odometer and your expected selling price.</Text>

            <View style={styles.readOnlyGrid}>
              <ReadOnlyField label="Registration" value={draft.registration || 'From fleet'} />
              <ReadOnlyField label="Year" value={draft.year || 'From fleet'} />
            </View>
            <ReadOnlyField label="Make / model" value={draft.makeModel || 'From fleet'} wide />

            <InputField
              label="Current odometer"
              value={draft.km}
              suffix="km"
              placeholder="72,400"
              onChangeText={(value) => onUpdate('km', value.replace(/\D/g, ''))}
            />

            <Text style={styles.fieldLabel}>Vehicle category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>
              {(['Truck', 'Tipper', 'Pickup', 'Bus', 'Construction'] as SellCategory[]).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => onUpdate('category', item)}
                  style={[styles.categoryChip, draft.category === item && styles.categoryChipActive]}
                >
                  <MaterialCommunityIcons name={categoryIcon(item)} size={16} color={draft.category === item ? '#FFFFFF' : '#5D6B7F'} />
                  <Text style={[styles.categoryText, draft.category === item && styles.categoryTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.sellerConditionNotice}>
              <MaterialCommunityIcons name="account-edit-outline" size={19} color="#7A5B12" />
              <View style={styles.flex}>
                <Text style={styles.sellerConditionTitle}>Seller-declared condition</Text>
                <Text style={styles.sellerConditionCopy}>These answers help buyers understand the vehicle before inspection. They are shown as seller-provided information, not InsureIT verification.</Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Overall condition</Text>
            <View style={styles.conditionGrid}>
              <ConditionChoice label="Excellent" active={draft.overallCondition === 'excellent'} onPress={() => onUpdate('overallCondition', 'excellent')} />
              <ConditionChoice label="Good" active={draft.overallCondition === 'good'} onPress={() => onUpdate('overallCondition', 'good')} />
              <ConditionChoice label="Fair" active={draft.overallCondition === 'fair'} onPress={() => onUpdate('overallCondition', 'fair')} />
              <ConditionChoice label="Needs attention" active={draft.overallCondition === 'needs_attention'} onPress={() => onUpdate('overallCondition', 'needs_attention')} />
            </View>

            <InputField
              label="Estimated tyre condition"
              value={draft.tyreConditionPercent}
              suffix="%"
              placeholder="e.g. 70"
              onChangeText={(value) => onUpdate('tyreConditionPercent', value.replace(/\D/g, '').slice(0, 3))}
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Body condition</Text>
            <ConditionRow
              value={draft.bodyCondition}
              onChange={(value) => onUpdate('bodyCondition', value)}
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Cabin condition</Text>
            <ConditionRow
              value={draft.cabinCondition}
              onChange={(value) => onUpdate('cabinCondition', value)}
            />

            {draft.category === 'Construction' ? (
              <>
                <InputField
                  label="Operating hours (optional)"
                  value={draft.operatingHours}
                  suffix="hrs"
                  placeholder="e.g. 6,200"
                  onChangeText={(value) => onUpdate('operatingHours', value.replace(/\D/g, ''))}
                />
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Hydraulic condition</Text>
                <ConditionRow
                  value={draft.hydraulicCondition}
                  onChange={(value) => onUpdate('hydraulicCondition', value)}
                />
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Undercarriage condition</Text>
                <ConditionRow
                  value={draft.undercarriageCondition}
                  onChange={(value) => onUpdate('undercarriageCondition', value)}
                />
              </>
            ) : null}

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Known issues / disclosure (optional)</Text>
              <View style={[styles.inputShell, styles.multilineShell]}>
                <TextInput
                  value={draft.knownIssues}
                  onChangeText={(value) => onUpdate('knownIssues', value.slice(0, 400))}
                  placeholder="Mention any issue a buyer should know before inspection"
                  placeholderTextColor="#9AA5B4"
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.multilineInput]}
                />
              </View>
              <Text style={styles.characterCount}>{draft.knownIssues.length}/400</Text>
            </View>

            <View style={styles.valuationCard}>
              <View style={styles.valuationIcon}><MaterialCommunityIcons name="chart-timeline-variant" size={21} color="#164BB8" /></View>
              <View style={styles.flex}>
                <Text style={styles.valuationTitle}>Market valuation is coming next</Text>
                <Text style={styles.valuationCopy}>We will not invent an estimate. Phase 3 valuation will use real comparable and vehicle-condition data.</Text>
              </View>
            </View>

            <InputField
              label="Your expected price"
              value={draft.askingPrice}
              prefix="₹"
              placeholder="25,50,000"
              onChangeText={(value) => onUpdate('askingPrice', value.replace(/\D/g, ''))}
            />

            <View style={styles.priceSummary}>
              <Text style={styles.priceSummaryLabel}>YOUR EXPECTATION</Text>
              <Text style={styles.priceSummaryValue}>{formatPrice(draft.askingPrice)}</Text>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 15 }]}>How do you want to sell?</Text>
            <View style={styles.modeList}>
              <SellingModeCard
                active={draft.sellingMode === 'fixed_price'}
                icon="tag-outline"
                title="Fixed price"
                copy="Show your asking price and let interested buyers request a managed callback."
                onPress={() => onUpdate('sellingMode', 'fixed_price')}
              />
              <SellingModeCard
                active={draft.sellingMode === 'open_bidding'}
                icon="handshake-outline"
                title="Open to offers"
                copy="Buyers can make private offers. You remain free to accept or decline."
                onPress={() => onUpdate('sellingMode', 'open_bidding')}
              />
              <SellingModeCard
                active={draft.sellingMode === 'managed_auction'}
                icon="gavel"
                title="Managed auction"
                copy="Qualified buyers compete through Exchange while you keep final approval."
                onPress={() => onUpdate('sellingMode', 'managed_auction')}
              />
            </View>

            <View style={styles.buttonRow}>
              <SecondaryButton label="Back" onPress={() => setStep(0)} />
              <PrimaryButton label="Continue to photos" disabled={!canContinueDetails || busy} onPress={() => setStep(2)} compact />
            </View>
          </View>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <SelectedVehicleSummary vehicle={selectedVehicle} draft={draft} />

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Add clear vehicle photos</Text>
                <Text style={styles.cardCopy}>{uploadedCount} of {photos.length} uploaded</Text>
              </View>
              <View style={styles.counterPill}><Text style={styles.counterText}>{uploadedCount}/{photos.length}</Text></View>
            </View>

            <View style={styles.guidance}>
              <MaterialCommunityIcons name="camera-outline" size={20} color="#164BB8" />
              <Text style={styles.guidanceText}>Use Camera for a fresh guided photo or Gallery for an existing recent photo. Avoid screenshots, watermarks and unrelated backgrounds where possible.</Text>
            </View>

            <View style={styles.photoList}>
              {photos.map((photo, index) => (
                <Pressable
                  key={photo.label}
                  disabled={busy}
                  onPress={() => onPhotoPress(index)}
                  style={({ pressed }) => [styles.photoRow, pressed && styles.pressed]}
                >
                  <View style={styles.photoNumber}><Text style={styles.photoNumberText}>{index + 1}</Text></View>
                  {photo.uri ? (
                    <Image source={{ uri: photo.uri }} resizeMode="cover" style={styles.photoThumb} />
                  ) : (
                    <View style={styles.photoThumbEmpty}><MaterialCommunityIcons name="camera-plus-outline" size={22} color="#718095" /></View>
                  )}
                  <View style={styles.flex}>
                    <Text style={styles.photoTitle}>{photo.label}</Text>
                    <Text style={styles.photoCopy}>{photo.uploaded ? 'Uploaded securely' : 'Tap for Camera / Gallery'}</Text>
                  </View>
                  <MaterialCommunityIcons name={photo.uploaded ? 'check-circle' : 'chevron-right'} size={21} color={photo.uploaded ? '#0D7C58' : '#95A1B0'} />
                </Pressable>
              ))}
            </View>

            <View style={styles.buttonRow}>
              <SecondaryButton label="Back" onPress={() => setStep(1)} />
              <PrimaryButton label="Review listing" disabled={!canReview || busy} onPress={() => setStep(3)} compact />
            </View>
          </View>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <SelectedVehicleSummary vehicle={selectedVehicle} draft={draft} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ready to review</Text>
            <Text style={styles.cardCopy}>Check the listing preview before submitting it for InsureIT verification.</Text>

            <ReviewRow label="Vehicle" value={draft.makeModel || 'Vehicle from fleet'} />
            <ReviewRow label="Registration" value={draft.registration || 'On file'} />
            <ReviewRow label="Odometer" value={draft.km ? `${Number(draft.km).toLocaleString('en-IN')} km` : 'Not set'} />
            <ReviewRow label="Category" value={draft.category} />
            <ReviewRow label="Seller-declared condition" value={conditionLabel(draft.overallCondition)} />
            <ReviewRow label="Tyre condition" value={draft.tyreConditionPercent ? `${draft.tyreConditionPercent}%` : 'Not provided'} />
            {draft.category === 'Construction' && draft.operatingHours ? <ReviewRow label="Operating hours" value={`${Number(draft.operatingHours).toLocaleString('en-IN')} hrs`} /> : null}
            <ReviewRow label="Expected price" value={formatPrice(draft.askingPrice)} />
            <ReviewRow label="Sale method" value={sellingModeLabel(draft.sellingMode)} />
            <ReviewRow label="Photos uploaded" value={`${uploadedCount} of ${photos.length}`} last />

            <View style={styles.privacyCard}>
              <MaterialCommunityIcons name="shield-lock-outline" size={22} color="#164BB8" />
              <View style={styles.flex}>
                <Text style={styles.privacyTitle}>Private by default</Text>
                <Text style={styles.privacyCopy}>Your phone number is not exposed in the public listing. Buyer contact remains managed through Exchange.</Text>
              </View>
            </View>

            <Pressable disabled={busy} onPress={onSave} style={({ pressed }) => [styles.saveDraft, pressed && styles.pressed, busy && styles.disabled]}>
              <MaterialCommunityIcons name={draftSaved ? 'check-circle-outline' : 'bookmark-outline'} size={18} color="#164BB8" />
              <Text style={styles.saveDraftText}>{draftSaved ? 'Draft saved' : 'Save draft'}</Text>
            </Pressable>

            <PrimaryButton label="Open listing preview" disabled={busy} onPress={onPreview} />
            <Pressable onPress={() => setStep(2)} style={styles.editLink}><Text style={styles.editLinkText}>Edit photos or details</Text></Pressable>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function conditionLabel(value: string) {
  if (value === 'needs_attention') return 'Needs attention';
  if (!value || value === 'unknown') return 'Not provided';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ConditionChoice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.conditionChoice, active && styles.conditionChoiceActive]}>
      <Text style={[styles.conditionChoiceText, active && styles.conditionChoiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ConditionRow({
  value,
  onChange,
}: {
  value: SellDraft['bodyCondition'];
  onChange: (value: SellDraft['bodyCondition']) => void;
}) {
  const choices: Array<[SellDraft['bodyCondition'], string]> = [
    ['good', 'Good'],
    ['fair', 'Fair'],
    ['needs_attention', 'Needs attention'],
    ['unknown', 'Not sure'],
  ];
  return (
    <View style={styles.conditionGrid}>
      {choices.map(([key, label]) => (
        <ConditionChoice key={key} label={label} active={value === key} onPress={() => onChange(key)} />
      ))}
    </View>
  );
}

function sellingModeLabel(mode: SellDraft['sellingMode']) {
  if (mode === 'fixed_price') return 'Fixed price';
  if (mode === 'managed_auction') return 'Managed auction';
  return 'Open to offers';
}

function SellingModeCard({
  active,
  icon,
  title,
  copy,
  onPress,
}: {
  active: boolean;
  icon: 'tag-outline' | 'handshake-outline' | 'gavel';
  title: string;
  copy: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.modeCard, active && styles.modeCardActive, pressed && styles.pressed]}>
      <View style={[styles.modeIcon, active && styles.modeIconActive]}>
        <MaterialCommunityIcons name={icon} size={20} color={active ? '#FFFFFF' : '#164BB8'} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.modeTitle, active && styles.modeTitleActive]}>{title}</Text>
        <Text style={styles.modeCopy}>{copy}</Text>
      </View>
      <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={active ? '#164BB8' : '#9AA6B5'} />
    </Pressable>
  );
}

function Progress({ step }: { step: number }) {
  const labels = ['Vehicle', 'Details', 'Photos', 'Review'];
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressTrack}>
        {labels.map((label, index) => (
          <View key={label} style={styles.progressItem}>
            <View style={[styles.progressDot, index <= step && styles.progressDotActive]}>
              {index < step ? <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" /> : <Text style={[styles.progressDotText, index <= step && styles.progressDotTextActive]}>{index + 1}</Text>}
            </View>
            {index < labels.length - 1 ? <View style={[styles.progressLine, index < step && styles.progressLineActive]} /> : null}
          </View>
        ))}
      </View>
      <View style={styles.progressLabels}>
        {labels.map((label, index) => <Text key={label} style={[styles.progressLabel, index === step && styles.progressLabelActive]}>{label}</Text>)}
      </View>
    </View>
  );
}

function SelectedVehicleSummary({ vehicle, draft }: { vehicle: ExchangeSellableVehicle | null; draft: SellDraft }) {
  if (!vehicle) return null;
  return (
    <View style={styles.selectedSummary}>
      <View style={styles.vehicleIconWrap}><MaterialCommunityIcons name={vehicleIcon(vehicle)} size={28} color="#164BB8" /></View>
      <View style={styles.flex}>
        <Text style={styles.vehicleTitle}>{draft.makeModel || [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_type}</Text>
        <Text style={styles.vehicleMeta}>{draft.registration || vehicle.vehicle_no} • {draft.year || vehicle.year || 'Year pending'}</Text>
      </View>
      <MaterialCommunityIcons name="check-circle" size={20} color="#0D7C58" />
    </View>
  );
}

function ReadOnlyField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.readOnlyField, wide && styles.readOnlyWide]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.readOnlyValue}>{value}</Text>
    </View>
  );
}

function InputField({
  label,
  value,
  placeholder,
  prefix,
  suffix,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          placeholder={placeholder}
          placeholderTextColor="#9AA5B4"
          style={styles.input}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function ReviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.reviewRow, last && styles.reviewRowLast]}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

function PrimaryButton({ label, disabled = false, onPress, compact = false }: { label: string; disabled?: boolean; onPress: () => void; compact?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, compact && styles.compactButton, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
      <MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" />
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 14, paddingBottom: 36, backgroundColor: '#F7F8FA' },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },

  intro: { paddingTop: 6, paddingBottom: 6 },
  eyebrow: { color: '#164BB8', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  title: { marginTop: 5, color: '#0F1D33', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  subtitle: { marginTop: 7, color: '#6E7B8F', fontSize: 9.6, lineHeight: 14, fontWeight: '700' },

  progressCard: { marginTop: 12, borderRadius: 18, padding: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E6ED' },
  progressTrack: { flexDirection: 'row', alignItems: 'center' },
  progressItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  progressDot: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7EBF0' },
  progressDotActive: { backgroundColor: '#164BB8' },
  progressDotText: { color: '#8793A4', fontSize: 8, fontWeight: '900' },
  progressDotTextActive: { color: '#FFFFFF' },
  progressLine: { flex: 1, height: 2, backgroundColor: '#E7EBF0' },
  progressLineActive: { backgroundColor: '#164BB8' },
  progressLabels: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { width: '25%', textAlign: 'center', color: '#8C97A7', fontSize: 7.4, fontWeight: '800' },
  progressLabelActive: { color: '#164BB8', fontWeight: '900' },

  card: { marginTop: 12, borderRadius: 20, padding: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { color: '#0F1D33', fontSize: 14.5, fontWeight: '900' },
  cardCopy: { marginTop: 4, color: '#7B8798', fontSize: 8.8, lineHeight: 12.5, fontWeight: '700' },

  fleetList: { marginTop: 13, gap: 8 },
  fleetRow: { minHeight: 78, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E5E9EF' },
  fleetRowActive: { backgroundColor: '#EEF4FF', borderColor: '#9DBBEA' },
  fleetRowDisabled: { opacity: 0.5 },
  vehicleIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E8EF' },
  vehicleTitle: { color: '#0F1D33', fontSize: 10.8, fontWeight: '900' },
  vehicleMeta: { marginTop: 3, color: '#7A8799', fontSize: 8.2, fontWeight: '700' },
  listedPill: { height: 23, borderRadius: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1F4' },
  listedPillText: { color: '#758296', fontSize: 7, fontWeight: '900' },

  empty: { marginTop: 12, padding: 18, borderRadius: 15, alignItems: 'center', backgroundColor: '#F7F8FA' },
  emptyTitle: { marginTop: 6, color: '#0F1D33', fontSize: 10, fontWeight: '900' },
  emptyCopy: { marginTop: 3, color: '#7D899B', fontSize: 8.2, lineHeight: 11.5, fontWeight: '700', textAlign: 'center' },

  addVehicleButton: { marginTop: 12, minHeight: 72, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9D8EF' },
  addVehicleIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  addVehicleTitle: { color: '#164BB8', fontSize: 9.5, fontWeight: '900' },
  addVehicleCopy: { marginTop: 3, color: '#718095', fontSize: 7.6, lineHeight: 10.8, fontWeight: '700' },

  notice: { marginTop: 12, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#EEF4FF' },
  noticeText: { flex: 1, color: '#5E6F88', fontSize: 8.2, lineHeight: 11.5, fontWeight: '700' },

  selectedSummary: { marginTop: 12, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D6E3F8' },

  readOnlyGrid: { marginTop: 13, flexDirection: 'row', gap: 8 },
  readOnlyField: { flex: 1, minHeight: 66, borderRadius: 14, padding: 10, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E5E9EF' },
  readOnlyWide: { marginTop: 8 },
  fieldLabel: { color: '#68758A', fontSize: 8.3, fontWeight: '800' },
  readOnlyValue: { marginTop: 6, color: '#26364D', fontSize: 10, lineHeight: 13, fontWeight: '900' },

  fieldWrap: { marginTop: 14 },
  inputShell: { marginTop: 6, minHeight: 50, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE2E9' },
  input: { flex: 1, minHeight: 48, color: '#0F1D33', fontSize: 12, fontWeight: '800' },
  affix: { marginRight: 5, color: '#0F1D33', fontSize: 15, fontWeight: '900' },
  suffix: { color: '#7B8798', fontSize: 9, fontWeight: '800' },

  categoryRail: { marginTop: 7, paddingRight: 8, gap: 7 },
  categoryChip: { height: 36, borderRadius: 18, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E2E6EC' },
  categoryChipActive: { backgroundColor: '#164BB8', borderColor: '#164BB8' },
  categoryText: { color: '#5D6B7F', fontSize: 8.6, fontWeight: '800' },
  categoryTextActive: { color: '#FFFFFF', fontWeight: '900' },

  sellerConditionNotice: { marginTop: 14, borderRadius: 15, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#F0E0BA' },
  sellerConditionTitle: { color: '#6F5312', fontSize: 9.3, fontWeight: '900' },
  sellerConditionCopy: { marginTop: 3, color: '#7E6D43', fontSize: 7.8, lineHeight: 11.2, fontWeight: '700' },
  conditionGrid: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  conditionChoice: { minHeight: 35, borderRadius: 18, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E1E6EC' },
  conditionChoiceActive: { backgroundColor: '#EEF4FF', borderColor: '#9DBBEA' },
  conditionChoiceText: { color: '#68758A', fontSize: 8, fontWeight: '800' },
  conditionChoiceTextActive: { color: '#164BB8', fontWeight: '900' },
  multilineShell: { minHeight: 92, alignItems: 'flex-start', paddingVertical: 9 },
  multilineInput: { minHeight: 72, lineHeight: 16 },
  characterCount: { marginTop: 4, alignSelf: 'flex-end', color: '#9AA5B4', fontSize: 6.8, fontWeight: '700' },

  valuationCard: { marginTop: 14, borderRadius: 15, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#F0F5FF' },
  valuationIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  valuationTitle: { color: '#183A75', fontSize: 9.5, fontWeight: '900' },
  valuationCopy: { marginTop: 3, color: '#637694', fontSize: 8.1, lineHeight: 11.5, fontWeight: '700' },

  priceSummary: { marginTop: 10, borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ECF8F3' },
  priceSummaryLabel: { color: '#6D897F', fontSize: 7.3, fontWeight: '900', letterSpacing: 0.5 },
  priceSummaryValue: { color: '#0D7C58', fontSize: 13, fontWeight: '900' },

  modeList: { marginTop: 8, gap: 8 },
  modeCard: { minHeight: 78, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E2E7ED' },
  modeCardActive: { backgroundColor: '#EEF4FF', borderColor: '#9DBBEA' },
  modeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  modeIconActive: { backgroundColor: '#164BB8' },
  modeTitle: { color: '#26364D', fontSize: 9.8, fontWeight: '900' },
  modeTitleActive: { color: '#164BB8' },
  modeCopy: { marginTop: 3, color: '#738095', fontSize: 7.8, lineHeight: 11.2, fontWeight: '700' },

  guidance: { marginTop: 12, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#EEF4FF' },
  guidanceText: { flex: 1, color: '#5F708A', fontSize: 8.2, lineHeight: 11.5, fontWeight: '700' },
  counterPill: { minWidth: 38, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  counterText: { color: '#164BB8', fontSize: 8.5, fontWeight: '900' },

  photoList: { marginTop: 12, gap: 8 },
  photoRow: { minHeight: 72, borderRadius: 15, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E5E9EF' },
  photoNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EDF4' },
  photoNumberText: { color: '#68758A', fontSize: 7.8, fontWeight: '900' },
  photoThumb: { width: 58, height: 52, borderRadius: 10 },
  photoThumbEmpty: { width: 58, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1F4' },
  photoTitle: { color: '#0F1D33', fontSize: 9.5, fontWeight: '900' },
  photoCopy: { marginTop: 3, color: '#7A8799', fontSize: 7.8, fontWeight: '700' },

  reviewRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#EEF1F4' },
  reviewRowLast: { borderBottomWidth: 0 },
  reviewLabel: { color: '#7C899B', fontSize: 8.5, fontWeight: '700' },
  reviewValue: { flex: 1, color: '#26364D', textAlign: 'right', fontSize: 9.2, fontWeight: '900' },

  privacyCard: { marginTop: 13, borderRadius: 15, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#EEF4FF' },
  privacyTitle: { color: '#183A75', fontSize: 9.5, fontWeight: '900' },
  privacyCopy: { marginTop: 3, color: '#637694', fontSize: 8.1, lineHeight: 11.5, fontWeight: '700' },

  saveDraft: { marginTop: 12, height: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C8D7EE' },
  saveDraftText: { color: '#164BB8', fontSize: 9.5, fontWeight: '900' },

  buttonRow: { marginTop: 15, flexDirection: 'row', gap: 9 },
  primaryButton: { marginTop: 15, minHeight: 50, borderRadius: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#164BB8' },
  compactButton: { flex: 1, marginTop: 0 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  secondaryButton: { minWidth: 96, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D4DBE5' },
  secondaryButtonText: { color: '#536176', fontSize: 9.5, fontWeight: '900' },
  editLink: { marginTop: 12, alignItems: 'center' },
  editLinkText: { color: '#164BB8', fontSize: 8.8, fontWeight: '900' },
});

export default ExchangeSellJourney;
