import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

type PickedEndorsementFile = { name: string; mimeType?: string | null; size?: number | null; uri: string };

const truckImages = [
  require('../../assets/vehicles/truck-blue.png'),
  require('../../assets/vehicles/truck-white.png'),
  require('../../assets/vehicles/truck-orange.png'),
];

const insurerLogos = {
  hdfc: require('../../assets/vehicles/hdfc-ergo.png'),
  bajaj: require('../../assets/vehicles/bajaj-allianz.png'),
  tata: require('../../assets/vehicles/tata-aig.png'),
};

export default function VehiclesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewalVehicleId, setRenewalVehicleId] = useState<string | null>(null);
  const [ownerChange, setOwnerChange] = useState<'yes' | 'no' | ''>('');
  const [claimInLastYear, setClaimInLastYear] = useState<'yes' | 'no' | ''>('');
  const [renewalSuccess, setRenewalSuccess] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [addVehicleSuccess, setAddVehicleSuccess] = useState(false);
  const [addVehicleDocs, setAddVehicleDocs] = useState(false);
  const [addVehicleThankYou, setAddVehicleThankYou] = useState(false);
  const [addMethod, setAddMethod] = useState<'vehicle' | 'policy' | 'chassis'>('vehicle');
  const [addValue, setAddValue] = useState('');
  const [endorsementOpen, setEndorsementOpen] = useState(false);
  const [endorsementOption, setEndorsementOption] = useState('');
  const [endorsementFile, setEndorsementFile] = useState<PickedEndorsementFile | null>(null);
  const [endorsementDetails, setEndorsementDetails] = useState('');
  const [endorsementSuccess, setEndorsementSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');

      const contexts = await getOperationalCustomerContexts();
      const ids = contexts.map((context) => context.customer_id);
      if (ids.length) {
        const [vehicleResult, policyResult, claimResult, insurerResult] = await Promise.all([
          supabase.from('vehicles').select('*').in('customer_id', ids).order('created_at', { ascending: false }),
          supabase.from('policies').select('*').in('customer_id', ids),
          supabase.from('claims').select('*').in('customer_id', ids),
          supabase.from('insurance_companies').select('*'),
        ]);

        setVehicles(vehicleResult.data ?? []);
        setPolicies(policyResult.data ?? []);
        setClaims(claimResult.data ?? []);
        setInsurers(insurerResult.data ?? []);
      }

      setLoading(false);
    }

    void load();
  }, [router]);

  const expiringSoon = policies.filter((policy) => {
    const days = daysUntil(policy.end_date);
    return days >= 0 && days <= 30;
  }).length;

  const renewalMessage = useMemo(() => {
    if (expiringSoon > 0) return `${expiringSoon} policy${expiringSoon === 1 ? '' : 'ies'} need attention soon`;
    return 'Renew your policy on time and keep your vehicles protected';
  }, [expiringSoon]);

  function openRenewal(vehicleId: string) {
    setRenewalVehicleId(vehicleId);
    setOwnerChange('');
    setClaimInLastYear('');
    setRenewalSuccess(false);
  }

  function submitRenewal() {
    setRenewalVehicleId(null);
    setRenewalSuccess(true);
  }

  function openAddVehicle() {
    setAddMethod('vehicle');
    setAddValue('');
    setAddVehicleOpen(true);
  }

  function submitAddVehicle() {
    setAddVehicleOpen(false);
    setAddVehicleDocs(true);
  }

  function submitAddVehicleDocs() {
    setAddVehicleDocs(false);
    setAddVehicleThankYou(true);
  }

  function openEndorsement() {
    setEndorsementOption('');
    setEndorsementFile(null);
    setEndorsementDetails('');
    setEndorsementOpen(true);
  }

  function submitEndorsement() {
    if (!endorsementOption || !endorsementFile || !endorsementDetails.trim()) return;
    setEndorsementOpen(false);
    setEndorsementSuccess(true);
  }

  function selectEndorsementOption(option: string) {
    setEndorsementOption(option);
    setEndorsementFile(null);
    setEndorsementDetails('');
  }

  async function pickEndorsementDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setEndorsementFile({ name: asset.name, mimeType: asset.mimeType, size: asset.size, uri: asset.uri });
    }
  }

  if (loading) return <Screen title="My Vehicles"><LoadingState /></Screen>;

  return (
    <Screen title="My Vehicles" showLogout showTitleHeader={false}>
      <View style={styles.pageHeader}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>My Vehicles</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{vehicles.length} Vehicle{vehicles.length === 1 ? '' : 's'}</Text>
            </View>
          </View>
          <Text style={styles.pageSub}>Manage your vehicle insurance policies</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={openAddVehicle} style={styles.addButton}>
          <MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Vehicle</Text>
        </Pressable>
      </View>

      {vehicles.length === 0 ? <EmptyState title="No vehicles yet" body="Vehicle records will appear here." /> : null}

      {vehicles.map((vehicle) => {
        const policy = latestPolicyFor(vehicle.id, policies);
        const insurer = policy ? insurers.find((item) => item.id === policy.insurance_company_id) : null;
        const active = Boolean(policy && isPolicyActive(policy));
        const openClaims = claims.filter((claim) => claim.vehicle_id === vehicle.id && !['Closed', 'Settled', 'Rejected'].includes(claim.current_status)).length;
        const truckImage = vehicleImage(vehicle.id);
        const insurerLogo = insurerImage(insurer?.name);

        return (
          <Pressable key={vehicle.id} onPress={() => router.push({ pathname: '/customer/vehicle-detail', params: { id: vehicle.id } })} style={({ pressed }) => [styles.vehicleCard, pressed && styles.vehicleCardPressed]}>
            <View style={styles.cardMain}>
              <View style={styles.leftPane}>
                <View style={styles.chipRow}>
                  <View style={styles.vehicleNoChip}>
                    <Text style={styles.vehicleNoText}>{vehicle.vehicle_no}</Text>
                    <MaterialCommunityIcons name="content-copy" size={13} color={palette.navy} />
                  </View>
                  <View style={[styles.activeChip, !active && styles.inactiveChip]}>
                    <View style={[styles.activeDot, !active && styles.inactiveDot]} />
                    <Text style={[styles.activeText, !active && styles.inactiveText]}>{active ? 'Active' : 'Inactive'}</Text>
                  </View>
                </View>

                <Image source={truckImage} style={styles.truckImage} resizeMode="contain" />

                <Text style={styles.vehicleMake} numberOfLines={1}>{vehicle.make || 'Vehicle'}</Text>
                <Text style={styles.vehicleModel} numberOfLines={1}>{vehicle.model || vehicle.vehicle_type || '-'}</Text>

                <View style={styles.tagRow}>
                  <Text style={styles.smallTag}>{vehicle.vehicle_type || 'Commercial'}</Text>
                  <Text style={styles.smallTag}>{vehicle.year ? String(vehicle.year) : '-'}</Text>
                </View>
              </View>

              <View style={styles.rightPane}>
                <InfoBlock
                  icon="shield-car"
                  iconBg="#EAF3FF"
                  iconColor={palette.navy}
                  label="Insurance Company"
                  value={insurer?.name ?? 'Insurance company pending'}
                  logo={insurerLogo}
                />
                <InfoBlock
                  icon="calendar-start"
                  iconBg="#EAF3FF"
                  iconColor="#2563EB"
                  label="Policy Start Date"
                  value={policy ? formatDate(policy.start_date) : '-'}
                />
                <InfoBlock
                  icon="calendar-alert"
                  iconBg="#FFECEF"
                  iconColor="#E84C88"
                  label="Policy Expiry Date"
                  value={policy ? formatDate(policy.end_date) : '-'}
                />
                <InfoBlock
                  icon="file-document-outline"
                  iconBg="#EAF8F1"
                  iconColor="#12805C"
                  label="Policy Number"
                  value={policy?.policy_no ?? '-'}
                />
              </View>
            </View>

            <View style={styles.actionRow}>
              <ActionButton icon="refresh" title="Renew Policy" subtitle="Get renewal quotes" tone="blue" onPress={() => openRenewal(vehicle.id)} />
              <ActionButton icon="shield-check-outline" title="Endorsement" subtitle="Update policy details" tone="green" onPress={openEndorsement} />
              <ActionButton icon="file-plus-outline" title="Register Claim" subtitle={openClaims ? `${openClaims} open claim${openClaims === 1 ? '' : 's'}` : 'Initiate a new claim'} tone="orange" onPress={() => router.push({ pathname: '/customer/report-accident', params: { vehicleId: vehicle.id } })} />
            </View>
          </Pressable>
        );
      })}

      <RenewalModal
        visible={Boolean(renewalVehicleId)}
        ownerChange={ownerChange}
        claimInLastYear={claimInLastYear}
        setOwnerChange={setOwnerChange}
        setClaimInLastYear={setClaimInLastYear}
        onClose={() => setRenewalVehicleId(null)}
        onSubmit={submitRenewal}
      />

      <RenewalSuccessModal visible={renewalSuccess} onClose={() => setRenewalSuccess(false)} />

      <AddVehicleModal
        visible={addVehicleOpen}
        method={addMethod}
        value={addValue}
        setMethod={setAddMethod}
        setValue={setAddValue}
        onClose={() => setAddVehicleOpen(false)}
        onSubmit={submitAddVehicle}
      />

      <AddVehicleSuccessModal visible={addVehicleSuccess} onClose={() => setAddVehicleSuccess(false)} type="request" />

      <AddVehicleDocsModal visible={addVehicleDocs} onClose={() => setAddVehicleDocs(false)} onSubmit={submitAddVehicleDocs} />

      <AddVehicleSuccessModal visible={addVehicleThankYou} onClose={() => setAddVehicleThankYou(false)} type="thankyou" />

      <EndorsementModal
        visible={endorsementOpen}
        selected={endorsementOption}
        file={endorsementFile}
        details={endorsementDetails}
        onSelect={selectEndorsementOption}
        onPickDocument={() => void pickEndorsementDocument()}
        onDetailsChange={setEndorsementDetails}
        onClose={() => setEndorsementOpen(false)}
        onSubmit={submitEndorsement}
      />

      <EndorsementSuccessModal visible={endorsementSuccess} onClose={() => setEndorsementSuccess(false)} />

      <View style={styles.protectionBanner}>
        <View style={styles.bannerIcon}>
          <MaterialCommunityIcons name="shield-check-outline" size={25} color={palette.navy} />
        </View>
        <View style={styles.bannerCopy}>
          <Text style={styles.bannerTitle}>Stay Protected, Always!</Text>
          <Text style={styles.bannerText}>{renewalMessage}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/customer/policies')} style={styles.viewRenewals}>
          <Text style={styles.viewRenewalsText}>View Renewals</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color={palette.navy} />
        </Pressable>
      </View>
    </Screen>
  );
}

function AddVehicleModal({
  visible,
  method,
  value,
  setMethod,
  setValue,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  method: 'vehicle' | 'policy' | 'chassis';
  value: string;
  setMethod: (value: 'vehicle' | 'policy' | 'chassis') => void;
  setValue: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.addVehicleModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
            <MaterialCommunityIcons name="close" size={25} color={palette.navy} />
          </Pressable>

          <Text style={styles.addVehicleTitle}>Add Vehicle</Text>
          <Text style={styles.addVehicleSub}>Enter <Text style={styles.boldBlue}>any one</Text> of the following details to add your vehicle</Text>

          <AddVehicleOption
            selected={method === 'vehicle'}
            icon="car"
            label="Vehicle Number"
            placeholder="e.g. MH01AB1234"
            value={method === 'vehicle' ? value : ''}
            onSelect={() => { setMethod('vehicle'); setValue(''); }}
            onChangeText={setValue}
          />

          <OrDivider />

          <AddVehicleOption
            selected={method === 'policy'}
            icon="clipboard-list-outline"
            label="Policy Number"
            placeholder="e.g. IL/2025/1234567"
            value={method === 'policy' ? value : ''}
            onSelect={() => { setMethod('policy'); setValue(''); }}
            onChangeText={setValue}
          />

          <OrDivider />

          <AddVehicleOption
            selected={method === 'chassis'}
            icon="axis-arrow"
            label="Chassis Number"
            placeholder="e.g. MA3EJWB1S00123456"
            value={method === 'chassis' ? value : ''}
            onSelect={() => { setMethod('chassis'); setValue(''); }}
            onChangeText={setValue}
          />

          <Pressable accessibilityRole="button" onPress={onSubmit} style={styles.addSubmitButton}>
            <Text style={styles.addSubmitText}>Submit</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AddVehicleOption({
  selected,
  icon,
  label,
  placeholder,
  value,
  onSelect,
  onChangeText,
}: {
  selected: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  placeholder: string;
  value: string;
  onSelect: () => void;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.addOptionRow}>
      <Pressable accessibilityRole="button" onPress={onSelect} style={styles.addRadioWrap}>
        <View style={[styles.addRadio, selected && styles.addRadioSelected]} />
      </Pressable>

      <View style={styles.addOptionIcon}>
        <MaterialCommunityIcons name={icon} size={28} color="#1254D1" />
      </View>

      <View style={styles.addOptionCopy}>
        <Text style={styles.addOptionLabel}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={selected}
          placeholder={placeholder}
          placeholderTextColor="#A8B3C5"
          style={[styles.addInput, !selected && styles.addInputDisabled]}
        />
      </View>
    </View>
  );
}

function OrDivider() {
  return (
    <View style={styles.orRow}>
      <View style={styles.orLine} />
      <View style={styles.orBubble}>
        <Text style={styles.orText}>OR</Text>
      </View>
      <View style={styles.orLine} />
    </View>
  );
}

function AddVehicleSuccessModal({ visible, onClose, type }: { visible: boolean; onClose: () => void; type: 'request' | 'thankyou' | 'congrats' }) {
  const title = type === 'request' ? 'Request Submitted' : type === 'thankyou' ? 'Thank You!' : 'Congratulations!';
  const body = type === 'request'
    ? 'We will check our records and verify the details provided. If a matching vehicle or policy is found, it will be added to your account shortly.'
    : type === 'thankyou'
      ? 'Thank you for uploading the required documents. Our team will verify the details and your vehicle will be added to your account soon.'
      : 'Your vehicle is added successfully. Kindly check in My Vehicles option.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.addSuccessModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.successClose}>
            <MaterialCommunityIcons name="close" size={25} color={palette.navy} />
          </Pressable>

          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check" size={53} color="#FFFFFF" />
          </View>

          <Text style={styles.addSuccessTitle}>{title}</Text>
          <Text style={styles.addSuccessText}>{body}</Text>

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.okButton}>
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AddVehicleDocsModal({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.docsModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.docsClose}>
            <MaterialCommunityIcons name="close" size={25} color={palette.navy} />
          </Pressable>

          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#E3342F" />
          <Text style={styles.docsTitle}>Sorry!</Text>
          <Text style={styles.docsText}>This vehicle is not in our records. Kindly share the following documents to add your vehicle.</Text>

          <View style={styles.docsList}>
            <Text style={styles.docsListText}>1. RC Copy</Text>
            <Text style={styles.docsListText}>2. Insurance Copy</Text>
          </View>

          <UploadBox label="1. RC Copy" />
          <UploadBox label="2. Insurance Copy" />

          <View style={styles.docsActions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.docsCancel}>
              <Text style={styles.docsCancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onSubmit} style={styles.docsSubmit}>
              <Text style={styles.docsSubmitText}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function UploadBox({ label }: { label: string }) {
  return (
    <View style={styles.uploadGroup}>
      <Text style={styles.uploadLabel}>{label}</Text>
      <View style={styles.uploadBox}>
        <MaterialCommunityIcons name="cloud-upload-outline" size={28} color="#1254D1" />
        <Text style={styles.uploadText}>Click to upload or drag and drop</Text>
        <Text style={styles.uploadSub}>JPG, PNG, PDF (Max. 5MB)</Text>
      </View>
    </View>
  );
}

function EndorsementModal({
  visible,
  selected,
  file,
  details,
  onSelect,
  onPickDocument,
  onDetailsChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  selected: string;
  file: PickedEndorsementFile | null;
  details: string;
  onSelect: (value: string) => void;
  onPickDocument: () => void;
  onDetailsChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const options = ['Owner change', 'Make model change', 'Bodytype', 'Wrong GVW', 'Wrong registration number', 'Gst not mention', 'Other'];
  const requirement = endorsementDocumentRequirement(selected);
  const canSubmit = Boolean(selected && file && details.trim());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.endorsementModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
            <MaterialCommunityIcons name="close" size={25} color={palette.navy} />
          </Pressable>

          <View style={styles.modalIconBubble}>
            <MaterialCommunityIcons name="file-document-check-outline" size={39} color="#1254D1" />
          </View>

          <Text style={styles.endorsementTitle}>We are happy to help you!</Text>
          <Text style={styles.endorsementSub}>Kindly mention what type of endorsement is this</Text>

          <View style={styles.endorsementOptions}>
            {options.map((option) => (
              <Pressable key={option} accessibilityRole="button" onPress={() => onSelect(option)} style={styles.endorsementOption}>
                <View style={[styles.radioCircle, selected === option && styles.radioCircleSelected]} />
                <Text style={styles.endorsementOptionText}>{option}</Text>
              </Pressable>
            ))}
          </View>

          {selected ? (
            <View style={styles.endorsementRequirement}>
              <Text style={styles.endorsementRequirementLabel}>Required document</Text>
              <Pressable accessibilityRole="button" onPress={onPickDocument} style={[styles.endorsementUploadBox, file && styles.endorsementUploadBoxDone]}>
                <View style={styles.endorsementUploadIcon}>
                  <MaterialCommunityIcons name={file ? 'file-check-outline' : 'cloud-upload-outline'} size={22} color={file ? '#12805C' : '#1254D1'} />
                </View>
                <View style={styles.endorsementUploadCopy}>
                  <Text style={styles.endorsementUploadTitle}>{file ? file.name : `Upload ${requirement}`}</Text>
                  <Text style={styles.endorsementUploadSub}>{file ? 'Document attached successfully' : 'PDF, JPG, PNG or WEBP up to 5 MB'}</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {selected && file ? (
            <View style={styles.endorsementDetailsBox}>
              <Text style={styles.endorsementRequirementLabel}>Exact endorsement request</Text>
              <TextInput
                value={details}
                onChangeText={onDetailsChange}
                multiline
                placeholder="Briefly mention the exact correction/change required."
                placeholderTextColor="#91A3BA"
                style={styles.endorsementDetailsInput}
              />
            </View>
          ) : null}

          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={!canSubmit} onPress={onSubmit} style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}>
              <Text style={styles.submitText}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function endorsementDocumentRequirement(option: string) {
  if (!option) return 'supporting document';
  if (option === 'Gst not mention') return 'GST certificate';
  if (option === 'Other') return 'relevant document';
  return 'RC copy';
}

function EndorsementSuccessModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.successModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.successClose}>
            <MaterialCommunityIcons name="close" size={26} color={palette.navy} />
          </Pressable>

          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check" size={54} color="#FFFFFF" />
          </View>

          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successText}>
            Thanks for sharing your endorsement request. Our agent will call you with the next steps shortly.
          </Text>

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.okButton}>
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RenewalModal({
  visible,
  ownerChange,
  claimInLastYear,
  setOwnerChange,
  setClaimInLastYear,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  ownerChange: 'yes' | 'no' | '';
  claimInLastYear: 'yes' | 'no' | '';
  setOwnerChange: (value: 'yes' | 'no') => void;
  setClaimInLastYear: (value: 'yes' | 'no') => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = Boolean(ownerChange && claimInLastYear);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.renewalModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
            <MaterialCommunityIcons name="close" size={24} color={palette.navy} />
          </Pressable>

          <View style={styles.modalIconBubble}>
            <MaterialCommunityIcons name="file-document-check-outline" size={39} color="#1254D1" />
          </View>

          <Text style={styles.renewalTitle}>We are happy to help in your renewal!</Text>
          <Text style={styles.renewalSubtitle}>Kindly provide below details</Text>

          <Question title="Owner change in last 365 days?" value={ownerChange} onChange={setOwnerChange} />
          <Question title="Any claim in last 365 days?" value={claimInLastYear} onChange={setClaimInLastYear} />

          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={!canSubmit} onPress={onSubmit} style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}>
              <Text style={styles.submitText}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Question({ title, value, onChange }: { title: string; value: 'yes' | 'no' | ''; onChange: (value: 'yes' | 'no') => void }) {
  return (
    <View style={styles.questionBlock}>
      <Text style={styles.questionTitle}>{title}</Text>
      <View style={styles.radioRow}>
        <Pressable accessibilityRole="button" onPress={() => onChange('yes')} style={styles.radioOption}>
          <View style={[styles.radioCircle, value === 'yes' && styles.radioCircleSelected]} />
          <Text style={styles.radioText}>Yes</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onChange('no')} style={styles.radioOption}>
          <View style={[styles.radioCircle, value === 'no' && styles.radioCircleSelected]} />
          <Text style={styles.radioText}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RenewalSuccessModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.successModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.successClose}>
            <MaterialCommunityIcons name="close" size={26} color={palette.navy} />
          </Pressable>

          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check" size={54} color="#FFFFFF" />
          </View>

          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successText}>
            Thanks for showing your interest in renewing your policy. Soon, you will get your quotation with proper guidance from our experts.
          </Text>

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.okButton}>
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function InfoBlock({ icon, iconBg, iconColor, label, value, logo }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; iconBg: string; iconColor: string; label: string; value: string; logo?: number | null }) {
  return (
    <View style={styles.infoBlock}>
      <View style={[styles.infoIcon, { backgroundColor: iconBg }]}>
        {logo ? <Image source={logo} style={styles.insurerLogo} resizeMode="contain" /> : <MaterialCommunityIcons name={icon} size={18} color={iconColor} />}
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({ icon, title, subtitle, tone, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; subtitle: string; tone: 'blue' | 'green' | 'orange'; onPress: () => void }) {
  const config = {
    blue: { bg: '#F2F7FF', border: '#CFE0FF', color: '#2563EB' },
    green: { bg: '#F0FBF6', border: '#C7F0DA', color: '#12805C' },
    orange: { bg: '#FFF7EF', border: '#F6D7B5', color: '#C95E16' },
  }[tone];

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.actionButton, { backgroundColor: config.bg, borderColor: config.border }]}>
      <MaterialCommunityIcons name={icon} size={20} color={config.color} />
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, { color: config.color }]} numberOfLines={1}>{title}</Text>
        <Text style={styles.actionSub} numberOfLines={1}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function latestPolicyFor(vehicleId: string, policies: Policy[]) {
  return policies.filter((policy) => policy.vehicle_id === vehicleId).sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
}

function isPolicyActive(policy: Policy) {
  return new Date(policy.end_date).getTime() >= Date.now();
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function vehicleImage(id: string) {
  const index = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % truckImages.length;
  return truckImages[index];
}

function insurerImage(name?: string | null) {
  const normalized = name?.toLowerCase() ?? '';
  if (normalized.includes('hdfc')) return insurerLogos.hdfc;
  if (normalized.includes('bajaj') || normalized.includes('allianz') || normalized.includes('alliance')) return insurerLogos.bajaj;
  if (normalized.includes('tata') || normalized.includes('aig')) return insurerLogos.tata;
  return null;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  addVehicleModal: { width: '100%', maxWidth: 420, borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 26, paddingTop: 25, paddingBottom: 26, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, elevation: 9 },
  addVehicleTitle: { color: palette.navy, fontSize: 25, lineHeight: 31, fontWeight: '900', marginBottom: 22 },
  addVehicleSub: { color: palette.slate, fontSize: 14, lineHeight: 20, fontWeight: '700', marginBottom: 24 },
  boldBlue: { color: '#1254D1', fontWeight: '900' },
  addOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addRadioWrap: { width: 26, height: 58, alignItems: 'center', justifyContent: 'center' },
  addRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.8, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  addRadioSelected: { borderWidth: 5.2, borderColor: '#1254D1' },
  addOptionIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  addOptionCopy: { flex: 1, minWidth: 0 },
  addOptionLabel: { color: palette.navy, fontSize: 16, lineHeight: 21, fontWeight: '900', marginBottom: 8 },
  addInput: { height: 44, borderWidth: 1, borderColor: '#DCE4EF', borderRadius: 7, paddingHorizontal: 13, color: palette.ink, fontSize: 14, fontWeight: '700', backgroundColor: '#FFFFFF' },
  addInputDisabled: { backgroundColor: '#FAFBFD', opacity: 0.7 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15, marginLeft: 82 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E5EAF2' },
  orBubble: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  orText: { color: palette.navy, fontSize: 13, fontWeight: '900' },
  addSubmitButton: { height: 50, borderRadius: 7, backgroundColor: '#0B50D4', alignItems: 'center', justifyContent: 'center', marginTop: 27 },
  addSubmitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },

  addSuccessModal: { width: '100%', maxWidth: 390, borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 30, paddingTop: 42, paddingBottom: 30, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, elevation: 9 },
  addSuccessTitle: { color: palette.navy, fontSize: 24, lineHeight: 30, fontWeight: '900', textAlign: 'center', marginTop: 20 },
  addSuccessText: { color: palette.navy, fontSize: 14.5, lineHeight: 23, fontWeight: '700', textAlign: 'center', marginTop: 13, marginBottom: 26 },

  docsModal: { width: '100%', maxWidth: 390, borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingTop: 25, paddingBottom: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, elevation: 9 },
  docsClose: { position: 'absolute', right: 14, top: 12, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  docsTitle: { color: palette.navy, fontSize: 22, fontWeight: '900', marginTop: 7 },
  docsText: { color: palette.navy, fontSize: 13.2, lineHeight: 19, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  docsList: { width: '100%', marginTop: 13, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5EAF2' },
  docsListText: { color: palette.navy, fontSize: 13, lineHeight: 20, fontWeight: '800' },
  uploadGroup: { width: '100%', marginTop: 12 },
  uploadLabel: { color: palette.navy, fontSize: 13, fontWeight: '900', marginBottom: 7 },
  uploadBox: { height: 76, borderRadius: 9, borderWidth: 1.2, borderStyle: 'dashed', borderColor: '#8BB8F3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBFDFF' },
  uploadText: { color: '#1254D1', fontSize: 11.5, fontWeight: '800', marginTop: 3 },
  uploadSub: { color: palette.slate, fontSize: 10, fontWeight: '700', marginTop: 2 },
  docsActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 16 },
  docsCancel: { flex: 1, height: 42, borderRadius: 6, borderWidth: 1.2, borderColor: '#1254D1', alignItems: 'center', justifyContent: 'center' },
  docsCancelText: { color: '#1254D1', fontSize: 13, fontWeight: '900' },
  docsSubmit: { flex: 1, height: 42, borderRadius: 6, backgroundColor: '#0B50D4', alignItems: 'center', justifyContent: 'center' },
  docsSubmitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  endorsementModal: { width: '100%', maxWidth: 370, borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },
  endorsementTitle: { color: palette.navy, fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  endorsementSub: { color: palette.slate, fontSize: 12.5, lineHeight: 17, fontWeight: '700', marginTop: 5, marginBottom: 16, textAlign: 'center' },
  endorsementOptions: { width: '100%', gap: 10, marginBottom: 14 },
  endorsementOption: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  endorsementOptionText: { color: palette.navy, fontSize: 13.2, fontWeight: '700' },
  endorsementRequirement: { width: '100%', marginBottom: 12 },
  endorsementRequirementLabel: { color: palette.slate, fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.35, marginBottom: 7 },
  endorsementUploadBox: { minHeight: 62, borderRadius: 14, borderWidth: 1.2, borderStyle: 'dashed', borderColor: '#9FC4F5', backgroundColor: '#F8FBFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  endorsementUploadBoxDone: { borderStyle: 'solid', borderColor: '#BFEBD0', backgroundColor: '#F7FFFB' },
  endorsementUploadIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  endorsementUploadCopy: { flex: 1, minWidth: 0 },
  endorsementUploadTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  endorsementUploadSub: { color: palette.slate, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  endorsementDetailsBox: { width: '100%', marginBottom: 13 },
  endorsementDetailsInput: { minHeight: 76, borderRadius: 13, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', paddingHorizontal: 11, paddingVertical: 9, color: palette.ink, fontSize: 12.5, fontWeight: '700', textAlignVertical: 'top' },

  renewalModal: { width: '100%', maxWidth: 365, borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 26, paddingTop: 26, paddingBottom: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },
  modalClose: { position: 'absolute', right: 16, top: 14, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalIconBubble: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  renewalTitle: { color: palette.navy, fontSize: 18, lineHeight: 24, fontWeight: '900', textAlign: 'center' },
  renewalSubtitle: { color: palette.slate, fontSize: 13.5, fontWeight: '700', marginTop: 5, marginBottom: 19, textAlign: 'center' },
  questionBlock: { width: '100%', alignItems: 'center', marginBottom: 19 },
  questionTitle: { color: palette.navy, fontSize: 13.6, fontWeight: '900', textAlign: 'center', marginBottom: 13 },
  radioRow: { flexDirection: 'row', justifyContent: 'center', gap: 42 },
  radioOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.6, borderColor: '#1254D1', backgroundColor: '#FFFFFF' },
  radioCircleSelected: { borderWidth: 5, borderColor: '#1254D1' },
  radioText: { color: palette.navy, fontSize: 13, fontWeight: '700' },
  modalActions: { width: '100%', flexDirection: 'row', gap: 12, marginTop: 2 },
  cancelButton: { flex: 1, height: 46, borderRadius: 5, borderWidth: 1.3, borderColor: '#1254D1', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#1254D1', fontSize: 14, fontWeight: '900' },
  submitButton: { flex: 1, height: 46, borderRadius: 5, backgroundColor: '#0B50D4', alignItems: 'center', justifyContent: 'center' },
  submitButtonDisabled: { opacity: 0.55 },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },

  successModal: { width: '100%', maxWidth: 395, borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 34, paddingTop: 46, paddingBottom: 32, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },
  successClose: { position: 'absolute', right: 17, top: 14, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#22C06B', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { color: palette.navy, fontSize: 30, lineHeight: 36, fontWeight: '900', textAlign: 'center', marginBottom: 15 },
  successText: { color: palette.navy, fontSize: 16.5, lineHeight: 28, fontWeight: '700', textAlign: 'center', marginBottom: 32 },
  okButton: { width: '100%', height: 58, borderRadius: 6, backgroundColor: '#0B50D4', alignItems: 'center', justifyContent: 'center' },
  okText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  pageHeader: { marginTop: -20, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageTitle: { color: palette.navy, fontSize: 22, lineHeight: 27, fontWeight: '900' },
  countBadge: { height: 24, borderRadius: 7, backgroundColor: '#EAF3FF', paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { color: '#2563EB', fontSize: 11, fontWeight: '900' },
  pageSub: { color: palette.slate, fontSize: 12, fontWeight: '700', marginTop: 3 },
  addButton: { height: 40, borderRadius: 8, backgroundColor: palette.navy, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },

  vehicleCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', borderRadius: 16, marginBottom: 14, padding: 13, shadowColor: palette.ink, shadowOpacity: 0.055, shadowRadius: 10, elevation: 2 },
  vehicleCardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  cardMain: { flexDirection: 'row', gap: 13 },
  leftPane: { width: 178, paddingRight: 6 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  vehicleNoChip: { height: 30, borderRadius: 7, backgroundColor: '#EAF3FF', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  vehicleNoText: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  activeChip: { height: 30, borderRadius: 7, backgroundColor: '#EAF3FF', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  inactiveChip: { backgroundColor: '#FFF0F6' },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#19A7F2' },
  inactiveDot: { backgroundColor: '#C83272' },
  activeText: { color: palette.navy, fontSize: 11, fontWeight: '900' },
  inactiveText: { color: '#C83272' },
  truckImage: { width: 162, height: 104, marginTop: 2, alignSelf: 'center' },
  vehicleMake: { color: palette.navy, fontSize: 15, lineHeight: 18, fontWeight: '900', marginTop: 6 },
  vehicleModel: { color: palette.ink, fontSize: 13, lineHeight: 16, fontWeight: '800', marginTop: 1 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  smallTag: { color: palette.slate, fontSize: 10.5, fontWeight: '800', backgroundColor: '#F1F5F9', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },

  rightPane: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: '#E5ECF5', paddingLeft: 12, position: 'relative' },
  infoBlock: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#E5ECF5' },
  infoIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  insurerLogo: { width: 27, height: 27 },
  infoCopy: { flex: 1, minWidth: 0 },
  infoLabel: { color: palette.slate, fontSize: 10.5, fontWeight: '800' },
  infoValue: { color: palette.navy, fontSize: 12.5, lineHeight: 16, fontWeight: '900', marginTop: 2 },
  dropdownButton: { position: 'absolute', right: 0, top: 0, width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },

  actionRow: { flexDirection: 'row', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5ECF5' },
  actionButton: { flex: 1, minHeight: 50, borderRadius: 10, borderWidth: 1, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: 9.2, lineHeight: 11, fontWeight: '900' },
  actionSub: { color: palette.slate, fontSize: 7.7, lineHeight: 9, fontWeight: '700', marginTop: 1 },

  protectionBanner: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  bannerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  bannerCopy: { flex: 1, minWidth: 0 },
  bannerTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' },
  bannerText: { color: palette.slate, fontSize: 11.3, fontWeight: '700', marginTop: 3 },
  viewRenewals: { height: 38, borderRadius: 9, borderWidth: 1, borderColor: '#BBD2F2', backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  viewRenewalsText: { color: palette.navy, fontSize: 11.5, fontWeight: '900' },
});
